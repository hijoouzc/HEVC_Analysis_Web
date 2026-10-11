/**
 * quadtreeTreeLayout.js
 * HEVC CTU 64x64 Quadtree Hierarchical Tree Construction & Geometric Square Layout Engine.
 *
 * Implements:
 * 1. 4-ary recursive tree decomposition from flat partition nodes (HM trace or RDO simulator).
 * 2. Strict Z-scan (Morton) order leaf indexing (0..N-1).
 * 3. Proportional Geometric Square CU Block layout:
 *    - D0 (64x64): Large CTU square with dimension labels & internal divisions
 *    - D1 (32x32): Square blocks (1/2 edge)
 *    - D2 (16x16): Square blocks (1/4 edge)
 *    - D3 (8x8): Square blocks (1/8 edge)
 * 4. Internal cross partition lines for split nodes, solid depth colors & Z-scan numbers for leaves.
 * 5. Reingold-Tilford zero-overlap tree layout with orthogonal connector branches.
 */

/**
 * Normalizes relative coordinates within a 64x64 CTU.
 */
function getRelativeCoord(val, ctuPixel) {
  if (typeof val !== 'number' || isNaN(val)) return 0;
  if (val >= ctuPixel && val < ctuPixel + 64) {
    return val - ctuPixel;
  }
  if (val < 64) {
    return val;
  }
  return val % 64;
}

/**
 * Builds a recursive quadtree from partition nodes.
 *
 * @param {Array} partitionNodes Array of nodes with x, y, width, height, depth, split, mode, cost, etc.
 * @param {number} ctuPixelX Base CTU pixel X (ctuX * 64)
 * @param {number} ctuPixelY Base CTU pixel Y (ctuY * 64)
 * @returns {Object} Root node of the quadtree
 */
export function buildQuadtreeTree(partitionNodes = [], ctuPixelX = 0, ctuPixelY = 0) {
  if (!partitionNodes || partitionNodes.length === 0) {
    return createEmptyRoot();
  }

  // Pre-normalize coordinates
  const normalized = partitionNodes.map(n => ({
    ...n,
    relX: n.rel_x !== undefined ? n.rel_x : getRelativeCoord(n.x, ctuPixelX),
    relY: n.rel_y !== undefined ? n.rel_y : getRelativeCoord(n.y, ctuPixelY),
    size: n.width || n.size || 64
  }));

  let leafCounter = 0;

  function buildSubtree(relX, relY, size, depth, parentId = null) {
    const id = `node_d${depth}_x${relX}_y${relY}`;

    // Find direct matching node
    const match = normalized.find(n =>
      n.relX === relX &&
      n.relY === relY &&
      n.size === size &&
      (n.depth === depth || n.depth === undefined)
    );

    const altId = `node_${depth}_${relX}_${relY}`;

    // Determine if split:
    let isSplit = false;
    if (match && match.split !== undefined && match.split !== null) {
      isSplit = Boolean(match.split);
    } else if (size > 8) {
      const hasSubBlocks = normalized.some(n =>
        n.relX >= relX && n.relX < relX + size &&
        n.relY >= relY && n.relY < relY + size &&
        n.size < size
      );
      if (hasSubBlocks) isSplit = true;
    }

    const node = {
      id,
      altId,
      parentId,
      depth,
      size,
      relX,
      relY,
      absX: ctuPixelX + relX,
      absY: ctuPixelY + relY,
      isSplit,
      split: isSplit,
      mode: match?.mode || 'INTRA',
      intraDir: match?.intra_dir ?? match?.intraDir ?? null,
      cost: match?.cost !== undefined && match?.cost !== null ? Number(match.cost) : null,
      qp: match?.qp ?? 32,
      rawNode: match || null,
      children: [],
      zScanIndex: null
    };

    if (isSplit && size > 8 && depth < 3) {
      const half = size / 2;
      const nextDepth = depth + 1;
      // Strict Z-scan quadrant order:
      // 0: Top-Left (TL)
      // 1: Top-Right (TR)
      // 2: Bottom-Left (BL)
      // 3: Bottom-Right (BR)
      node.children = [
        buildSubtree(relX, relY, half, nextDepth, id),
        buildSubtree(relX + half, relY, half, nextDepth, id),
        buildSubtree(relX, relY + half, half, nextDepth, id),
        buildSubtree(relX + half, relY + half, half, nextDepth, id)
      ];
    } else {
      // Leaf node - assign sequential Z-scan index
      node.zScanIndex = leafCounter++;
    }

    return node;
  }

  const root = buildSubtree(0, 0, 64, 0, null);
  root.totalLeaves = leafCounter;
  return root;
}

/**
 * Builds a progressive HEVC quadtree directly from an RDO Simulator snapshot.
 * Correctly respects RDO KEEP/LEAF decisions, pruning discarded trial branches,
 * and maintains consistent Morton Z-scan indexing matching the 2D spatial canvas.
 *
 * @param {Object} treeSnapshot Snapshot map from simulator { [id]: nodeMeta }
 * @param {string} activeNodeId Active node being evaluated in current step
 * @param {Array} callStack Current recursion call stack
 * @returns {Object} Clean hierarchical tree root
 */
export function buildSimulatorQuadtreeTree(treeSnapshot, activeNodeId = null, callStack = []) {
  if (!treeSnapshot || !treeSnapshot['node_0_0_0']) {
    return createEmptyRoot();
  }

  const stackSet = new Set((callStack || []).map(n => (typeof n === 'object' ? n.id : n)));
  if (activeNodeId) stackSet.add(activeNodeId);

  let leafCounter = 0;

  function buildNode(depth, x, y, size, parentId = null) {
    const id = `node_${depth}_${x}_${y}`;
    const altId = `node_d${depth}_x${x}_y${y}`;
    const snapNode = treeSnapshot[id];
    if (!snapNode) return null;

    const isInStack = stackSet.has(id);

    let isSplit = false;
    if (snapNode.status === 'SPLIT') {
      isSplit = true;
    } else if (snapNode.decision === 'KEEP' || snapNode.status === 'LEAF') {
      isSplit = false;
    } else if (isInStack && depth < 3 && size > 8) {
      const half = size / 2;
      const subCoords = [
        [x, y],
        [x + half, y],
        [x, y + half],
        [x + half, y + half]
      ];
      const hasChildren = subCoords.some(([cx, cy]) => Boolean(treeSnapshot[`node_${depth + 1}_${cx}_${cy}`]));
      if (hasChildren) isSplit = true;
    }

    const nodeObj = {
      id,
      altId,
      parentId,
      depth,
      size,
      relX: x,
      relY: y,
      absX: x,
      absY: y,
      isSplit,
      split: isSplit,
      status: snapNode.status,
      decision: snapNode.decision,
      mode: snapNode.bestMode?.modeName || 'INTRA',
      intraDir: snapNode.bestMode?.mode ?? null,
      cost: snapNode.jNonSplit !== undefined && snapNode.jNonSplit !== null ? Number(snapNode.jNonSplit) : null,
      qp: 32,
      rawNode: snapNode,
      children: [],
      zScanIndex: null
    };

    if (isSplit && depth < 3 && size > 8) {
      const half = size / 2;
      const subCoords = [
        [x, y],
        [x + half, y],
        [x, y + half],
        [x + half, y + half]
      ];
      const rawChildren = subCoords.map(([cx, cy]) => buildNode(depth + 1, cx, cy, half, id));
      nodeObj.children = rawChildren.filter(Boolean);
      if (nodeObj.children.length === 0) {
        nodeObj.isSplit = false;
        nodeObj.split = false;
        nodeObj.zScanIndex = leafCounter++;
      }
    } else {
      nodeObj.zScanIndex = leafCounter++;
    }

    return nodeObj;
  }

  const root = buildNode(0, 0, 0, 64, null);
  if (root) root.totalLeaves = leafCounter;
  return root || createEmptyRoot();
}

function createEmptyRoot() {
  return {
    id: 'node_d0_x0_y0',
    parentId: null,
    depth: 0,
    size: 64,
    relX: 0,
    relY: 0,
    absX: 0,
    absY: 0,
    isSplit: false,
    split: false,
    mode: 'INTRA',
    intraDir: null,
    cost: null,
    qp: 32,
    children: [],
    zScanIndex: 0,
    totalLeaves: 1
  };
}

/**
 * Geometric Square Size configuration per Quadtree Depth.
 * Proportional to actual CU pixel dimensions (64 -> 32 -> 16 -> 8).
 * Ratio 8:4:2:1 matches reference Draw.io diagram (520:260:130:65).
 */
export const GEOMETRIC_SQUARE_CONFIG = {
  0: { size: 160, fontSize: 32, label: '64×64', y: 35 },
  1: { size: 80,  fontSize: 22, label: '32×32', y: 240 },
  2: { size: 40,  fontSize: 14, label: '16×16', y: 380 },
  3: { size: 20,  fontSize: 10, label: '8×8',   y: 490 }
};

export const SIBLING_GAPS = {
  1: 36,
  2: 22,
  3: 14
};

/**
 * Computes Reingold-Tilford Geometric Square Layout coordinates.
 * Ensures zero overlapping between branches while keeping square aspect ratio (1:1).
 *
 * @param {Object} root Quadtree root node
 * @param {Object} options Configuration options
 * @returns {Object} Tree layout metadata and flattened nodes/edges
 */
export function computeTreeLayout(root, options = {}) {
  const depthConfig = options.depthConfig || GEOMETRIC_SQUARE_CONFIG;
  const siblingGaps = options.siblingGaps || SIBLING_GAPS;

  const nodes = [];
  const edges = [];

  // Pass 1: Compute required subtree bounding box widths bottom-up (post-order)
  function measureSubtree(node) {
    const nodeSize = depthConfig[node.depth]?.size || 20;

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

  // Pass 2: Position nodes (pre-order)
  function positionSubtree(node, leftBound) {
    const nodeSize = depthConfig[node.depth]?.size || 20;
    const nodeY = depthConfig[node.depth]?.y ?? (node.depth * 130 + 35);
    const gap = siblingGaps[node.depth + 1] ?? 16;

    let nodeX;
    if (!node.children || node.children.length === 0) {
      nodeX = leftBound + (node.subtreeWidth - nodeSize) / 2;
    } else {
      const childrenTotalWidth = node.children.reduce((acc, c, idx) => {
        return acc + c.subtreeWidth + (idx > 0 ? gap : 0);
      }, 0);

      let childLeft = leftBound + (node.subtreeWidth - childrenTotalWidth) / 2;
      node.children.forEach(child => {
        positionSubtree(child, childLeft);
        childLeft += child.subtreeWidth + gap;
      });

      const firstChildCenter = node.children[0].layout.x + node.children[0].layout.size / 2;
      const lastChildCenter = node.children[node.children.length - 1].layout.x + node.children[node.children.length - 1].layout.size / 2;
      nodeX = (firstChildCenter + lastChildCenter) / 2 - nodeSize / 2;
    }

    node.layout = {
      x: nodeX,
      y: nodeY,
      size: nodeSize,
      width: nodeSize,
      height: nodeSize,
      fontSize: depthConfig[node.depth]?.fontSize || 12
    };
  }

  positionSubtree(root, 40);

  // Pass 3: Collect flattened nodes and orthogonal connector edges
  function collect(node) {
    nodes.push(node);

    if (node.children && node.children.length > 0) {
      node.children.forEach((child, childIdx) => {
        edges.push({
          id: `edge_${node.id}_to_${child.id}`,
          sourceId: node.id,
          targetId: child.id,
          childIndex: childIdx,
          startX: node.layout.x + node.layout.size / 2,
          startY: node.layout.y + node.layout.size,
          endX: child.layout.x + child.layout.size / 2,
          endY: child.layout.y
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
    nodes.forEach(n => { n.layout.x += shiftX; });
    edges.forEach(e => { e.startX += shiftX; e.endX += shiftX; });
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
 * Returns color style for a quadtree node based on depth and split state,
 * adhering to the user's Draw.io reference SVG palette.
 */
export function getNodeColorTheme(depth, _isSplit = false) {
  switch (depth) {
    case 0:
      return {
        fill: '#CCE5FF',
        border: 'var(--apple-label, #000000)',
        text: '#002244',
        label: '64×64'
      };
    case 1:
      return {
        fill: '#CCE5FF',
        border: 'var(--apple-label, #000000)',
        text: '#002244',
        label: '32×32'
      };
    case 2:
      return {
        fill: '#66B2FF',
        border: 'var(--apple-label, #000000)',
        text: '#001A33',
        label: '16×16'
      };
    case 3:
    default:
      return {
        fill: '#9999FF',
        border: 'var(--apple-label, #000000)',
        text: '#111029',
        label: '8×8'
      };
  }
}
