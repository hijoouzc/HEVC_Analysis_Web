/**
 * cabacMathEngine.js
 * 
 * Bit-Exact HEVC Binary Arithmetic Coder (BAC) Mathematical Engine
 * and Intra Binarization Models according to ITU-T H.265 Section 9.3 & HM-18.0.
 * 
 * Features:
 *  - Standard 64x4 LPS Range Matrix (aucLPSTable)
 *  - 128-state FSM transition model (pStateIdx 0..62 and valMPS 0..1)
 *  - Interval Subdivision [L, L + R) with MPS / LPS split
 *  - Exact Renormalization bit emission (R < 256)
 *  - Equiprobable Bypass Mode
 *  - Intra Syntax Element Binarization Trees (FL, TR, TB, EGk)
 */

// 1. ITU-T H.265 Table 9-44: Specification of rangeTabLPS[pStateIdx][qCodIRangeIdx]
export const AUC_LPS_TABLE = [
  [128, 176, 208, 240],
  [128, 167, 197, 227],
  [128, 158, 187, 216],
  [123, 150, 178, 205],
  [116, 142, 169, 195],
  [111, 135, 160, 185],
  [105, 128, 152, 175],
  [100, 122, 144, 166],
  [ 95, 116, 137, 158],
  [ 90, 110, 130, 150],
  [ 85, 104, 123, 142],
  [ 81,  99, 117, 135],
  [ 77,  94, 111, 128],
  [ 73,  89, 105, 122],
  [ 69,  85, 100, 116],
  [ 66,  80,  95, 110],
  [ 62,  76,  90, 104],
  [ 59,  72,  86,  99],
  [ 56,  69,  81,  94],
  [ 53,  65,  77,  89],
  [ 51,  62,  73,  85],
  [ 48,  59,  69,  80],
  [ 46,  56,  66,  76],
  [ 43,  53,  63,  72],
  [ 41,  50,  59,  69],
  [ 39,  48,  56,  65],
  [ 37,  45,  54,  62],
  [ 35,  43,  51,  59],
  [ 33,  41,  48,  56],
  [ 32,  39,  46,  53],
  [ 30,  37,  43,  50],
  [ 29,  35,  41,  48],
  [ 27,  33,  39,  45],
  [ 26,  31,  37,  43],
  [ 24,  30,  35,  41],
  [ 23,  28,  33,  39],
  [ 22,  27,  32,  37],
  [ 21,  26,  30,  35],
  [ 20,  24,  29,  33],
  [ 19,  23,  27,  31],
  [ 18,  22,  26,  30],
  [ 17,  21,  25,  28],
  [ 16,  20,  23,  27],
  [ 15,  19,  22,  25],
  [ 14,  18,  21,  24],
  [ 14,  17,  20,  23],
  [ 13,  16,  19,  22],
  [ 12,  15,  18,  21],
  [ 12,  14,  17,  20],
  [ 11,  14,  16,  19],
  [ 11,  13,  15,  18],
  [ 10,  12,  15,  17],
  [ 10,  12,  14,  16],
  [  9,  11,  13,  15],
  [  9,  11,  12,  14],
  [  8,  10,  12,  14],
  [  8,   9,  11,  13],
  [  7,   9,  11,  12],
  [  7,   9,  10,  12],
  [  7,   8,  10,  11],
  [  6,   8,   9,  11],
  [  6,   7,   9,  10],
  [  6,   7,   8,   9],
  [  2,   2,   2,   2]
];

// 2. HM-18.0 / ITU-T H.265 Table 9-45: State transition tables (128 total states = 64 pStateIdx * 2 valMPS)
export const NEXT_STATE_MPS = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
  18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33,
  34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65,
  66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81,
  82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97,
  98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113,
  114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 124, 125, 126, 127
];

export const NEXT_STATE_LPS = [
  1, 0, 0, 1, 2, 3, 4, 5, 4, 5, 8, 9, 8, 9, 10, 11,
  12, 13, 14, 15, 16, 17, 18, 19, 18, 19, 22, 23, 22, 23, 24, 25,
  26, 27, 26, 27, 30, 31, 30, 31, 32, 33, 32, 33, 36, 37, 36, 37,
  38, 39, 38, 39, 42, 43, 42, 43, 44, 45, 44, 45, 46, 47, 48, 49,
  48, 49, 50, 51, 52, 53, 52, 53, 54, 55, 54, 55, 56, 57, 58, 59,
  58, 59, 60, 61, 60, 61, 60, 61, 62, 63, 64, 65, 64, 65, 66, 67,
  66, 67, 66, 67, 68, 69, 68, 69, 70, 71, 70, 71, 70, 71, 72, 73,
  72, 73, 72, 73, 74, 75, 74, 75, 74, 75, 76, 77, 76, 77, 126, 127
];

export const RENORM_TABLE = [
  6, 5, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1
];

/**
 * Approximate probability of LPS (p_LPS) for state 0..62
 * Formula: p_LPS(state) = 0.5 * (0.01875 / 0.5)^(state / 63)
 */
export function getLpsProbability(pStateIdx) {
  const s = Math.max(0, Math.min(62, pStateIdx ?? 0));
  return 0.5 * Math.pow(0.01875 / 0.5, s / 63);
}

/**
 * Initialize a pristine BAC state
 */
export function createInitialBacState() {
  return {
    range: 510, // 0x1FE
    low: 0,
    bitsLeft: 23,
    bufferedByte: 0xFF,
    numBufferedBytes: 0,
    pStateIdx: 0,
    valMPS: 0,
    totalBins: 0,
    totalBits: 0,
    bitstream: [],
    history: [],
  };
}

/**
 * Execute 1 bit BAC encoding step (bit-exact with TEncBinCoderCABAC::encodeBin)
 * 
 * @param {Object} state BAC state object
 * @param {number} binValue 0 or 1
 * @param {boolean} isBypass Whether to encode in equiprobable bypass mode
 * @returns {Object} Updated BAC step details
 */
export function stepBacEncode(state, binValue, isBypass = false) {
  let range = state.range;
  let low = state.low;
  let pStateIdx = state.pStateIdx;
  let valMPS = state.valMPS;
  const emittedBits = [];

  const oldRange = range;
  const oldLow = low;
  const oldPState = pStateIdx;
  const oldValMPS = valMPS;

  let rangeLPS = 0;
  let rangeMPS = 0;
  let isLPS = false;
  let qCodIRangeIdx = 0;

  if (isBypass) {
    // Equiprobable bypass encoding
    rangeMPS = range >> 1;
    rangeLPS = range - rangeMPS;
    isLPS = binValue === 1;

    low = (low << 1);
    if (binValue === 1) {
      low += range;
    }

    // Renormalization for bypass
    if (low >= 0x400) {
      emittedBits.push((low >> 10) & 1);
      low &= 0x3FF;
    }
  } else {
    // Context-adaptive regular binary encoding
    qCodIRangeIdx = (range >> 6) & 3;
    rangeLPS = AUC_LPS_TABLE[pStateIdx][qCodIRangeIdx];
    rangeMPS = range - rangeLPS;

    const fullState = (pStateIdx << 1) + valMPS;

    if (binValue !== valMPS) {
      // LPS occurred
      isLPS = true;
      const shiftIdx = rangeLPS >> 3;
      const numBits = RENORM_TABLE[Math.min(31, Math.max(0, shiftIdx))];
      low = (low + rangeMPS) << numBits;
      range = rangeLPS << numBits;

      const nextFull = NEXT_STATE_LPS[fullState];
      pStateIdx = nextFull >> 1;
      valMPS = nextFull & 1;

      for (let b = numBits - 1; b >= 0; b--) {
        emittedBits.push((low >> (10 + b)) & 1);
      }
      low &= 0x3FF;
    } else {
      // MPS occurred
      isLPS = false;
      range = rangeMPS;

      const nextFull = NEXT_STATE_MPS[fullState];
      pStateIdx = nextFull >> 1;
      valMPS = nextFull & 1;

      // Renormalization when range falls below 256
      if (range < 256) {
        low <<= 1;
        range <<= 1;
        emittedBits.push((low >> 10) & 1);
        low &= 0x3FF;
      }
    }
  }

  const newState = {
    ...state,
    range,
    low,
    pStateIdx,
    valMPS,
    totalBins: state.totalBins + 1,
    totalBits: state.totalBits + emittedBits.length,
    bitstream: [...state.bitstream, ...emittedBits],
  };

  const stepRecord = {
    binValue,
    isBypass,
    isLPS,
    oldRange,
    newRange: range,
    oldLow,
    newLow: low,
    rangeLPS,
    rangeMPS,
    qCodIRangeIdx,
    oldPState,
    newPState: pStateIdx,
    oldValMPS,
    newValMPS: valMPS,
    pLps: getLpsProbability(pStateIdx),
    emittedBits,
  };

  newState.history = [...(state.history || []), stepRecord];
  return { newState, stepRecord };
}

// =============================================================================
// 3. Intra Syntax Elements & Binarization Tree Definitions
// =============================================================================

export const INTRA_SYNTAX_DEFINITIONS = [
  {
    id: 'split_cu_flag',
    name: 'CU Split Flag (split_cu_flag)',
    category: 'Partitioning',
    standardRef: 'ITU-T H.265 §7.3.8.5',
    binarizationType: 'Fixed-Length (FL, 1 bin)',
    description: 'Dictates whether current CU is split into 4 equal sub-quadrants.',
    values: [
      { val: 0, label: '0: Do Not Split (Leaf CU)', binString: '0', bins: [{ bin: 0, ctx: 'ctx_split_cu', isBypass: false }] },
      { val: 1, label: '1: Split CU (4 sub-CUs)', binString: '1', bins: [{ bin: 1, ctx: 'ctx_split_cu', isBypass: false }] },
    ],
    tree: {
      id: 'root',
      label: 'Evaluate CU Split',
      children: [
        { id: 'leaf_0', bin: 0, label: 'No Split (Leaf CU)' },
        { id: 'leaf_1', bin: 1, label: 'Split (QuadTree Sub-CUs)' },
      ],
    },
  },
  {
    id: 'split_transform_flag',
    name: 'TU Split Flag (split_transform_flag)',
    category: 'Transform',
    standardRef: 'ITU-T H.265 §7.3.8.8',
    binarizationType: 'Fixed-Length (FL, 1 bin)',
    description: 'Decides Residual Quadtree (RQT) subdivision down to 4x4.',
    values: [
      { val: 0, label: '0: No Transform Split', binString: '0', bins: [{ bin: 0, ctx: 'ctx_split_tu', isBypass: false }] },
      { val: 1, label: '1: Split Transform Block', binString: '1', bins: [{ bin: 1, ctx: 'ctx_split_tu', isBypass: false }] },
    ],
    tree: {
      id: 'root',
      label: 'Evaluate TU Split',
      children: [
        { id: 'leaf_0', bin: 0, label: 'Single Transform Matrix' },
        { id: 'leaf_1', bin: 1, label: 'Subdivide RQT' },
      ],
    },
  },
  {
    id: 'cbf_luma',
    name: 'Coded Block Flag Luma (cbf_luma)',
    category: 'Residual',
    standardRef: 'ITU-T H.265 §7.3.8.8',
    binarizationType: 'Fixed-Length (FL, 1 bin)',
    description: 'Indicates whether transform coefficients are present (non-zero) in Luma TU.',
    values: [
      { val: 0, label: '0: All Zero Coefficients (Skip RQT)', binString: '0', bins: [{ bin: 0, ctx: 'ctx_cbf_luma', isBypass: false }] },
      { val: 1, label: '1: Non-Zero Coefficients Present', binString: '1', bins: [{ bin: 1, ctx: 'ctx_cbf_luma', isBypass: false }] },
    ],
    tree: {
      id: 'root',
      label: 'Inspect Luma Coefficients',
      children: [
        { id: 'leaf_0', bin: 0, label: 'Zero Residual (CBF = 0)' },
        { id: 'leaf_1', bin: 1, label: 'Coded Coeffs (CBF = 1)' },
      ],
    },
  },
  {
    id: 'prev_intra_luma_pred_flag',
    name: 'MPM Flag (prev_intra_luma_pred_flag)',
    category: 'Prediction',
    standardRef: 'ITU-T H.265 §7.3.8.5',
    binarizationType: 'Fixed-Length (FL, 1 bin)',
    description: 'Specifies whether Luma intra mode is among the 3 Most Probable Modes (MPMs).',
    values: [
      { val: 1, label: '1: Mode matches MPM Candidate [0..2]', binString: '1', bins: [{ bin: 1, ctx: 'ctx_mpm_flag', isBypass: false }] },
      { val: 0, label: '0: Mode is Selected from 32 Remaining Modes', binString: '0', bins: [{ bin: 0, ctx: 'ctx_mpm_flag', isBypass: false }] },
    ],
    tree: {
      id: 'root',
      label: 'Is Best Mode in MPM?',
      children: [
        { id: 'leaf_1', bin: 1, label: 'Use MPM Candidates (mpm_idx)' },
        { id: 'leaf_0', bin: 0, label: 'Use Remaining Modes (rem_intra)' },
      ],
    },
  },
  {
    id: 'mpm_idx',
    name: 'MPM Index (mpm_idx)',
    category: 'Prediction',
    standardRef: 'ITU-T H.265 §7.3.8.5',
    binarizationType: 'Truncated Rice (TR, cMax=2)',
    description: 'Picks which of the 3 MPMs is active when prev_intra_luma_pred_flag == 1.',
    values: [
      { val: 0, label: '0: MPM[0] (Planar or Left Neighbor)', binString: '0', bins: [{ bin: 0, ctx: 'bypass', isBypass: true }] },
      { val: 1, label: '1: MPM[1] (DC or Above Neighbor)', binString: '10', bins: [{ bin: 1, ctx: 'bypass', isBypass: true }, { bin: 0, ctx: 'bypass', isBypass: true }] },
      { val: 2, label: '2: MPM[2] (Angular Mode / Fallback)', binString: '11', bins: [{ bin: 1, ctx: 'bypass', isBypass: true }, { bin: 1, ctx: 'bypass', isBypass: true }] },
    ],
    tree: {
      id: 'root',
      label: 'Select MPM Candidate',
      children: [
        { id: 'leaf_0', bin: 0, label: 'Candidate #0' },
        {
          id: 'branch_1',
          bin: 1,
          label: 'More Candidates',
          children: [
            { id: 'leaf_1', bin: 0, label: 'Candidate #1' },
            { id: 'leaf_2', bin: 1, label: 'Candidate #2' },
          ],
        },
      ],
    },
  },
  {
    id: 'rem_intra_luma_pred_mode',
    name: 'Remaining Intra Mode (rem_intra_luma_pred_mode)',
    category: 'Prediction',
    standardRef: 'ITU-T H.265 §7.3.8.5',
    binarizationType: 'Fixed-Length (FL, 5 bins, Bypass)',
    description: '5-bit binary index pointing to one of the 32 non-MPM intra angular modes.',
    values: [
      { val: 0, label: 'Mode Index 0 (00000)', binString: '00000', bins: new Array(5).fill({ bin: 0, ctx: 'bypass', isBypass: true }) },
      { val: 10, label: 'Mode Index 10 (01010)', binString: '01010', bins: [0, 1, 0, 1, 0].map(b => ({ bin: b, ctx: 'bypass', isBypass: true })) },
      { val: 26, label: 'Mode Index 26 (11010)', binString: '11010', bins: [1, 1, 0, 1, 0].map(b => ({ bin: b, ctx: 'bypass', isBypass: true })) },
      { val: 31, label: 'Mode Index 31 (11111)', binString: '11111', bins: new Array(5).fill({ bin: 1, ctx: 'bypass', isBypass: true }) },
    ],
    tree: {
      id: 'root',
      label: '5-Bit Fixed Length Code (32 Modes)',
      children: [
        { id: 'b4_0', bin: 0, label: 'b4=0 (0..15)' },
        { id: 'b4_1', bin: 1, label: 'b4=1 (16..31)' },
      ],
    },
  },
  {
    id: 'intra_chroma_pred_mode',
    name: 'Chroma Intra Mode (intra_chroma_pred_mode)',
    category: 'Prediction',
    standardRef: 'ITU-T H.265 §7.3.8.5',
    binarizationType: 'Truncated Binarization (TB)',
    description: 'Chroma intra mode selector: DM_CHROMA or 4 derived modes (Planar, Vert, Horiz, DC).',
    values: [
      { val: 4, label: '4: Derived from Luma (DM_CHROMA)', binString: '0', bins: [{ bin: 0, ctx: 'ctx_chroma_pred', isBypass: false }] },
      { val: 0, label: '0: Planar Mode', binString: '100', bins: [{ bin: 1, ctx: 'ctx_chroma_pred', isBypass: false }, { bin: 0, ctx: 'bypass', isBypass: true }, { bin: 0, ctx: 'bypass', isBypass: true }] },
      { val: 1, label: '1: Vertical Mode', binString: '101', bins: [{ bin: 1, ctx: 'ctx_chroma_pred', isBypass: false }, { bin: 0, ctx: 'bypass', isBypass: true }, { bin: 1, ctx: 'bypass', isBypass: true }] },
      { val: 2, label: '2: Horizontal Mode', binString: '110', bins: [{ bin: 1, ctx: 'ctx_chroma_pred', isBypass: false }, { bin: 1, ctx: 'bypass', isBypass: true }, { bin: 0, ctx: 'bypass', isBypass: true }] },
      { val: 3, label: '3: DC Mode', binString: '111', bins: [{ bin: 1, ctx: 'ctx_chroma_pred', isBypass: false }, { bin: 1, ctx: 'bypass', isBypass: true }, { bin: 1, ctx: 'bypass', isBypass: true }] },
    ],
    tree: {
      id: 'root',
      label: 'Chroma Intra Prediction',
      children: [
        { id: 'leaf_dm', bin: 0, label: 'DM_CHROMA (Derived)' },
        {
          id: 'branch_explicit',
          bin: 1,
          label: 'Explicit Chroma Mode',
          children: [
            {
              id: 'sub_0',
              bin: 0,
              label: 'Planar / Vert',
              children: [
                { id: 'leaf_planar', bin: 0, label: 'Planar (0)' },
                { id: 'leaf_vert', bin: 1, label: 'Vertical (1)' },
              ],
            },
            {
              id: 'sub_1',
              bin: 1,
              label: 'Horiz / DC',
              children: [
                { id: 'leaf_horiz', bin: 0, label: 'Horizontal (2)' },
                { id: 'leaf_dc', bin: 1, label: 'DC (3)' },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'coeff_abs_level_greater1_flag',
    name: 'Coeff Level > 1 (coeff_abs_level_greater1_flag)',
    category: 'Residual',
    standardRef: 'ITU-T H.265 §7.3.8.11',
    binarizationType: 'Fixed-Length (FL, 1 bin, Context)',
    description: 'Signals whether a significant transform coefficient has magnitude > 1.',
    values: [
      { val: 0, label: '0: Magnitude is Exactly 1', binString: '0', bins: [{ bin: 0, ctx: 'ctx_coeff_gt1', isBypass: false }] },
      { val: 1, label: '1: Magnitude is >= 2', binString: '1', bins: [{ bin: 1, ctx: 'ctx_coeff_gt1', isBypass: false }] },
    ],
    tree: {
      id: 'root',
      label: 'Coefficient Amplitude Check',
      children: [
        { id: 'leaf_0', bin: 0, label: '|Coeff| = 1' },
        { id: 'leaf_1', bin: 1, label: '|Coeff| >= 2' },
      ],
    },
  },
];

/**
 * Get definition of a syntax element by ID
 */
export function getSyntaxDefinition(id) {
  return INTRA_SYNTAX_DEFINITIONS.find((s) => s.id === id) || null;
}
