/**
 * rqtTreeLayout.js
 * HEVC Residual Quadtree (RQT / Transform Tree) Hierarchical Construction & Geometric Square Layout Engine.
 *
 * Implements ITU-T H.265 Section 7.3.8.8 (Transform tree syntax):
 * 1. 4-ary recursive tree decomposition from flat TRANSFORM_QUANT trace events.
 * 2. Strict Morton Z-scan quadrant order (0: TL, 1: TR, 2: BL, 3: BR).
 * 3. Proportional Geometric Square TU Block layout:
 *    - Size 32×32: Large TU square with dimension labels & internal divisions
 *    - Size 16×16: Sub-TU square blocks (1/2 edge)
 *    - Size 8×8: Sub-TU square blocks (1/4 edge)
 *    - Size 4×4: Leaf TU square blocks (1/8 edge, DST-VII vs DCT-II)
 * 4. Internal cross partition lines (+) for split TUs, depth colors & significant coefficient badges for leaf TUs.
 * 5. Reingold-Tilford zero-overlap tree layout with orthogonal connector branches.
 */

/**
 * Normalizes relative coordinates within a Coding Unit.
 */
function getRelativeCoord(val, cuPixel, cuSize) {
  if (typeof val !== 'number' || isNaN(val)) return 0;
  if (val >= cuPixel && val < cuPixel + cuSize) {
    return val - cuPixel;
  }
  if (val < cuSize) {
    return val;
  }
  return val % cuSize;
}

/**
 * Geometric Square Size configuration per TU Size.
 * Proportional to actual pixel dimensions (32 -> 16 -> 8 -> 4).
 * Strictly mirrors Video_Compression-Trang-8.drawio.svg halving proportions (160:80:40:20).
 */
export const RQT_GEOMETRIC_SQUARE_CONFIG = {
  64: { size: 160, fontSize: 28, label: '64×64', y: 45 },
  32: { size: 160, fontSize: 28, label: '32×32', y: 45 },
  16: { size: 80,  fontSize: 20, label: '16×16', y: 255 },
  8:  { size: 40,  fontSize: 14, label: '8×8',   y: 385 },
  4:  { size: 20,  fontSize: 10, label: '4×4',   y: 475 }
};

export const RQT_SIBLING_GAPS = {
  1: 40,
  2: 24,
  3: 14,
  4: 10
};

/**
 * Builds a recursive Residual Quadtree (RQT) from flat TRANSFORM_QUANT events.
 *
 * @param {Array} tuEvents Array of transform records
 * @param {Object} options Selection options: { cuX, cuY, cuSize, component, intraMode }
 * @returns {Object} Root node of the RQT
 */
export function buildRqtTree(tuEvents = [], options = {}) {
  const {
    cuX = 0,
    cuY = 0,
    cuSize = 32,
    component = 'Y',
    intraMode = null
  } = options;

  if (!tuEvents || tuEvents.length === 0) {
    return createEmptyRqtRoot(cuSize, cuX, cuY);
  }

  // Filter events by component
  let compEvents = tuEvents.filter(e => (e.component || 'Y') === component);
  if (compEvents.length === 0) {
    compEvents = tuEvents;
  }

  // Filter by target CU position if available
  let cuEvents = compEvents.filter(e => {
    if (e.cu_x !== undefined && e.cu_y !== undefined) {
      return e.cu_x === cuX && e.cu_y === cuY;
    }
    return true;
  });

  if (cuEvents.length === 0) {
    cuEvents = compEvents;
  }

  // Filter by intraMode if provided and available
  if (intraMode !== null && intraMode !== undefined) {
    const modeMatches = cuEvents.filter(e => e.intra_mode === intraMode);
    if (modeMatches.length > 0) {
      cuEvents = modeMatches;
    }
  }

  // Normalize TU coordinates relative to CU
  const normalized = cuEvents.map(e => {
    const rawTuX = e.tu_x !== undefined ? e.tu_x : 0;
    const rawTuY = e.tu_y !== undefined ? e.tu_y : 0;
    const w = e.width || e.tu_width || 8;
    const h = e.height || e.tu_height || 8;
    const relX = getRelativeCoord(rawTuX, cuX, cuSize);
    const relY = getRelativeCoord(rawTuY, cuY, cuSize);

    return {
      ...e,
      rawTuX,
      rawTuY,
      relX,
      relY,
      width: w,
      height: h,
      size: Math.max(w, h),
      depth: e.tu_depth !== undefined ? e.tu_depth : 0
    };
  });

  // Determine root TU size: HEVC max TU is 32x32, or cuSize (min 4)
  const maxTuWidth = Math.max(...normalized.map(n => n.size), 4);
  const rootSize = Math.min(Math.max(cuSize || 32, maxTuWidth), 32);

  let leafCounter = 0;

  function buildSubtree(relX, relY, size, depth, parentId = null) {
    const id = `tu_d${depth}_x${relX}_y${relY}`;
    const altId = `tu_${depth}_${relX}_${relY}`;

    // Find direct matching event for this TU
    const match = normalized.find(n =>
      n.relX === relX &&
      n.relY === relY &&
      n.size === size
    );

    // Check if split into smaller TUs:
    let isSplit = false;
    if (size > 4) {
      const hasSubBlocks = normalized.some(n =>
        n.relX >= relX && n.relX < relX + size &&
        n.relY >= relY && n.relY < relY + size &&
        n.size < size
      );
      if (hasSubBlocks) isSplit = true;
    }

    const isDst = Boolean(match?.is_dst || (size === 4 && component === 'Y'));
    const isTransformSkip = Boolean(match?.is_transform_skip);

    const node = {
      id,
      altId,
      parentId,
      depth,
      size,
      width: size,
      height: size,
      relX,
      relY,
      absX: cuX + relX,
      absY: cuY + relY,
      isSplit,
      split: isSplit,
      isDst,
      isTransformSkip,
      transformName: isDst ? '2D DST-VII' : '2D DCT-II',
      sigCoeffCount: match?.sig_coeff_count ?? 0,
      dcCoeff: match?.dc_coeff ?? 0,
      energyCompactionRatio: match?.energy_compaction_ratio ?? 0,
      sparsityRatio: match?.sparsity_ratio ?? 0,
      qp: match?.qp ?? 32,
      rawEvent: match || null,
      children: [],
      zScanIndex: null
    };

    if (isSplit && size > 4 && depth < 3) {
      const half = size / 2;
      const nextDepth = depth + 1;
      // Strict Morton Z-scan quadrant order (0: TL, 1: TR, 2: BL, 3: BR)
      node.children = [
        buildSubtree(relX, relY, half, nextDepth, id),
        buildSubtree(relX + half, relY, half, nextDepth, id),
        buildSubtree(relX, relY + half, half, nextDepth, id),
        buildSubtree(relX + half, relY + half, half, nextDepth, id)
      ];
    } else {
      node.zScanIndex = leafCounter++;
    }

    return node;
  }

  const root = buildSubtree(0, 0, rootSize, 0, null);
  root.totalLeaves = leafCounter;
  return root;
}

function createEmptyRqtRoot(size = 32, cuX = 0, cuY = 0) {
  const s = Math.min(size || 32, 32);
  return {
    id: 'tu_d0_x0_y0',
    altId: 'tu_0_0_0',
    parentId: null,
    depth: 0,
    size: s,
    width: s,
    height: s,
    relX: 0,
    relY: 0,
    absX: cuX,
    absY: cuY,
    isSplit: false,
    split: false,
    isDst: s === 4,
    isTransformSkip: false,
    transformName: s === 4 ? '2D DST-VII' : '2D DCT-II',
    sigCoeffCount: 0,
    dcCoeff: 0,
    energyCompactionRatio: 0,
    sparsityRatio: 0,
    qp: 32,
    rawEvent: null,
    children: [],
    zScanIndex: 0,
    totalLeaves: 1
  };
}

/**
 * Computes Reingold-Tilford Geometric Square Layout coordinates for RQT.
 * Keeps 1:1 square block aspect ratio with zero-overlap branch placement.
 *
 * @param {Object} root RQT root node
 * @param {Object} options Configuration options
 * @returns {Object} Tree layout metadata and flattened nodes/edges
 */
export function computeTuTreeLayout(root, options = {}) {
  const _sizeConfig = options.sizeConfig || RQT_GEOMETRIC_SQUARE_CONFIG;
  const siblingGaps = options.siblingGaps || RQT_SIBLING_GAPS;

  const nodes = [];
  const edges = [];

  if (!root) {
    return { root: null, nodes: [], edges: [], totalWidth: 480, totalHeight: 300 };
  }

  const DEPTH_CONFIG = [
    { size: 160, fontSize: 28, y: 45 },
    { size: 80,  fontSize: 20, y: 255 },
    { size: 40,  fontSize: 14, y: 385 },
    { size: 20,  fontSize: 10, y: 475 }
  ];

  function getNodeConfig(node) {
    const relDepth = Math.max(0, node.depth - (root.depth || 0));
    return DEPTH_CONFIG[Math.min(relDepth, 3)];
  }

  // Pass 1: Compute required subtree bounding box widths bottom-up (post-order)
  function measureSubtree(node) {
    const config = getNodeConfig(node);
    const nodeSize = config.size;

    if (!node.children || node.children.length === 0) {
      node.subtreeWidth = nodeSize;
      return nodeSize;
    }

    const gap = siblingGaps[node.depth + 1] ?? 16;
    let totalChildWidth = 0;
    node.children.forEach((child, idx) => {
      const cw = measureSubtree(child);
      totalChildWidth += cw + (idx > 0 ? gap : 0);
    });

    node.subtreeWidth = Math.max(nodeSize, totalChildWidth);
    return node.subtreeWidth;
  }

  measureSubtree(root);

  // Pass 2: Position nodes top-down (pre-order)
  function positionSubtree(node, leftBound, rightBound) {
    const config = getNodeConfig(node);
    const nodeSize = config.size;

    // Center node within its allocated horizontal space
    const centerX = (leftBound + rightBound) / 2;
    const nodeX = Math.round(centerX - nodeSize / 2);
    const nodeY = config.y;

    node.layout = {
      x: nodeX,
      y: nodeY,
      size: nodeSize,
      width: nodeSize,
      height: nodeSize,
      centerX,
      centerY: nodeY + nodeSize / 2
    };

    if (node.children && node.children.length > 0) {
      const gap = siblingGaps[node.depth + 1] ?? 16;
      const totalWidth = node.children.reduce((acc, c, idx) => acc + c.subtreeWidth + (idx > 0 ? gap : 0), 0);

      let currentLeft = centerX - totalWidth / 2;

      node.children.forEach((child) => {
        const childRight = currentLeft + child.subtreeWidth;
        positionSubtree(child, currentLeft, childRight);
        currentLeft = childRight + gap;
      });
    }
  }

  const initialWidth = Math.max(root.subtreeWidth, 480);
  positionSubtree(root, 40, 40 + initialWidth);

  // Pass 3: Collect flattened nodes and construct orthogonal connector edges
  function collect(node) {
    nodes.push(node);

    if (node.children && node.children.length > 0) {
      const parentBottomX = node.layout.centerX;
      const parentBottomY = node.layout.y + node.layout.size;

      const firstChildTopY = node.children[0].layout.y;
      const midY = Math.round((parentBottomY + firstChildTopY) / 2);

      node.children.forEach((child) => {
        const childTopX = child.layout.centerX;
        const childTopY = child.layout.y;

        // Orthogonal connector path: Top parent -> Mid horizontal bar -> Bottom child
        const path = `M ${parentBottomX} ${parentBottomY} V ${midY} H ${childTopX} V ${childTopY}`;

        edges.push({
          id: `edge_${node.id}_to_${child.id}`,
          parentId: node.id,
          childId: child.id,
          path,
          startX: parentBottomX,
          startY: parentBottomY,
          midY,
          endX: childTopX,
          endY: childTopY
        });

        collect(child);
      });
    }
  }

  collect(root);

  // Compute total diagram dimensions with comfortable margin
  const minX = Math.min(...nodes.map(n => n.layout.x));
  const maxX = Math.max(...nodes.map(n => n.layout.x + n.layout.size));
  const maxY = Math.max(...nodes.map(n => n.layout.y + n.layout.size));

  // Shift if necessary so minX starts at 40px
  const shiftX = 40 - minX;
  if (shiftX !== 0) {
    nodes.forEach(n => { n.layout.x += shiftX; n.layout.centerX += shiftX; });
    edges.forEach(e => {
      e.startX += shiftX;
      e.endX += shiftX;
      e.path = `M ${e.startX} ${e.startY} V ${e.midY} H ${e.endX} V ${e.endY}`;
    });
  }

  const totalWidth = Math.max(maxX - minX + 80, 480);
  const totalHeight = maxY + 60;

  return {
    root,
    nodes,
    edges,
    totalWidth: Math.round(totalWidth),
    totalHeight: Math.round(totalHeight)
  };
}

/**
 * Returns color style for a TU node based on size, depth, and DST status.
 */
export function getTuNodeColorTheme(size, isSplit = false, isDst = false) {
  if (isDst) {
    return {
      fill: '#EDE9FE',
      border: 'var(--system-purple, #AF52DE)',
      text: '#581C87',
      label: '4×4 DST'
    };
  }

  switch (size) {
    case 32:
      return {
        fill: '#CCE5FF',
        border: 'var(--apple-label, #000000)',
        text: '#002244',
        label: '32×32'
      };
    case 16:
      return {
        fill: '#BAE6FD',
        border: 'var(--apple-label, #000000)',
        text: '#0284C7',
        label: '16×16'
      };
    case 8:
      return {
        fill: '#7DD3FC',
        border: 'var(--apple-label, #000000)',
        text: '#0369A1',
        label: '8×8'
      };
    case 4:
    default:
      return {
        fill: '#38BDF8',
        border: 'var(--apple-label, #000000)',
        text: '#0C4A6E',
        label: '4×4'
      };
  }
}

export const QUADRANT_NAMES = ['TL (0)', 'TR (1)', 'BL (2)', 'BR (3)'];

/**
 * Generates progressive simulation/playback steps for the RQT transform evaluation process,
 * mirroring HM's recursive xRecurIntraCodingLumaQT traversal.
 *
 * @param {Object} tree Root of the RQT tree
 * @param {Array} tuEvents Raw transform events
 * @returns {Array} List of step objects for playback
 */
export function generateRqtSimulationSteps(tree, tuEvents = []) {
  if (!tree) return [];

  const steps = [];

  // Step 1: Initial state - evaluating Root TU non-split
  steps.push({
    stepIdx: 0,
    activeNodeId: tree.id,
    type: 'EVAL_ROOT',
    title: `Evaluate Root TU ${tree.size}×${tree.size}`,
    desc: `Testing 2D ${tree.transformName} non-split transform on full CU (${tree.size}×${tree.size})`,
    tuNode: tree,
    tuRecord: tree.rawEvent || (tuEvents.find(e => e.width === tree.size) || tuEvents[0]),
    depth: tree.depth,
    size: tree.size,
    status: tree.isSplit ? 'SPLIT' : 'LEAF',
    callStack: [{ id: tree.id, size: tree.size, depth: tree.depth, status: 'TESTING', label: `D0: Root ${tree.size}×${tree.size}` }]
  });

  // If tree is split, generate recursive steps for each child in Z-scan order
  function traverseChildren(node, currentStack) {
    if (!node.children || node.children.length === 0) return;

    node.children.forEach((child, k) => {
      const quadName = QUADRANT_NAMES[k] || `Quad ${k}`;
      const childStack = [
        ...currentStack,
        { id: child.id, size: child.size, depth: child.depth, status: child.isSplit ? 'SPLIT' : 'LEAF', label: `D${child.depth}: ${child.size}×${child.size} ${quadName}` }
      ];

      steps.push({
        stepIdx: steps.length,
        activeNodeId: child.id,
        type: child.isSplit ? 'RECURSE_CHILD' : 'EVAL_LEAF',
        title: `Quadrant ${k}: ${quadName} • ${child.size}×${child.size}`,
        desc: child.isSplit
          ? `Subdividing quadrant ${quadName} into depth ${child.depth + 1} sub-TUs`
          : `Evaluating leaf transform: ${child.size}×${child.size} (${child.transformName}) • Sig: ${child.sigCoeffCount}`,
        tuNode: child,
        tuRecord: child.rawEvent || (tuEvents.find(e => e.tu_x === child.absX && e.tu_y === child.absY && e.width === child.size) || child.rawEvent || tree.rawEvent),
        depth: child.depth,
        size: child.size,
        status: child.isSplit ? 'SPLIT' : 'LEAF',
        callStack: childStack
      });

      if (child.isSplit) {
        traverseChildren(child, childStack);
      }
    });
  }

  if (tree.isSplit) {
    traverseChildren(tree, [{ id: tree.id, size: tree.size, depth: tree.depth, status: 'SPLIT', label: `D0: Root ${tree.size}×${tree.size}` }]);

    // Final step: Decision comparison (Split vs Nosplit)
    steps.push({
      stepIdx: steps.length,
      activeNodeId: tree.id,
      type: 'RQT_DECISION',
      title: `RQT Decision: split_transform_flag = ${tree.isSplit ? 1 : 0}`,
      desc: tree.isSplit
        ? `Sum of sub-TU costs J_split < J_nosplit ➔ Committing 4-ary RQT partition`
        : `Non-split cost J_nosplit <= J_split ➔ Preserving single TU`,
      tuNode: tree,
      tuRecord: tree.rawEvent || tuEvents[0],
      depth: 0,
      size: tree.size,
      status: tree.isSplit ? 'SPLIT' : 'LEAF',
      callStack: [{ id: tree.id, size: tree.size, depth: 0, status: tree.isSplit ? 'SPLIT' : 'LEAF', label: `Decision: ${tree.isSplit ? 'SPLIT' : 'LEAF'}` }]
    });
  }

  return steps;
}
