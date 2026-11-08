/**
 * tcomDataCUEngine.js
 * High-fidelity modeling of HM-18.0 TComDataCU state and Morton Z-Order (absZIdxInCtu).
 *
 * Implements:
 * 1. Exact 256-entry Morton Z-scan lookup tables: g_auiZscanToRaster & g_auiRasterToZscan (16x16 4x4 units)
 * 2. TComDataCUState class mirroring source/Lib/TLibCommon/TComDataCU.h 1D linear member arrays:
 *    - m_puhDepth: depth per 4x4 partition (0..3)
 *    - m_pePartSize: PartSize enum ('SIZE_2Nx2N', 'SIZE_2NxN', etc.)
 *    - m_pePredMode: PredMode enum ('MODE_INTRA', 'MODE_INTER')
 *    - m_puhCbf: Coded block flag (0 or 1)
 *    - m_phQP: Quantization parameter
 *    - m_puhIntraDir: Intra prediction mode (0..34)
 * 3. Exact SubParts update semantics (setDepthSubParts, setPredModeSubParts, copyToPic)
 * 4. Neighbor availability checkers for m_pCtuAbove, m_pCtuLeft
 * 5. Recursive xCompressCU step generator with HM lifecycle annotations
 */

import {
  computeLambda,
  evaluateCuIntraMode,
  extractRefSamples
} from './hevcRdoSimulator.js';

// Total 4x4 minimum partitions in a 64x64 CTU
export const NUM_PARTITIONS_IN_CTU = 256; // 16 x 16

/**
 * Computes 2D Morton Z-scan index from unit coordinates (ux, uy) in [0..15].
 * Bit-interleaving: Z = sum(x_i * 2^(2i) + y_i * 2^(2i+1))
 */
export function morton2D_16x16(ux, uy) {
  let z = 0;
  for (let i = 0; i < 4; i++) {
    z |= ((ux >> i) & 1) << (2 * i);
    z |= ((uy >> i) & 1) << (2 * i + 1);
  }
  return z;
}

/**
 * Computes unit coordinates (ux, uy) in [0..15] from 2D Morton Z-scan index [0..255].
 */
export function inverseMorton2D_16x16(z) {
  let ux = 0;
  let uy = 0;
  for (let i = 0; i < 4; i++) {
    ux |= ((z >> (2 * i)) & 1) << i;
    uy |= ((z >> (2 * i + 1)) & 1) << i;
  }
  return { ux, uy };
}

// Generate canonical HM lookup tables g_auiZscanToRaster and g_auiRasterToZscan
export const g_auiZscanToRaster = new Uint16Array(NUM_PARTITIONS_IN_CTU);
export const g_auiRasterToZscan = new Uint16Array(NUM_PARTITIONS_IN_CTU);

for (let uy = 0; uy < 16; uy++) {
  for (let ux = 0; ux < 16; ux++) {
    const rasterIdx = uy * 16 + ux;
    const zIdx = morton2D_16x16(ux, uy);
    g_auiZscanToRaster[zIdx] = rasterIdx;
    g_auiRasterToZscan[rasterIdx] = zIdx;
  }
}

/**
 * Returns the Morton Z-scan start index and index range for a CU of size `size` at (relX, relY).
 * Inside a 64x64 CTU, any aligned 2^k x 2^k CU occupies a CONTIGUOUS range of Morton indices:
 * [startZIdx, startZIdx + numParts - 1]
 */
export function getCuMortonRange(relX, relY, size) {
  const ux = Math.floor(Math.max(0, Math.min(60, relX)) / 4);
  const uy = Math.floor(Math.max(0, Math.min(60, relY)) / 4);
  const startZIdx = morton2D_16x16(ux, uy);
  const partsPerSide = Math.floor(size / 4);
  const numParts = partsPerSide * partsPerSide;
  return {
    startZIdx,
    numParts,
    endZIdx: startZIdx + numParts - 1,
  };
}

/**
 * TComDataCUState
 * Replicates the in-memory state of a single CTU (64x64) in HM-18.0.
 */
export class TComDataCUState {
  constructor({ ctuRsAddr = 0, ctuX = 0, ctuY = 0, qp = 32 } = {}) {
    this.m_ctuRsAddr = ctuRsAddr;
    this.m_ctuX = ctuX;
    this.m_ctuY = ctuY;
    this.m_uiCUPelX = ctuX * 64;
    this.m_uiCUPelY = ctuY * 64;

    // 1D Linear arrays of size 256, indexed strictly by absZIdxInCtu
    this.m_puhDepth = new Uint8Array(NUM_PARTITIONS_IN_CTU).fill(0);
    this.m_pePartSize = new Array(NUM_PARTITIONS_IN_CTU).fill('SIZE_2Nx2N');
    this.m_pePredMode = new Array(NUM_PARTITIONS_IN_CTU).fill('MODE_INTRA');
    this.m_puhCbf = new Uint8Array(NUM_PARTITIONS_IN_CTU).fill(0);
    this.m_phQP = new Int8Array(NUM_PARTITIONS_IN_CTU).fill(qp);
    this.m_puhIntraDir = new Uint8Array(NUM_PARTITIONS_IN_CTU).fill(0);

    // RD decision state
    this.m_dTotalCost = 0;
    this.m_uiTotalDistortion = 0;
    this.m_uiTotalBits = 0;
  }

  clone() {
    const copy = new TComDataCUState({
      ctuRsAddr: this.m_ctuRsAddr,
      ctuX: this.m_ctuX,
      ctuY: this.m_ctuY,
      qp: this.m_phQP[0],
    });
    copy.m_uiCUPelX = this.m_uiCUPelX;
    copy.m_uiCUPelY = this.m_uiCUPelY;
    copy.m_puhDepth.set(this.m_puhDepth);
    copy.m_pePartSize = [...this.m_pePartSize];
    copy.m_pePredMode = [...this.m_pePredMode];
    copy.m_puhCbf.set(this.m_puhCbf);
    copy.m_phQP.set(this.m_phQP);
    copy.m_puhIntraDir.set(this.m_puhIntraDir);
    copy.m_dTotalCost = this.m_dTotalCost;
    copy.m_uiTotalDistortion = this.m_uiTotalDistortion;
    copy.m_uiTotalBits = this.m_uiTotalBits;
    return copy;
  }

  /**
   * Corresponds to HM: TComDataCU::setDepthSubParts(UInt uiDepth, UInt uiAbsPartIdx)
   */
  setDepthSubParts(depth, absZIdx, size) {
    const partsPerSide = Math.floor(size / 4);
    const count = partsPerSide * partsPerSide;
    for (let i = 0; i < count; i++) {
      this.m_puhDepth[absZIdx + i] = depth;
    }
  }

  /**
   * Corresponds to HM: TComDataCU::setPredModeSubParts(PredMode eMode, UInt uiAbsPartIdx)
   */
  setPredModeSubParts(mode, absZIdx, size) {
    const count = Math.floor(size / 4) * Math.floor(size / 4);
    for (let i = 0; i < count; i++) {
      this.m_pePredMode[absZIdx + i] = mode;
    }
  }

  /**
   * Corresponds to HM: TComDataCU::setPartSizeSubParts(PartSize eMode, UInt uiAbsPartIdx)
   */
  setPartSizeSubParts(partSize, absZIdx, size) {
    const count = Math.floor(size / 4) * Math.floor(size / 4);
    for (let i = 0; i < count; i++) {
      this.m_pePartSize[absZIdx + i] = partSize;
    }
  }

  /**
   * Corresponds to HM: TComDataCU::setCbfSubParts(UInt uiCbf, ComponentID compID, UInt uiAbsPartIdx, UInt uiDepth)
   */
  setCbfSubParts(cbf, absZIdx, size) {
    const count = Math.floor(size / 4) * Math.floor(size / 4);
    for (let i = 0; i < count; i++) {
      this.m_puhCbf[absZIdx + i] = cbf;
    }
  }

  /**
   * Corresponds to HM: TComDataCU::setIntraDirSubParts(UChar uhDir, UInt uiAbsPartIdx, UInt uiDepth)
   */
  setIntraDirSubParts(intraDir, absZIdx, size) {
    const count = Math.floor(size / 4) * Math.floor(size / 4);
    for (let i = 0; i < count; i++) {
      this.m_puhIntraDir[absZIdx + i] = intraDir;
    }
  }

  /**
   * Checks neighbor availability for a CU block at (relX, relY) of size `size`.
   * Returns metadata matching HM member pointers: m_pCtuAbove, m_pCtuLeft, m_pCtuAboveLeft, m_pCtuAboveRight
   */
  checkNeighborAvailability(relX, relY, _size, imageDims = { width: 640, height: 360 }) {

    // Above neighbor
    let above = { available: false, type: 'UNKNOWN', label: 'm_pCtuAbove' };
    if (relY > 0) {
      above = { available: true, type: 'INTRA_CTU', label: 'this (Above SubCU)' };
    } else {
      // Top row of CTU: depends on m_pCtuAbove pointer
      if (this.m_ctuY === 0) {
        above = { available: false, type: 'FRAME_BOUNDARY', label: 'NULL (Frame Top Boundary)' };
      } else {
        above = { available: true, type: 'INTER_CTU', label: `m_pictureCtuArray[${this.m_ctuRsAddr - Math.ceil(imageDims.width / 64)}]` };
      }
    }

    // Left neighbor
    let left = { available: false, type: 'UNKNOWN', label: 'm_pCtuLeft' };
    if (relX > 0) {
      left = { available: true, type: 'INTRA_CTU', label: 'this (Left SubCU)' };
    } else {
      // Leftmost column of CTU: depends on m_pCtuLeft pointer
      if (this.m_ctuX === 0) {
        left = { available: false, type: 'FRAME_BOUNDARY', label: 'NULL (Frame Left Boundary)' };
      } else {
        left = { available: true, type: 'INTER_CTU', label: `m_pictureCtuArray[${this.m_ctuRsAddr - 1}]` };
      }
    }

    // Above-Left neighbor
    let aboveLeft = { available: false, type: 'UNKNOWN', label: 'm_pCtuAboveLeft' };
    if (relX > 0 && relY > 0) {
      aboveLeft = { available: true, type: 'INTRA_CTU', label: 'this (Above-Left SubCU)' };
    } else if (relX === 0 && relY === 0) {
      if (this.m_ctuX === 0 || this.m_ctuY === 0) {
        aboveLeft = { available: false, type: 'FRAME_BOUNDARY', label: 'NULL (Boundary)' };
      } else {
        aboveLeft = { available: true, type: 'INTER_CTU', label: 'm_pCtuAboveLeft (CTU Top-Left)' };
      }
    } else if (relX === 0) {
      aboveLeft = this.m_ctuX === 0 ? { available: false, type: 'FRAME_BOUNDARY', label: 'NULL' } : { available: true, type: 'INTER_CTU', label: 'm_pCtuLeft' };
    } else {
      aboveLeft = this.m_ctuY === 0 ? { available: false, type: 'FRAME_BOUNDARY', label: 'NULL' } : { available: true, type: 'INTER_CTU', label: 'm_pCtuAbove' };
    }

    return { above, left, aboveLeft };
  }
}

/**
 * High-fidelity xCompressCU recursive simulation strictly producing HM TComDataCU snapshots.
 */
export function runTComDataCUSimulation({
  ctuPatch, // 64x64 1D array of original pixels
  qp = 32,
  ctuX = 0,
  ctuY = 0,
  imageDims = { width: 640, height: 360 },
  forcedMode = null,
  groundTruthNodes = null,
  rdoDecisions = null,
  candidateDetails = null,
}) {
  const ctuSize = 64;
  const numCols = Math.max(1, Math.ceil((imageDims?.width || 640) / 64));
  const ctuRsAddr = ctuY * numCols + ctuX;
  const qpVal = Math.max(10, Math.min(51, qp));
  const lambda = computeLambda(qpVal);

  const tcomDataCU = new TComDataCUState({
    ctuRsAddr,
    ctuX,
    ctuY,
    qp: qpVal,
  });

  const steps = [];
  const recoBuffer = new Uint8ClampedArray(ctuSize * ctuSize).fill(128);
  const candidateModes = forcedMode !== null ? [forcedMode] : [0, 1, 10, 26];

  // Map ground truth nodes from full HM encoder (CU Quadtree)
  const gtMap = new Map();
  if (Array.isArray(groundTruthNodes) && groundTruthNodes.length > 0) {
    for (const gn of groundTruthNodes) {
      const relX = gn.rel_x !== undefined ? gn.rel_x : ((gn.x ?? 0) % ctuSize);
      const relY = gn.rel_y !== undefined ? gn.rel_y : ((gn.y ?? 0) % ctuSize);
      gtMap.set(`node_${gn.depth}_${relX}_${relY}`, gn);
      gtMap.set(`node_d${gn.depth}_x${relX}_y${relY}`, gn);
    }
  }

  // Map verified CU_RDO_DECISION checkpoints from HM xCheckBestMode
  const rdoDecisionMap = new Map();
  if (Array.isArray(rdoDecisions) && rdoDecisions.length > 0) {
    for (const d of rdoDecisions) {
      const relX = d.cu_x !== undefined ? (d.cu_x % ctuSize) : 0;
      const relY = d.cu_y !== undefined ? (d.cu_y % ctuSize) : 0;
      const sz = d.cu_size || (64 >> (d.depth || 0));
      rdoDecisionMap.set(`${relX}_${relY}_${sz}`, d);
      rdoDecisionMap.set(`node_${d.depth}_${relX}_${relY}`, d);
    }
  }

  const candDetailsMap = new Map();
  if (Array.isArray(candidateDetails) && candidateDetails.length > 0) {
    for (const c of candidateDetails) {
      candDetailsMap.set(c.mode, c);
    }
  }

  const treeNodes = {};
  const currentStack = [];

  function getOrigSubBlock(x, y, size) {
    const block = new Uint8ClampedArray(size * size);
    for (let r = 0; r < size; r++) {
      const ctuRowOff = (y + r) * ctuSize + x;
      const bRowOff = r * size;
      for (let c = 0; c < size; c++) {
        block[bRowOff + c] = ctuPatch[ctuRowOff + c] ?? 128;
      }
    }
    return block;
  }

  function snapshotTree() {
    const snap = {};
    for (const id in treeNodes) {
      snap[id] = { ...treeNodes[id] };
    }
    return snap;
  }

  // Recursive xCompressCU
  function xCompressCU(depth, x, y, size, parentId = null, childIndex = 0) {
    const nodeId = `node_${depth}_${x}_${y}`;
    const mortonRange = getCuMortonRange(x, y, size);
    const neighbors = tcomDataCU.checkNeighborAvailability(x, y, size, imageDims);

    // Physical boundary checks
    const absPixelX = tcomDataCU.m_uiCUPelX + x;
    const absPixelY = tcomDataCU.m_uiCUPelY + y;
    const bBoundary = (absPixelX + size > imageDims.width) || (absPixelY + size > imageDims.height);
    const bForceSplit = bBoundary && (depth < 3) && (size > 8);

    const nodeMeta = {
      id: nodeId,
      depth,
      x,
      y,
      size,
      parentId,
      childIndex,
      mortonRange,
      status: 'VISITING',
      bestMode: null,
      jNonSplit: 0,
      jSplit: 0,
      decision: null,
      bBoundary,
      bForceSplit,
      children: [],
    };
    treeNodes[nodeId] = nodeMeta;
    if (parentId && treeNodes[parentId]) {
      treeNodes[parentId].children.push(nodeId);
    }

    currentStack.push(nodeMeta);
    const origBlock = getOrigSubBlock(x, y, size);
    const { refTop, refLeft } = extractRefSamples(x, y, size, recoBuffer, ctuSize);

    // STEP 1: VISIT_NODE (HM: xCompressCU enter)
    steps.push({
      stepId: steps.length,
      type: 'VISIT_NODE',
      hmLifecycle: `xCompressCU(uiDepth=${depth}, absZIdx=${mortonRange.startZIdx})`,
      title: `Visit CU ${size}×${size} (Depth ${depth})`,
      description: `Target (${x}, ${y}) • Z-order [${mortonRange.startZIdx}..${mortonRange.endZIdx}] (${mortonRange.numParts} units)`,
      node: { ...nodeMeta },
      depth,
      size,
      x,
      y,
      mortonRange,
      neighbors,
      bBoundary,
      bForceSplit,
      callStack: [...currentStack],
      origBlock,
      refTop,
      refLeft,
      activeModeEval: null,
      allEvaluations: [],
      jNonSplit: 0,
      jSplit: 0,
      decision: null,
      treeSnapshot: snapshotTree(),
      tcomDataCUSnapshot: tcomDataCU.clone(),
    });

    // STEP 2: EVALUATE MODES (HM: xCheckBestMode / xCheckRDOIntra)
    let bestEval = null;
    let lightweightEvaluations = [];

    if (!bForceSplit) {
      nodeMeta.status = 'EVALUATING';
      const evaluations = candidateModes.map(m => {
        const cand = candDetailsMap.get(m);
        return evaluateCuIntraMode({
          mode: m,
          size,
          origBlock,
          refTop,
          refLeft,
          qp: qpVal,
          traceCandidate: cand,
        });
      });

      evaluations.sort((a, b) => a.cost - b.cost);
      bestEval = evaluations[0];
      nodeMeta.bestMode = {
        mode: bestEval.mode,
        modeName: bestEval.modeName,
        cost: bestEval.cost,
        ssd: bestEval.ssd,
        bits: bestEval.bits,
      };
      nodeMeta.jNonSplit = bestEval.cost;

      lightweightEvaluations = evaluations.map(e => ({
        mode: e.mode,
        modeName: e.modeName,
        cost: e.cost,
        ssd: e.ssd,
        bits: e.bits,
        nonzeroCount: e.nonzeroCount,
      }));

      steps.push({
        stepId: steps.length,
        type: 'EVAL_NONSPLIT',
        hmLifecycle: `xCheckRDOIntra(SIZE_2Nx2N, ${bestEval.modeName})`,
        title: `Test ${bestEval.modeName} (${size}×${size})`,
        description: `J_nosplit = ${bestEval.cost.toLocaleString()} (D=${bestEval.ssd.toLocaleString()}, R=${bestEval.bits}b)`,
        node: { ...nodeMeta },
        depth,
        size,
        x,
        y,
        mortonRange,
        neighbors,
        bBoundary,
        bForceSplit,
        callStack: [...currentStack],
        origBlock,
        refTop,
        refLeft,
        activeModeEval: bestEval,
        allEvaluations: lightweightEvaluations,
        jNonSplit: bestEval.cost,
        jSplit: 0,
        decision: null,
        treeSnapshot: snapshotTree(),
        tcomDataCUSnapshot: tcomDataCU.clone(),
      });
    } else {
      // Boundary forced split: J_nosplit is Infinity
      nodeMeta.jNonSplit = Infinity;
      nodeMeta.bestMode = { mode: 0, modeName: 'Forced Split', cost: Infinity, ssd: 0, bits: 0 };
    }

    // CHECK IF LEAF (Depth 3 = 8x8 CU in HEVC)
    const gtNode = gtMap.get(nodeId);
    const rdoDec = rdoDecisionMap.get(`${x}_${y}_${size}`) || rdoDecisionMap.get(nodeId);

    if (depth >= 3 || size <= 8) {
      nodeMeta.status = 'LEAF';
      nodeMeta.decision = 'KEEP';
      nodeMeta.jSplit = Infinity;

      if (rdoDec) {
        nodeMeta.jNonSplit = rdoDec.nosplit?.cost ?? rdoDec.cost_nosplit ?? (bestEval?.cost || 0);
      } else if (gtNode && gtNode.cost !== undefined && gtNode.cost !== null) {
        nodeMeta.jNonSplit = Number(gtNode.cost);
      }

      // Update TComDataCU 1D arrays for this leaf CU!
      tcomDataCU.setDepthSubParts(depth, mortonRange.startZIdx, size);
      tcomDataCU.setPredModeSubParts('MODE_INTRA', mortonRange.startZIdx, size);
      tcomDataCU.setPartSizeSubParts('SIZE_2Nx2N', mortonRange.startZIdx, size);
      tcomDataCU.setCbfSubParts(bestEval && bestEval.nonzeroCount > 0 ? 1 : 0, mortonRange.startZIdx, size);
      tcomDataCU.setIntraDirSubParts(bestEval ? bestEval.mode : 0, mortonRange.startZIdx, size);

      // Copy reconstruction to recoBuffer
      if (bestEval) {
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            recoBuffer[(y + r) * ctuSize + (x + c)] = bestEval.reco[r * size + c];
          }
        }
      }

      steps.push({
        stepId: steps.length,
        type: 'DECISION',
        hmLifecycle: `rpcBestCU->copyToPic(uiDepth=${depth}) [Leaf CU]`,
        title: `Leaf CU ${size}×${size} (Max Depth)`,
        description: `Commit to m_puhDepth: depth=${depth}, Z-range [${mortonRange.startZIdx}..${mortonRange.endZIdx}]`,
        node: { ...nodeMeta },
        depth,
        size,
        x,
        y,
        mortonRange,
        neighbors,
        bBoundary,
        bForceSplit,
        callStack: [...currentStack],
        origBlock,
        refTop,
        refLeft,
        activeModeEval: bestEval,
        allEvaluations: lightweightEvaluations,
        jNonSplit: nodeMeta.jNonSplit || (bestEval?.cost || 0),
        jSplit: Infinity,
        decision: 'KEEP',
        treeSnapshot: snapshotTree(),
        tcomDataCUSnapshot: tcomDataCU.clone(),
      });

      currentStack.pop();
      return { cost: nodeMeta.jNonSplit || (bestEval?.cost || 0), isSplit: false, evalData: bestEval };
    }

    // STEP 3: RECURSIVE QUAD-SPLIT
    const half = size / 2;
    const subCus = [
      { q: 0, sx: x, sy: y, label: 'Sub-CU 0 (Top-Left)' },
      { q: 1, sx: x + half, sy: y, label: 'Sub-CU 1 (Top-Right)' },
      { q: 2, sx: x, sy: y + half, label: 'Sub-CU 2 (Bottom-Left)' },
      { q: 3, sx: x + half, sy: y + half, label: 'Sub-CU 3 (Bottom-Right)' },
    ];

    steps.push({
      stepId: steps.length,
      type: 'RECURSE_START',
      hmLifecycle: `xCompressCU: Recurse into 4 Sub-CUs (halfSize=${half})`,
      title: `Quad-Split Test (${size}×${size})`,
      description: bForceSplit
        ? 'Forced Split due to picture boundary condition (bBoundary=true)'
        : `Comparing J_nosplit (${bestEval?.cost.toLocaleString()}) vs 4x Sub-CUs (${half}×${half})`,
      node: { ...nodeMeta },
      depth,
      size,
      x,
      y,
      mortonRange,
      neighbors,
      bBoundary,
      bForceSplit,
      callStack: [...currentStack],
      origBlock,
      refTop,
      refLeft,
      activeModeEval: bestEval,
      allEvaluations: lightweightEvaluations,
      jNonSplit: bestEval?.cost || Infinity,
      jSplit: 0,
      decision: null,
      treeSnapshot: snapshotTree(),
      tcomDataCUSnapshot: tcomDataCU.clone(),
    });

    let sumSubCuCosts = 0;
    const childResults = [];

    for (let i = 0; i < 4; i++) {
      const sub = subCus[i];
      const childRes = xCompressCU(depth + 1, sub.sx, sub.sy, half, nodeId, i);
      childResults.push(childRes);
      sumSubCuCosts += childRes.cost;
    }

    // STEP 4: BOTTOM-UP BACKTRACKING & RDO COMPARISON
    const splitFlagBits = 1;
    const splitCostOverhead = splitFlagBits * lambda;
    const jSplit = sumSubCuCosts + splitCostOverhead;
    nodeMeta.jSplit = jSplit;

    const jNonSplit = nodeMeta.jNonSplit || (bestEval?.cost ?? Infinity);
    const shouldSplit = bForceSplit || (jSplit < jNonSplit);

    nodeMeta.decision = shouldSplit ? 'SPLIT' : 'KEEP';
    nodeMeta.status = shouldSplit ? 'SPLIT' : 'LEAF';

    if (!shouldSplit && bestEval) {
      // NO-SPLIT wins! Overwrite 1D arrays for the parent CU!
      tcomDataCU.setDepthSubParts(depth, mortonRange.startZIdx, size);
      tcomDataCU.setPredModeSubParts('MODE_INTRA', mortonRange.startZIdx, size);
      tcomDataCU.setPartSizeSubParts('SIZE_2Nx2N', mortonRange.startZIdx, size);
      tcomDataCU.setCbfSubParts(bestEval.nonzeroCount > 0 ? 1 : 0, mortonRange.startZIdx, size);
      tcomDataCU.setIntraDirSubParts(bestEval.mode, mortonRange.startZIdx, size);

      // Overwrite recoBuffer with parent reconstruction
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          recoBuffer[(y + r) * ctuSize + (x + c)] = bestEval.reco[r * size + c];
        }
      }
    }

    const winnerCost = shouldSplit ? jSplit : jNonSplit;

    steps.push({
      stepId: steps.length,
      type: 'DECISION',
      hmLifecycle: shouldSplit
        ? `xCheckBestMode: SPLIT wins (J_split=${Math.round(jSplit)} < J_nosplit=${Math.round(jNonSplit)})`
        : `xCheckBestMode: NO-SPLIT wins -> rpcBestCU->copyToPic(uiDepth=${depth})`,
      title: `RDO Decision: ${shouldSplit ? 'SPLIT 4 Sub-CUs' : 'KEEP Single CU'}`,
      description: shouldSplit
        ? `Split cost ${Math.round(jSplit).toLocaleString()} < No-split cost ${Math.round(jNonSplit).toLocaleString()}`
        : `No-split cost ${Math.round(jNonSplit).toLocaleString()} <= Split cost ${Math.round(jSplit).toLocaleString()}`,
      node: { ...nodeMeta },
      depth,
      size,
      x,
      y,
      mortonRange,
      neighbors,
      bBoundary,
      bForceSplit,
      callStack: [...currentStack],
      origBlock,
      refTop,
      refLeft,
      activeModeEval: bestEval,
      allEvaluations: lightweightEvaluations,
      jNonSplit,
      jSplit,
      decision: nodeMeta.decision,
      treeSnapshot: snapshotTree(),
      tcomDataCUSnapshot: tcomDataCU.clone(),
    });

    currentStack.pop();
    return { cost: winnerCost, isSplit: shouldSplit, evalData: bestEval };
  }

  // Execute from root CU 64x64 at Depth 0
  xCompressCU(0, 0, 0, ctuSize, null, 0);

  return {
    steps,
    finalTComDataCU: tcomDataCU,
    totalSteps: steps.length,
    recoBuffer,
    ctuRsAddr,
  };
}
