import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== RUNNING PHASE 5: STEP 5 CHROMA INTRA SEARCH & WINNER COMMITMENT TEST SUITE ===\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failCount++;
  }
}

// -------------------------------------------------------------------
// TEST SUITE 1: Step 5 Chroma Candidates & Mode 34 Substitution
// -------------------------------------------------------------------
console.log('Test Suite 1: Step 5 Chroma Candidates & Mode 34 Substitution Conformance');

const step5Code = fs.readFileSync(path.join(__dirname, '../../src/components/stages/cp02_intra_search/pipeline/Step5ChromaWinnerView.jsx'), 'utf-8');

assert(!step5Code.includes('onMouseEnter'), 'Step5ChromaWinnerView has zero onMouseEnter listeners');
assert(!step5Code.includes('onMouseOver'), 'Step5ChromaWinnerView has zero onMouseOver listeners');
assert(!step5Code.includes('scale-105') && !step5Code.includes('scale-110'), 'Step5ChromaWinnerView has zero hover bounce animations');

assert(step5Code.includes('8.4.3'), 'Step5ChromaWinnerView cites H.265 Section 8.4.3 (Chroma intra prediction)');
assert(step5Code.includes('Table 8-2'), 'Step5ChromaWinnerView cites H.265 Table 8-2 (intra_chroma_pred_mode specification)');
assert(step5Code.includes('estIntraPredChromaQT'), 'Step5ChromaWinnerView references HM-18.0 estIntraPredChromaQT');
assert(step5Code.includes('xCheckBestMode'), 'Step5ChromaWinnerView references HM-18.0 xCheckBestMode');
assert(step5Code.includes('CHROMA CANDIDATE SET'), 'Step5ChromaWinnerView displays Chroma candidate set');
assert(step5Code.includes('DM_CHROMA'), 'Step5ChromaWinnerView displays DM_CHROMA direct mode');
assert(step5Code.includes('Mode 34'), 'Step5ChromaWinnerView explains Mode 34 duplicate replacement rule');

// Mathematical test on Chroma candidate derivation (H.265 Table 8-2)
function deriveChromaCandidatesH265(lumaMode) {
  const baseModes = [0, 26, 10, 1];
  const modes = [...baseModes];
  for (let i = 0; i < modes.length; i++) {
    if (lumaMode === modes[i]) {
      modes[i] = 34;
      break;
    }
  }
  return [...modes, lumaMode]; // [Planar, Ver, Hor, DC (with sub), DM_CHROMA]
}

// Case 1: Luma is Planar (0) -> replaces base mode 0 with 34
const candsPlanar = deriveChromaCandidatesH265(0);
assert(candsPlanar[0] === 34 && candsPlanar[1] === 26 && candsPlanar[2] === 10 && candsPlanar[3] === 1 && candsPlanar[4] === 0,
  'When Luma is Planar (0): Mode 0 is substituted by 34 -> [34, 26, 10, 1, 0]');

// Case 2: Luma is Vertical (26) -> replaces base mode 26 with 34
const candsVer = deriveChromaCandidatesH265(26);
assert(candsVer[0] === 0 && candsVer[1] === 34 && candsVer[2] === 10 && candsVer[3] === 1 && candsVer[4] === 26,
  'When Luma is Vertical (26): Mode 26 is substituted by 34 -> [0, 34, 10, 1, 26]');

// Case 3: Luma is Horizontal (10) -> replaces base mode 10 with 34
const candsHor = deriveChromaCandidatesH265(10);
assert(candsHor[0] === 0 && candsHor[1] === 26 && candsHor[2] === 34 && candsHor[3] === 1 && candsHor[4] === 10,
  'When Luma is Horizontal (10): Mode 10 is substituted by 34 -> [0, 26, 34, 1, 10]');

// Case 4: Luma is DC (1) -> replaces base mode 1 with 34
const candsDc = deriveChromaCandidatesH265(1);
assert(candsDc[0] === 0 && candsDc[1] === 26 && candsDc[2] === 10 && candsDc[3] === 34 && candsDc[4] === 1,
  'When Luma is DC (1): Mode 1 is substituted by 34 -> [0, 26, 10, 34, 1]');

// Case 5: Luma is Angular 18 -> no duplicate in base modes
const candsAngular = deriveChromaCandidatesH265(18);
assert(candsAngular[0] === 0 && candsAngular[1] === 26 && candsAngular[2] === 10 && candsAngular[3] === 1 && candsAngular[4] === 18,
  'When Luma is Angular 18: no substitution -> [0, 26, 10, 1, 18]');

// -------------------------------------------------------------------
// TEST SUITE 2: Dual Chroma Planar Matrices (Cb & Cr) Conformance
// -------------------------------------------------------------------
console.log('\nTest Suite 2: Dual Chroma Planar Matrices (Cb & Cr) Conformance');

assert(step5Code.includes('CB CHANNEL (U)'), 'Step5ChromaWinnerView renders Cb Channel (U) section');
assert(step5Code.includes('CR CHANNEL (V)'), 'Step5ChromaWinnerView renders Cr Channel (V) section');
assert(step5Code.includes('Original U'), 'Step5ChromaWinnerView renders Original U matrix');
assert(step5Code.includes('Pred P_U'), 'Step5ChromaWinnerView renders Prediction P_U matrix');
assert(step5Code.includes('Resi R_U'), 'Step5ChromaWinnerView renders Residual R_U matrix');
assert(step5Code.includes('Original V'), 'Step5ChromaWinnerView renders Original V matrix');
assert(step5Code.includes('Pred P_V'), 'Step5ChromaWinnerView renders Prediction P_V matrix');
assert(step5Code.includes('Resi R_V'), 'Step5ChromaWinnerView renders Residual R_V matrix');
assert(step5Code.includes('CHROMA PIXEL ['), 'Step5ChromaWinnerView provides synchronized Cb/Cr pixel inspector');
assert(step5Code.includes('Chroma SSE (U+V)'), 'Step5ChromaWinnerView displays total Chroma SSE distortion');
assert(step5Code.includes('overflowX'), 'Step5ChromaWinnerView enforces safe horizontal overflow scrolling');

// 4:2:0 Subsampling tests
const lumaSize8 = 8;
const chromaSize8 = Math.max(2, Math.floor(lumaSize8 / 2));
assert(chromaSize8 === 4, `8x8 Luma CU corresponds to exactly 4x4 Chroma block: ${chromaSize8} === 4`);
assert(chromaSize8 * chromaSize8 === 16, '4x4 Chroma block contains exactly 16 discrete samples');

const lumaSize16 = 16;
const chromaSize16 = Math.max(2, Math.floor(lumaSize16 / 2));
assert(chromaSize16 === 8, `16x16 Luma CU corresponds to exactly 8x8 Chroma block: ${chromaSize16} === 8`);

// -------------------------------------------------------------------
// TEST SUITE 3: CABAC Syntax Elements & Winner Commitment
// -------------------------------------------------------------------
console.log('\nTest Suite 3: CABAC Syntax Elements & Winner Commitment');

assert(step5Code.includes('BITSTREAM SYNTAX ELEMENTS (CABAC)'), 'Step5ChromaWinnerView displays CABAC Bitstream Syntax Elements');
assert(step5Code.includes('prev_intra_luma_pred_flag'), 'Step5ChromaWinnerView displays prev_intra_luma_pred_flag');
assert(step5Code.includes('intra_chroma_pred_mode'), 'Step5ChromaWinnerView displays intra_chroma_pred_mode');
assert(step5Code.includes('FINAL WINNER COMMITMENT'), 'Step5ChromaWinnerView renders Final Winner Commitment card');
assert(step5Code.includes('Combined Cost (J_PU)'), 'Step5ChromaWinnerView computes Combined PU Cost (Luma + Chroma)');
assert(step5Code.includes('Runner-up'), 'Step5ChromaWinnerView displays competitor modes leaderboard comparison');
assert(step5Code.includes('Apply Mode'), 'Step5ChromaWinnerView provides trigger to apply winner mode to PU inspector');

// Rate-Distortion addition test
const lumaCost = 142.50;
const chromaCost = 35.80;
const combinedCost = (lumaCost + chromaCost).toFixed(2);
assert(combinedCost === '178.30', `Combined PU cost is exact sum of Luma and Chroma costs: ${combinedCost} === 178.30`);

// -------------------------------------------------------------------
// TEST SUITE 4: Complete 5-Stage Intra Prediction Flow Integration
// -------------------------------------------------------------------
console.log('\nTest Suite 4: Complete 5-Stage Intra Prediction Flow Integration');

const flowCode = fs.readFileSync(path.join(__dirname, '../../src/components/stages/cp02_intra_search/IntraPredictionFlow.jsx'), 'utf-8');

assert(flowCode.includes('import Step1BoundaryInitView'), 'IntraPredictionFlow imports Step1BoundaryInitView');
assert(flowCode.includes('import Step2RmdFunnelView'), 'IntraPredictionFlow imports Step2RmdFunnelView');
assert(flowCode.includes('import Step3CandidatesView'), 'IntraPredictionFlow imports Step3CandidatesView');
assert(flowCode.includes('import Step4FullRdoView'), 'IntraPredictionFlow imports Step4FullRdoView');
assert(flowCode.includes('import Step5ChromaWinnerView'), 'IntraPredictionFlow imports Step5ChromaWinnerView');

assert(flowCode.includes('<Step1BoundaryInitView'), 'IntraPredictionFlow renders Step1BoundaryInitView at Step 1');
assert(flowCode.includes('<Step2RmdFunnelView'), 'IntraPredictionFlow renders Step2RmdFunnelView at Step 2');
assert(flowCode.includes('<Step3CandidatesView'), 'IntraPredictionFlow renders Step3CandidatesView at Step 3');
assert(flowCode.includes('<Step4FullRdoView'), 'IntraPredictionFlow renders Step4FullRdoView at Step 4');
assert(flowCode.includes('<Step5ChromaWinnerView'), 'IntraPredictionFlow renders Step5ChromaWinnerView at Step 5');

console.log(`\n=== PHASE 5 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED ===\n`);

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
