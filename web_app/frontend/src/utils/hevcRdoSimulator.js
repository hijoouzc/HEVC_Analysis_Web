/**
 * hevcRdoSimulator.js
 * Pure in-browser simulation of HEVC/H.265 recursive quadtree partitioning
 * based strictly on HM Reference Software: TEncCu::xCompressCU
 *
 * Implements:
 * 1. 2D Integer/Orthonormal DCT-II & IDCT-II for 32x32, 16x16, 8x8, 4x4
 * 2. 64x64 split into 4x 32x32 DCTs (HEVC MaxTrSize = 32)
 * 3. Intra Prediction: Planar (0), DC (1), Horizontal (10), Vertical (26)
 * 4. Inter-CU reconstruction buffer updates for subsequent sub-CU references
 * 5. Quantization: Qstep = 2^((QP - 4)/6)
 * 6. Reconstruction: Reco = Clip(Pred + IDCT(Dequant(Quant)))
 * 7. Rate-Distortion Optimization: J = D + lambda * R
 * 8. Recursive Bottom-Up Call Stack step generator
 */

// Clamp helper
export const clamp = (val, min = 0, max = 255) => Math.max(min, Math.min(max, Math.round(val)));

// 1D Flat DCT-II basis matrix generator
function createFlatDctMatrix(N) {
  const flat = new Float32Array(N * N);
  const factor = Math.PI / (2 * N);
  for (let u = 0; u < N; u++) {
    const alpha = u === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
    for (let x = 0; x < N; x++) {
      flat[u * N + x] = alpha * Math.cos((2 * x + 1) * u * factor);
    }
  }
  return flat;
}

const FLAT_DCT_CACHE = {
  4: createFlatDctMatrix(4),
  8: createFlatDctMatrix(8),
  16: createFlatDctMatrix(16),
  32: createFlatDctMatrix(32),
};

// Static scratchpad buffers for zero-allocation RDO evaluations & DCT transforms
const DCT_TEMP = new Float32Array(32 * 32);
const SUB_BLOCK_TEMP = new Float32Array(32 * 32);
const SUB_COEFF_TEMP = new Float32Array(32 * 32);

const SCRATCH_PRED = new Uint8ClampedArray(64 * 64);
const SCRATCH_RESI = new Int16Array(64 * 64);
const SCRATCH_QUANT = new Int16Array(64 * 64);
const SCRATCH_DEQUANT = new Float32Array(64 * 64);
const SCRATCH_RECO = new Uint8ClampedArray(64 * 64);

/**
 * 2D DCT-II Transform: Coeff = C * Block * C^T
 */
export function forwardDct2D(block, size) {
  if (size === 64) {
    // HEVC MaxTrSize = 32: partition 64x64 into 4x 32x32 DCTs
    const half = 32;
    const result = new Float32Array(64 * 64);
    for (let q = 0; q < 4; q++) {
      const qx = (q % 2) * half;
      const qy = Math.floor(q / 2) * half;
      for (let y = 0; y < half; y++) {
        const rowOff = (qy + y) * 64 + qx;
        const subRowOff = y * half;
        for (let x = 0; x < half; x++) {
          SUB_BLOCK_TEMP[subRowOff + x] = block[rowOff + x];
        }
      }
      const subDct = forwardDct2D(SUB_BLOCK_TEMP, half);
      for (let y = 0; y < half; y++) {
        const rowOff = (qy + y) * 64 + qx;
        const subRowOff = y * half;
        for (let x = 0; x < half; x++) {
          result[rowOff + x] = subDct[subRowOff + x];
        }
      }
    }
    return result;
  }

  const C = FLAT_DCT_CACHE[size] || createFlatDctMatrix(size);
  const N = size;
  const result = new Float32Array(N * N);

  // temp = C * block
  for (let u = 0; u < N; u++) {
    const uN = u * N;
    for (let j = 0; j < N; j++) {
      let sum = 0;
      for (let k = 0; k < N; k++) {
        sum += C[uN + k] * block[k * N + j];
      }
      DCT_TEMP[uN + j] = sum;
    }
  }

  // result = temp * C^T
  for (let u = 0; u < N; u++) {
    const uN = u * N;
    for (let v = 0; v < N; v++) {
      const vN = v * N;
      let sum = 0;
      for (let k = 0; k < N; k++) {
        sum += DCT_TEMP[uN + k] * C[vN + k];
      }
      result[uN + v] = sum;
    }
  }

  return result;
}

/**
 * 2D IDCT-II Inverse Transform: Block = C^T * Coeff * C
 */
export function inverseDct2D(coeff, size) {
  if (size === 64) {
    const half = 32;
    const result = new Int16Array(64 * 64);
    for (let q = 0; q < 4; q++) {
      const qx = (q % 2) * half;
      const qy = Math.floor(q / 2) * half;
      for (let y = 0; y < half; y++) {
        const rowOff = (qy + y) * 64 + qx;
        const subRowOff = y * half;
        for (let x = 0; x < half; x++) {
          SUB_COEFF_TEMP[subRowOff + x] = coeff[rowOff + x];
        }
      }
      const subIdct = inverseDct2D(SUB_COEFF_TEMP, half);
      for (let y = 0; y < half; y++) {
        const rowOff = (qy + y) * 64 + qx;
        const subRowOff = y * half;
        for (let x = 0; x < half; x++) {
          result[rowOff + x] = subIdct[subRowOff + x];
        }
      }
    }
    return result;
  }

  const C = FLAT_DCT_CACHE[size] || createFlatDctMatrix(size);
  const N = size;
  const result = new Int16Array(N * N);

  // temp = C^T * coeff
  for (let i = 0; i < N; i++) {
    const iN = i * N;
    for (let v = 0; v < N; v++) {
      let sum = 0;
      for (let k = 0; k < N; k++) {
        sum += C[k * N + i] * coeff[k * N + v];
      }
      DCT_TEMP[iN + v] = sum;
    }
  }

  // result = temp * C
  for (let i = 0; i < N; i++) {
    const iN = i * N;
    for (let j = 0; j < N; j++) {
      let sum = 0;
      for (let k = 0; k < N; k++) {
        sum += DCT_TEMP[iN + k] * C[k * N + j];
      }
      result[iN + j] = Math.round(sum);
    }
  }

  return result;
}

/**
 * Computes HEVC step size according to standard:
 * Qstep = 2^((QP - 4) / 6)
 */
export function computeQstep(qp) {
  return Math.pow(2, (qp - 4) / 6.0);
}

/**
 * Computes Lagrange multiplier for Mode decision:
 * lambda = 0.57 * 2^((QP - 12) / 3.0)
 */
export function computeLambda(qp) {
  return 0.57 * Math.pow(2, (qp - 12) / 3.0);
}

/**
 * Generates Intra Prediction block:
 * modes supported:
 *  0: Planar
 *  1: DC
 *  10: Horizontal
 *  26: Vertical
 */
export function generateIntraPrediction(mode, size, refTop, refLeft, outPred = null) {
  const N = size;
  const numPixels = N * N;
  const pred = outPred || new Uint8ClampedArray(numPixels);
  const top = refTop;
  const left = refLeft;

  if (mode === 1) {
    // DC mode: average of N top samples and N left samples
    let sum = 0;
    for (let i = 1; i <= N; i++) {
      sum += (top[i] ?? 128) + (left[i] ?? 128);
    }
    const dcVal = clamp(Math.round(sum / (2 * N)));
    pred.fill(dcVal, 0, numPixels);
  } else if (mode === 26) {
    // Vertical mode: column copy
    for (let y = 0; y < N; y++) {
      const rowOff = y * N;
      for (let x = 0; x < N; x++) {
        pred[rowOff + x] = clamp(top[x + 1] ?? 128);
      }
    }
  } else if (mode === 10) {
    // Horizontal mode: row copy
    for (let y = 0; y < N; y++) {
      const val = clamp(left[y + 1] ?? 128);
      pred.fill(val, y * N, y * N + N);
    }
  } else {
    // Planar mode (mode 0): Bi-linear interpolation
    const topRight = top[N + 1] ?? top[N] ?? 128;
    const bottomLeft = left[N + 1] ?? left[N] ?? 128;
    const log2Shift = ((Math.log2(N) | 0) + 1);

    for (let y = 0; y < N; y++) {
      const leftVal = left[y + 1] ?? 128;
      const yTerm = (y + 1) * bottomLeft;
      const yTopWeight = N - 1 - y;
      const rowOff = y * N;
      for (let x = 0; x < N; x++) {
        const topVal = top[x + 1] ?? 128;
        const val = ((N - 1 - x) * leftVal + (x + 1) * topRight +
                     yTopWeight * topVal + yTerm + N) >> log2Shift;
        pred[rowOff + x] = clamp(val);
      }
    }
  }

  return pred;
}

/**
 * Extracts reference samples for a block from the active reconstruction buffer
 */
export function extractRefSamples(relX, relY, size, recoBuffer, ctuSize = 64) {
  const N = size;
  const refTop = new Uint8ClampedArray(2 * N + 1);
  const refLeft = new Uint8ClampedArray(2 * N + 1);

  // Corner [-1, -1]
  const cornerY = relY - 1;
  const cornerX = relX - 1;
  const cornerVal = (cornerY >= 0 && cornerX >= 0) ? recoBuffer[cornerY * ctuSize + cornerX] : 128;
  refTop[0] = cornerVal;
  refLeft[0] = cornerVal;

  // Top samples
  const topY = relY - 1;
  for (let x = 0; x < 2 * N; x++) {
    const curX = relX + x;
    if (topY >= 0 && curX < ctuSize) {
      refTop[x + 1] = recoBuffer[topY * ctuSize + curX];
    } else if (topY >= 0 && curX >= ctuSize) {
      refTop[x + 1] = refTop[x]; // edge replication
    } else {
      refTop[x + 1] = 128;
    }
  }

  // Left samples
  const leftX = relX - 1;
  for (let y = 0; y < 2 * N; y++) {
    const curY = relY + y;
    if (leftX >= 0 && curY < ctuSize) {
      refLeft[y + 1] = recoBuffer[curY * ctuSize + leftX];
    } else if (leftX >= 0 && curY >= ctuSize) {
      refLeft[y + 1] = refLeft[y]; // edge replication
    } else {
      refLeft[y + 1] = 128;
    }
  }

  return { refTop, refLeft };
}

/**
 * Evaluates an Intra mode for a given CU block using zero-allocation scratchpads
 */
export function evaluateCuIntraMode({
  mode,
  size,
  origBlock,
  refTop,
  refLeft,
  qp,
  traceCandidate = null
}) {
  const N = size;
  const numPixels = N * N;
  const qstep = computeQstep(qp);
  const lambda = computeLambda(qp);

  const modeNames = {
    0: 'Planar (0)',
    1: 'DC (1)',
    10: 'Horizontal (10)',
    26: 'Vertical (26)'
  };
  const modeName = traceCandidate?.direction_name || modeNames[mode] || `Mode ${mode}`;

  // Priority: Use real HM encoder trace data if available
  if (traceCandidate && (traceCandidate.data_source === 'HM_TRACE' || traceCandidate.pred_data?.length > 0 || traceCandidate.cost_rdo !== undefined)) {
    const pred = (traceCandidate.pred_data && traceCandidate.pred_data.length === numPixels)
      ? traceCandidate.pred_data
      : null;
    const reco = (traceCandidate.reconstructed_data && traceCandidate.reconstructed_data.length === numPixels)
      ? traceCandidate.reconstructed_data
      : null;
    const resi = (traceCandidate.reconstructed_resi && traceCandidate.reconstructed_resi.length === numPixels)
      ? traceCandidate.reconstructed_resi
      : (pred && origBlock && origBlock.length === numPixels ? Array.from(origBlock).map((v, i) => v - pred[i]) : null);

    const ssd = traceCandidate.sse !== undefined ? traceCandidate.sse : (traceCandidate.distortion || 0);
    // Real HM RDO rate estimate: (J - D)/lambda
    const bits = traceCandidate.rdo_rate_est !== undefined ? traceCandidate.rdo_rate_est : (traceCandidate.bits || 0);
    const cost = traceCandidate.cost_rdo !== undefined ? traceCandidate.cost_rdo : (traceCandidate.cost || 0);

    return {
      mode,
      modeName,
      pred: pred || SCRATCH_PRED.slice(0, numPixels),
      resi: resi || SCRATCH_RESI.slice(0, numPixels),
      dctCoeff: new Float32Array(numPixels),
      quantCoeff: new Int32Array(numPixels),
      resiReco: resi || new Int32Array(numPixels),
      reco: reco || (pred || SCRATCH_RECO.slice(0, numPixels)),
      ssd,
      nonzeroCount: 0,
      bits: Math.round(bits * 10) / 10,
      cost: Math.round(cost * 10) / 10,
      lambda: Math.round(lambda * 100) / 100,
      qstep: Math.round(qstep * 100) / 100,
      is_winner: Boolean(traceCandidate.is_winner),
      isTraceRecord: true,
      dataSource: 'HM_TRACE',
      hasData: Boolean(pred)
    };
  }

  // Fallback: Synthetic Sandbox Simulation
  // 1. Prediction written directly into SCRATCH_PRED (zero allocation)
  generateIntraPrediction(mode, N, refTop, refLeft, SCRATCH_PRED);

  // 2. Residual directly into SCRATCH_RESI (zero allocation)
  for (let i = 0; i < numPixels; i++) {
    SCRATCH_RESI[i] = origBlock[i] - SCRATCH_PRED[i];
  }

  // 3. DCT-II: uses flat cache + scratchpad
  const dctCoeff = forwardDct2D(SCRATCH_RESI.subarray(0, numPixels), N);

  // 4. Quantization directly into SCRATCH_QUANT & SCRATCH_DEQUANT (zero allocation)
  let nonzeroCount = 0;
  let coeffBits = 0;
  for (let i = 0; i < numPixels; i++) {
    const qVal = Math.round(dctCoeff[i] / qstep);
    SCRATCH_QUANT[i] = qVal;
    SCRATCH_DEQUANT[i] = qVal * qstep;
    if (qVal !== 0) {
      nonzeroCount++;
      coeffBits += 1 + Math.ceil(Math.log2(Math.abs(qVal) + 1));
    }
  }

  // 5. Reconstruction: IDCT -> Resi' -> Reco = Clip(Pred + Resi')
  const resiReco = inverseDct2D(SCRATCH_DEQUANT.subarray(0, numPixels), N);
  let ssd = 0;

  for (let i = 0; i < numPixels; i++) {
    const recVal = clamp(SCRATCH_PRED[i] + resiReco[i]);
    SCRATCH_RECO[i] = recVal;
    const diff = origBlock[i] - recVal;
    ssd += diff * diff;
  }

  // 6. Rate & Cost: J = D + lambda * R
  const modeBits = 3; // MPM flag + mode index
  const splitFlagBits = 1;
  const totalBits = coeffBits + modeBits + splitFlagBits;
  const cost = ssd + lambda * totalBits;

  return {
    mode,
    modeName: modeNames[mode] || `Mode ${mode}`,
    pred: SCRATCH_PRED.slice(0, numPixels),
    resi: SCRATCH_RESI.slice(0, numPixels),
    dctCoeff,
    quantCoeff: SCRATCH_QUANT.slice(0, numPixels),
    resiReco,
    reco: SCRATCH_RECO.slice(0, numPixels),
    ssd,
    nonzeroCount,
    bits: totalBits,
    cost: Math.round(cost * 10) / 10,
    lambda: Math.round(lambda * 100) / 100,
    qstep: Math.round(qstep * 100) / 100,
    is_winner: false,
    isTraceRecord: false,
    dataSource: 'SYNTHETIC_SIMULATION',
    hasData: true
  };
}

/**
 * Creates default synthetic 64x64 test patterns if no user image is loaded
 */
export function generateSyntheticCtuPattern(patternType = 'gradient') {
  const size = 64;
  const data = new Array(size * size).fill(128);

  if (patternType === 'gradient') {
    // Sharp diagonal edge across the CTU to test quadtree splitting
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (x + y < 60) {
          data[y * size + x] = 220; // light region
        } else if (x + y < 70) {
          data[y * size + x] = clamp(220 - (x + y - 60) * 16); // sharp ramp
        } else {
          data[y * size + x] = 60; // dark region
        }
      }
    }
  } else if (patternType === 'checkerboard') {
    // High-frequency texture forcing deep splitting
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cx = Math.floor(x / 8);
        const cy = Math.floor(y / 8);
        data[y * size + x] = ((cx + cy) % 2 === 0) ? 210 : 70;
      }
    }
  } else if (patternType === 'flat') {
    // Homogeneous smooth region favoring non-split
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        data[y * size + x] = 140 + Math.round(10 * Math.sin(x / 10));
      }
    }
  } else {
    // Circle in center
    const cx = 32, cy = 32, r = 18;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - cx, y - cy);
        data[y * size + x] = d <= r ? 230 : 60;
      }
    }
  }

  return data;
}

/**
 * HEVC xCompressCU Recursive State Generator
 *
 * Traverses a 64x64 CTU down to 8x8 (Depth 0..3)
 * Yields discrete step snapshots capturing every call, evaluation, and backtrack decision.
 */
export function runHevcQuadtreeSimulation({
  ctuPatch, // 64x64 1D array of original pixels
  qp = 32,
  forcedMode = null, // null: Auto best mode; or fixed mode (0, 1, 10, 26)
  groundTruthNodes = null, // Optional: real HM-18.0 encoder trace nodes from CU QuadTree
  rdoDecisions = null, // Optional: verified CU_RDO_DECISION checkpoints from HM encoder
  candidateDetails = null // Optional: real candidate evaluation details from Step 4 Full RDO
}) {
  const steps = [];
  const ctuSize = 64;
  const recoBuffer = new Uint8ClampedArray(ctuSize * ctuSize).fill(128);
  const qpVal = Math.max(10, Math.min(51, qp));
  const lambda = computeLambda(qpVal);

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

  // Map Step 4 Full RDO candidates
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

  // Fast O(1) Shallow Snapshot without JSON.parse(JSON.stringify) memory thrashing
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

    const nodeMeta = {
      id: nodeId,
      depth,
      x,
      y,
      size,
      parentId,
      childIndex,
      status: 'VISITING', // VISITING -> EVALUATING -> SPLIT | LEAF
      bestMode: null,
      jNonSplit: 0,
      jSplit: 0,
      decision: null,
      children: []
    };
    treeNodes[nodeId] = nodeMeta;
    if (parentId && treeNodes[parentId]) {
      treeNodes[parentId].children.push(nodeId);
    }

    currentStack.push(nodeMeta);

    const origBlock = getOrigSubBlock(x, y, size);
    const { refTop, refLeft } = extractRefSamples(x, y, size, recoBuffer, ctuSize);

    // STEP 1: VISIT_NODE
    steps.push({
      stepId: steps.length,
      type: 'VISIT_NODE',
      title: `Visit ${size}×${size} (D${depth})`,
      description: `Target (${x}, ${y}) • Size ${size}×${size} • Depth ${depth}`,
      node: { ...nodeMeta },
      depth,
      size,
      x,
      y,
      callStack: [...currentStack],
      origBlock,
      refTop,
      refLeft,
      activeModeEval: null,
      allEvaluations: [],
      jNonSplit: 0,
      jSplit: 0,
      decision: null,
      treeSnapshot: snapshotTree()
    });

    // STEP 2: EVALUATE MODES (Non-split RDO)
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
        traceCandidate: cand
      });
    });

    // Find best mode with minimum cost
    evaluations.sort((a, b) => a.cost - b.cost);
    const bestEval = evaluations[0];
    const bestModeMeta = {
      mode: bestEval.mode,
      modeName: bestEval.modeName,
      cost: bestEval.cost,
      ssd: bestEval.ssd,
      bits: bestEval.bits
    };
    nodeMeta.bestMode = bestModeMeta;
    nodeMeta.jNonSplit = bestEval.cost;

    const lightweightEvaluations = evaluations.map(e => ({
      mode: e.mode,
      modeName: e.modeName,
      cost: e.cost,
      ssd: e.ssd,
      bits: e.bits,
      nonzeroCount: e.nonzeroCount
    }));

    steps.push({
      stepId: steps.length,
      type: 'EVAL_NONSPLIT',
      title: `${bestEval.modeName} (${size}×${size})`,
      description: `J_NonSplit ${bestEval.cost.toLocaleString()} • SSD ${bestEval.ssd.toLocaleString()} • ${bestEval.bits}b`,
      node: { ...nodeMeta },
      depth,
      size,
      x,
      y,
      callStack: [...currentStack],
      origBlock,
      refTop,
      refLeft,
      activeModeEval: bestEval,
      allEvaluations: lightweightEvaluations,
      jNonSplit: bestEval.cost,
      jSplit: 0,
      decision: null,
      treeSnapshot: snapshotTree()
    });

    // Check if max depth reached (Depth 3 = 8x8 CU in HEVC)
    const gtNode = gtMap.get(nodeId);
    const rdoDec = rdoDecisionMap.get(`${x}_${y}_${size}`) || rdoDecisionMap.get(nodeId);

    if (depth >= 3 || size <= 8) {
      // Must stay as leaf
      nodeMeta.status = 'LEAF';
      nodeMeta.decision = 'KEEP';
      nodeMeta.jSplit = Infinity;

      if (rdoDec) {
        nodeMeta.jNonSplit = rdoDec.nosplit?.cost ?? rdoDec.cost_nosplit ?? bestEval.cost;
      } else if (gtNode && gtNode.cost !== undefined && gtNode.cost !== null) {
        nodeMeta.jNonSplit = Number(gtNode.cost);
      }

      // Copy reconstruction to recoBuffer
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          recoBuffer[(y + r) * ctuSize + (x + c)] = bestEval.reco[r * size + c];
        }
      }

      steps.push({
        stepId: steps.length,
        type: 'DECISION',
        title: `Leaf CU ${size}×${size}`,
        description: `Max Depth ${depth} • Mode ${bestEval.modeName} • J ${(nodeMeta.jNonSplit || bestEval.cost).toLocaleString()}`,
        node: { ...nodeMeta },
        depth,
        size,
        x,
        y,
        callStack: [...currentStack],
        origBlock,
        refTop,
        refLeft,
        activeModeEval: bestEval,
        allEvaluations: lightweightEvaluations,
        jNonSplit: nodeMeta.jNonSplit || bestEval.cost,
        jSplit: Infinity,
        decision: 'KEEP',
        treeSnapshot: snapshotTree()
      });

      currentStack.pop();
      return { cost: nodeMeta.jNonSplit || bestEval.cost, isSplit: false, evalData: bestEval };
    }

    // STEP 3: RECURSIVE QUAD-SPLIT (Top-Down to Sub-CUs 0, 1, 2, 3)
    const half = size / 2;
    const subCus = [
      { q: 0, sx: x, sy: y, label: 'Sub-CU 0' },
      { q: 1, sx: x + half, sy: y, label: 'Sub-CU 1' },
      { q: 2, sx: x, sy: y + half, label: 'Sub-CU 2' },
      { q: 3, sx: x + half, sy: y + half, label: 'Sub-CU 3' }
    ];

    steps.push({
      stepId: steps.length,
      type: 'RECURSE_START',
      title: `Quad-Split Test (${size}×${size})`,
      description: `Testing 4× (${half}×${half}) • J_NonSplit ${bestEval.cost.toLocaleString()}`,
      node: { ...nodeMeta },
      depth,
      size,
      x,
      y,
      callStack: [...currentStack],
      origBlock,
      refTop,
      refLeft,
      activeModeEval: bestEval,
      allEvaluations: lightweightEvaluations,
      jNonSplit: bestEval.cost,
      jSplit: 0,
      decision: null,
      treeSnapshot: snapshotTree()
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
    const splitFlagRate = 1; // 1 bit for split_cu_flag
    const jSplit = sumSubCuCosts + lambda * splitFlagRate;
    nodeMeta.jSplit = Math.round(jSplit * 10) / 10;

    // Ground truth from verified CU_RDO_DECISION takes highest precedence:
    let willSplit = false;
    if (rdoDec) {
      willSplit = Boolean(rdoDec.split_decision);
      nodeMeta.jNonSplit = rdoDec.nosplit?.cost ?? rdoDec.cost_nosplit ?? bestEval.cost;
      nodeMeta.jSplit = rdoDec.split_evaluated ? (rdoDec.split?.cost ?? rdoDec.cost_split ?? jSplit) : Infinity;
    } else if (gtNode && gtNode.split !== undefined && gtNode.split !== null) {
      willSplit = Boolean(gtNode.split);
      if (gtNode.cost !== undefined && gtNode.cost !== null) {
        nodeMeta.jNonSplit = Number(gtNode.cost);
      }
    } else {
      willSplit = jSplit < bestEval.cost;
    }

    nodeMeta.status = willSplit ? 'SPLIT' : 'LEAF';
    nodeMeta.decision = willSplit ? 'SPLIT' : 'KEEP';

    if (!willSplit) {
      // Non-split wins: overwrite recoBuffer with parent's reco block
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          recoBuffer[(y + r) * ctuSize + (x + c)] = bestEval.reco[r * size + c];
        }
      }
      if (rdoDec) {
        nodeMeta.jNonSplit = rdoDec.nosplit?.cost ?? rdoDec.cost_nosplit ?? bestEval.cost;
      } else if (gtNode && gtNode.cost !== undefined && gtNode.cost !== null) {
        nodeMeta.jNonSplit = Number(gtNode.cost);
      }
    }

    const descText = rdoDec
      ? (willSplit
          ? `HM Verified Decision: SPLIT (J_Split ${nodeMeta.jSplit.toLocaleString()})`
          : `HM Verified Decision: KEEP (Leaf CU • J_NoSplit ${(nodeMeta.jNonSplit || bestEval.cost).toLocaleString()})`)
      : (gtNode && gtNode.split !== undefined)
        ? (willSplit
            ? `HM-18.0 Encoder Decision: SPLIT (J_Split ${nodeMeta.jSplit.toLocaleString()})`
            : `HM-18.0 Encoder Decision: KEEP (Leaf CU • J ${(nodeMeta.jNonSplit || bestEval.cost).toLocaleString()})`)
        : (willSplit
            ? `J_Split ${nodeMeta.jSplit.toLocaleString()} < J_NonSplit ${bestEval.cost.toLocaleString()} (Δ -${Math.round(bestEval.cost - nodeMeta.jSplit).toLocaleString()})`
            : `J_NonSplit ${bestEval.cost.toLocaleString()} ≤ J_Split ${nodeMeta.jSplit.toLocaleString()}`);

    steps.push({
      stepId: steps.length,
      type: 'BACKTRACK_DECISION',
      title: willSplit
        ? `Split CU ${size}×${size}`
        : `Keep CU ${size}×${size}`,
      description: descText,
      node: { ...nodeMeta },
      depth,
      size,
      x,
      y,
      callStack: [...currentStack],
      origBlock,
      refTop,
      refLeft,
      activeModeEval: bestEval,
      allEvaluations: lightweightEvaluations,
      jNonSplit: nodeMeta.jNonSplit || bestEval.cost,
      jSplit: nodeMeta.jSplit,
      decision: nodeMeta.decision,
      treeSnapshot: snapshotTree()
    });

    currentStack.pop();
    return {
      cost: willSplit ? nodeMeta.jSplit : (nodeMeta.jNonSplit || bestEval.cost),
      isSplit: willSplit,
      evalData: bestEval
    };
  }

  // Execute from root CTU
  xCompressCU(0, 0, 0, 64, null, 0);

  return {
    totalSteps: steps.length,
    steps,
    finalTree: snapshotTree(),
    recoBuffer,
    lambda: Math.round(lambda * 100) / 100,
    qp: qpVal
  };
}
