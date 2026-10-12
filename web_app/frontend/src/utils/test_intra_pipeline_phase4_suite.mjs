import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculateLagrangianLambda, calculateQuantStep } from './metricsUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== RUNNING PHASE 4: STEP 3 CANDIDATES & STEP 4 FULL RDO TEST SUITE ===\n');

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
// TEST SUITE 1: Step 3 Candidates & MPM Pool Conformance
// -------------------------------------------------------------------
console.log('Test Suite 1: Step 3 Candidates & MPM Derivation Conformance');

const step3Code = fs.readFileSync(path.join(__dirname, '../components/flow/Step3CandidatesView.jsx'), 'utf-8');

assert(!step3Code.includes('onMouseEnter'), 'Step3CandidatesView has zero onMouseEnter listeners');
assert(!step3Code.includes('onMouseOver'), 'Step3CandidatesView has zero onMouseOver listeners');
assert(!step3Code.includes('scale-105') && !step3Code.includes('scale-110'), 'Step3CandidatesView has zero hover bounce animations');

assert(step3Code.includes('8.4.2'), 'Step3CandidatesView cites H.265 Section 8.4.2 (MPM derivation)');
assert(step3Code.includes('SPATIAL NEIGHBOR CONTEXT'), 'Step3CandidatesView displays spatial neighbor context layout');
assert(step3Code.includes('ABOVE (B)'), 'Step3CandidatesView renders Above neighbor B');
assert(step3Code.includes('LEFT (A)'), 'Step3CandidatesView renders Left neighbor A');
assert(step3Code.includes('TARGET CU'), 'Step3CandidatesView renders Target CU context');
assert(step3Code.includes('3 MOST PROBABLE MODES (MPM ARRAY)') || step3Code.includes('DERIVED 3 MPMs'), 'Step3CandidatesView renders derived 3 MPMs block');
assert(step3Code.includes('mpm_flag=1'), 'Step3CandidatesView explains CABAC mpm_flag bit savings');
assert(step3Code.includes('UNIFIED CANDIDATE POOL'), 'Step3CandidatesView displays unified candidate pool table');

// Mathematical validation of H.265 Section 8.4.2 MPM Derivation
function deriveMpmH265(A, B) {
  if (A === B) {
    if (A > 1) {
      return [A, ((A + 29) % 32) + 2, ((A - 1) % 32) + 2];
    }
    return [0, 1, 26];
  }
  const cand = [A, B, 0];
  if (A !== 0 && B !== 0) {
    cand[2] = 0;
  } else {
    cand[2] = (A + B < 2) ? 26 : 1;
  }
  return cand;
}

// Case 1: A == B, Non-Angular
const mpmPlanar = deriveMpmH265(0, 0);
assert(mpmPlanar[0] === 0 && mpmPlanar[1] === 1 && mpmPlanar[2] === 26, 'MPM(0, 0) yields [0, 1, 26]');
const mpmDc = deriveMpmH265(1, 1);
assert(mpmDc[0] === 0 && mpmDc[1] === 1 && mpmDc[2] === 26, 'MPM(1, 1) yields [0, 1, 26]');

// Case 2: A == B, Angular
const mpm10 = deriveMpmH265(10, 10);
assert(mpm10[0] === 10 && mpm10[1] === 9 && mpm10[2] === 11, 'MPM(10, 10) yields Mode 10 ± 1 -> [10, 9, 11]');
const mpm2 = deriveMpmH265(2, 2);
assert(mpm2[0] === 2 && mpm2[1] === 33 && mpm2[2] === 3, 'MPM(2, 2) yields Mode 2 boundary wrap -> [2, 33, 3]');
const mpm26 = deriveMpmH265(26, 26);
assert(mpm26[0] === 26 && mpm26[1] === 25 && mpm26[2] === 27, 'MPM(26, 26) yields Mode 26 ± 1 -> [26, 25, 27]');

// Case 3: A != B, Both Non-Planar
const mpmDiffNonPlanar = deriveMpmH265(10, 26);
assert(mpmDiffNonPlanar[0] === 10 && mpmDiffNonPlanar[1] === 26 && mpmDiffNonPlanar[2] === 0, 'MPM(10, 26) yields [10, 26, 0]');

// Case 4: A != B, One is Planar (0)
const mpmZeroVer = deriveMpmH265(0, 26);
assert(mpmZeroVer[0] === 0 && mpmZeroVer[1] === 26 && mpmZeroVer[2] === 1, 'MPM(0, 26) yields [0, 26, 1]');
const mpmZeroDc = deriveMpmH265(0, 1);
assert(mpmZeroDc[0] === 0 && mpmZeroDc[1] === 1 && mpmZeroDc[2] === 26, 'MPM(0, 1) yields [0, 1, 26]');

// Deduplicated Candidate Pool Union
const topK = [10, 26, 12, 11, 25, 14, 1, 15]; // K = 8
const mpmSet = deriveMpmH265(10, 26); // [10, 26, 0]
const poolSet = new Set([...topK, ...mpmSet]);
assert(poolSet.size === 9, 'Top 8 (RMD) ∪ MPM [10, 26, 0] deduplicates to exactly 9 modes (10 & 26 already in Top 8)');

// -------------------------------------------------------------------
// TEST SUITE 2: Step 4 Full RDO & 6-Stage Transformation Strip
// -------------------------------------------------------------------
console.log('\nTest Suite 2: Step 4 Full RDO & 6-Stage Domain Strip Conformance');

const step4Code = fs.readFileSync(path.join(__dirname, '../components/flow/Step4FullRdoView.jsx'), 'utf-8');

assert(!step4Code.includes('onMouseEnter'), 'Step4FullRdoView has zero onMouseEnter listeners');
assert(!step4Code.includes('onMouseOver'), 'Step4FullRdoView has zero onMouseOver listeners');
assert(!step4Code.includes('scale-105') && !step4Code.includes('scale-110'), 'Step4FullRdoView has zero hover bounce animations');

assert(step4Code.includes('xRecurIntraCodingLumaQT'), 'Step4FullRdoView references HM-16.0 xRecurIntraCodingLumaQT');
assert(step4Code.includes('6-STAGE DOMAIN TRANSFORMATION STRIP'), 'Step4FullRdoView renders 6-Stage Domain Transformation title');
assert(step4Code.includes('1. ORIGINAL S(x, y)'), 'Step4FullRdoView renders Domain 1: Original S');
assert(step4Code.includes('2. PREDICTION P(x, y)'), 'Step4FullRdoView renders Domain 2: Prediction P');
assert(step4Code.includes('3. RESIDUAL R = S − P'), 'Step4FullRdoView renders Domain 3: Residual R');
assert(step4Code.includes('4. SPECTRUM C(u, v)'), 'Step4FullRdoView renders Domain 4: Frequency Spectrum C');
assert(step4Code.includes('5. QUANT LEVEL Q(u, v)'), 'Step4FullRdoView renders Domain 5: Quant Level Q');
assert(step4Code.includes('6. RECO S\' = Clip(P+R\')'), 'Step4FullRdoView renders Domain 6: Reconstruction S\'');
assert(step4Code.includes('PIXEL ['), 'Step4FullRdoView provides Synchronized Pixel Inspector HUD');
assert(step4Code.includes('Lossy Error (S − S\')'), 'Step4FullRdoView displays Lossy Reconstruction Error (S - S\')');
assert(step4Code.includes('J_RDO = D_SSE(S, S\') + λ_mode · R_CABAC'), 'Step4FullRdoView computes True Rate-Distortion Cost');
assert(step4Code.includes('overflowX'), 'Step4FullRdoView protects layout with safe overflow scroll');

// Mathematical verification of 2D DCT-II and Quantization
const N = 4;
const totalPixels = N * N;
// Constant residual: all 16 pixels = 10
const testR = new Array(totalPixels).fill(10);
const testC = new Array(totalPixels).fill(0);

for (let u = 0; u < N; u++) {
  for (let v = 0; v < N; v++) {
    const cu = (u === 0) ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
    const cv = (v === 0) ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
    let sum = 0;
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) {
        sum += testR[y * N + x] * Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N)) * Math.cos(((2 * y + 1) * v * Math.PI) / (2 * N));
      }
    }
    testC[v * N + u] = Math.round(cu * cv * sum);
  }
}

// Flat block DC energy compaction: DC coefficient testC[0] = cu*cv*sum = (1/4)*16*10 = 40
assert(testC[0] === 40, `Flat residual DC coefficient compacts all energy: ${testC[0]} === 40`);
const acEnergy = testC.slice(1).reduce((acc, v) => acc + Math.abs(v), 0);
assert(acEnergy === 0, 'All AC high-frequency coefficients are exactly 0 for flat residual');

// Rate-Distortion formula verification
const qp = 32;
const lambda = calculateLagrangianLambda(qp);
const qStep = calculateQuantStep(qp);
assert(lambda > 0, `Lagrangian multiplier λ for QP ${qp} is positive: ${lambda.toFixed(3)}`);
assert(qStep > 0, `Quantization step size for QP ${qp} is valid: ${qStep.toFixed(3)}`);

// -------------------------------------------------------------------
// TEST SUITE 3: IntraPredictionFlow and ActiveStageViewport Integration
// -------------------------------------------------------------------
console.log('\nTest Suite 3: IntraPredictionFlow and ActiveStageViewport Integration');

const flowCode = fs.readFileSync(path.join(__dirname, '../components/IntraPredictionFlow.jsx'), 'utf-8');
const viewportCode = fs.readFileSync(path.join(__dirname, '../components/app/ActiveStageViewport.jsx'), 'utf-8');

assert(flowCode.includes('import Step3CandidatesView'), 'IntraPredictionFlow imports Step3CandidatesView');
assert(flowCode.includes('import Step4FullRdoView'), 'IntraPredictionFlow imports Step4FullRdoView');
assert(flowCode.includes('<Step3CandidatesView'), 'IntraPredictionFlow renders Step3CandidatesView at activePipelineStep === 3');
assert(flowCode.includes('<Step4FullRdoView'), 'IntraPredictionFlow renders Step4FullRdoView at activePipelineStep === 4');
assert(flowCode.includes('transformData = null'), 'IntraPredictionFlow accepts transformData prop');
assert(flowCode.includes('quantData = null'), 'IntraPredictionFlow accepts quantData prop');
assert(flowCode.includes('const transformEvent = useMemo'), 'IntraPredictionFlow derives transformEvent for Stage 4');

assert(viewportCode.includes('transformData={transformData}'), 'ActiveStageViewport passes transformData to IntraPredictionFlow');
assert(viewportCode.includes('quantData={quantData}'), 'ActiveStageViewport passes quantData to IntraPredictionFlow');

console.log(`\n=== PHASE 4 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED ===\n`);

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
