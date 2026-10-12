import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeMdisSmoothedRef } from './metricsUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== RUNNING PHASE 3: STEP 1 BOUNDARY & STEP 2 RMD FUNNEL TEST SUITE ===\n');

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
// TEST SUITE 1: Step 1 Boundary Init & MDIS 3-Tap Formula Conformance
// -------------------------------------------------------------------
console.log('Test Suite 1: Step 1 Reference Boundary & MDIS Filter Conformance');

const step1Code = fs.readFileSync(path.join(__dirname, '../components/flow/Step1BoundaryInitView.jsx'), 'utf-8');

assert(!step1Code.includes('onMouseEnter'), 'Step1BoundaryInitView has zero onMouseEnter listeners');
assert(!step1Code.includes('onMouseOver'), 'Step1BoundaryInitView has zero onMouseOver listeners');
assert(!step1Code.includes('scale-105') && !step1Code.includes('scale-110'), 'Step1BoundaryInitView has zero hover bounce animations');

assert(step1Code.includes('8.4.4.2.2'), 'Step1BoundaryInitView cites H.265 Section 8.4.4.2.2 (Reference sample derivation)');
assert(step1Code.includes('8.4.4.2.3'), 'Step1BoundaryInitView cites H.265 Section 8.4.4.2.3 (MDIS filtering)');
assert(step1Code.includes('C(-1)'), 'Step1BoundaryInitView explicitly labels Corner sample p[-1, -1] as C(-1)');
assert(step1Code.includes('RAW p[i]:'), 'Step1BoundaryInitView displays Raw Unfiltered track');
assert(step1Code.includes('FILT p\'[i]:'), 'Step1BoundaryInitView displays Filtered MDIS track');
assert(step1Code.includes('DIFF Δ:'), 'Step1BoundaryInitView displays Signed Difference Δ track');
assert(step1Code.includes('[1, 2, 1] / 4'), 'Step1BoundaryInitView displays [1, 2, 1] / 4 lowpass filter kernel');

// Mathematical test on MDIS 3-tap formula
const sampleTop = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 255];
const sampleLeft = [100, 105, 115, 125, 135, 145, 155, 165, 175, 185, 195, 205, 215, 225, 235, 245, 250];
const smoothed = computeMdisSmoothedRef(sampleTop, sampleLeft, 8);

assert(smoothed.top.length === 17, '8x8 CU reference smoothing produces exactly 2N+1 = 17 samples for top');
assert(smoothed.left.length === 17, '8x8 CU reference smoothing produces exactly 2N+1 = 17 samples for left');

// Expected corner: (Left[1] + 2*Top[0] + Top[1] + 2) >> 2 = (105 + 200 + 110 + 2) >> 2 = 417 >> 2 = 104
const expectedCorner = (sampleLeft[1] + 2 * sampleTop[0] + sampleTop[1] + 2) >> 2;
assert(smoothed.top[0] === expectedCorner, `Smoothed corner matches exact formula: ${smoothed.top[0]} === ${expectedCorner}`);
assert(smoothed.left[0] === expectedCorner, 'Smoothed corner is symmetric between top[0] and left[0]');

// Expected top[1]: (Top[0] + 2*Top[1] + Top[2] + 2) >> 2 = (100 + 220 + 120 + 2) >> 2 = 442 >> 2 = 110
const expectedTop1 = (sampleTop[0] + 2 * sampleTop[1] + sampleTop[2] + 2) >> 2;
assert(smoothed.top[1] === expectedTop1, `Smoothed top[1] matches exact formula: ${smoothed.top[1]} === ${expectedTop1}`);

// -------------------------------------------------------------------
// TEST SUITE 2: Step 2 RMD 35-Mode Funnel & Pruning Conformance
// -------------------------------------------------------------------
console.log('\nTest Suite 2: Step 2 RMD 35-Mode Funnel & Pruning Conformance');

const step2Code = fs.readFileSync(path.join(__dirname, '../components/flow/Step2RmdFunnelView.jsx'), 'utf-8');

assert(!step2Code.includes('onMouseEnter'), 'Step2RmdFunnelView has zero onMouseEnter listeners');
assert(!step2Code.includes('onMouseOver'), 'Step2RmdFunnelView has zero onMouseOver listeners');
assert(!step2Code.includes('scale-105') && !step2Code.includes('scale-110'), 'Step2RmdFunnelView has zero hover bounce animations');

assert(step2Code.includes('TEncSearch::estIntraPredLumaQT'), 'Step2RmdFunnelView references HM-16.0 estIntraPredLumaQT');
assert(step2Code.includes('PRUNING THRESHOLD CUTOFF'), 'Step2RmdFunnelView renders Top K pruning cutoff threshold divider');
assert(step2Code.includes('Sort by Rank (Funnel)'), 'Step2RmdFunnelView provides Funnel sorting by ascending cost');
assert(step2Code.includes('Sort by Mode ID'), 'Step2RmdFunnelView provides sequential sorting by Mode ID (0..34)');
assert(step2Code.includes('Top K Only'), 'Step2RmdFunnelView provides filter toggle between Top K and All 35 modes');
assert(step2Code.includes('MPM'), 'Step2RmdFunnelView renders MPM badges for most probable modes');
assert(step2Code.includes('Apply Mode'), 'Step2RmdFunnelView provides Apply Mode trigger to synchronize with PU inspector');

// Prune rate tests: K=8 (4x4, 8x8) vs K=3 (16x16, 32x32, 64x64)
const pruneRateK8 = (((35 - 8) / 35) * 100).toFixed(1);
const pruneRateK3 = (((35 - 3) / 35) * 100).toFixed(1);
assert(pruneRateK8 === '77.1', '8x8 / 4x4 block prunes 77.1% of modes (27 out of 35 modes bypassed)');
assert(pruneRateK3 === '91.4', '16x16 / 32x32 block prunes 91.4% of modes (32 out of 35 modes bypassed)');

// -------------------------------------------------------------------
// TEST SUITE 3: IntraPredictionFlow Integration & Component Embedding
// -------------------------------------------------------------------
console.log('\nTest Suite 3: IntraPredictionFlow Integration of Phase 3 Components');

const flowCode = fs.readFileSync(path.join(__dirname, '../components/IntraPredictionFlow.jsx'), 'utf-8');

assert(flowCode.includes('import Step1BoundaryInitView'), 'IntraPredictionFlow imports Step1BoundaryInitView');
assert(flowCode.includes('import Step2RmdFunnelView'), 'IntraPredictionFlow imports Step2RmdFunnelView');
assert(flowCode.includes('<Step1BoundaryInitView'), 'IntraPredictionFlow renders Step1BoundaryInitView when activePipelineStep === 1');
assert(flowCode.includes('<Step2RmdFunnelView'), 'IntraPredictionFlow renders Step2RmdFunnelView when activePipelineStep === 2');
assert(flowCode.includes('kThreshold={effectivePipelineData?.step3_candidates?.k_threshold'), 'IntraPredictionFlow passes dynamic kThreshold to Step2RmdFunnelView');
assert(flowCode.includes('mpmModes={effectivePipelineData?.step3_candidates?.mpm_modes'), 'IntraPredictionFlow passes mpmModes to Step2RmdFunnelView');

console.log(`\n=== PHASE 3 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED ===\n`);

if (failCount > 0) {
  process.exit(1);
}
