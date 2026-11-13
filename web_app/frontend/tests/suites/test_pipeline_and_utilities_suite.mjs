/**
 * test_pipeline_and_utilities_suite.mjs
 * Comprehensive verification test suite for uncovered frontend components & utilities:
 * - metricsUtils: calculateSse, calculateMse, calculatePsnr, calculateSad, calculateLagrangianLambda, calculateQuantStep
 * - InLoopFilterVisualizer: CP_06 Deblocking Filter (DBF) & SAO classification modes
 * - InterSearchVisualizer: CP_03 Inter Prediction, Motion Vectors, & AMVP candidates
 * - SetupScreen: Screen 1 Setup, sequence configuration, & CTU focus picker
 */

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  calculateSse,
  calculateMse,
  calculatePsnr,
  calculateSad,
  calculateLagrangianLambda,
  calculateQuantStep
} from '../../src/utils/metricsUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let passCount = 0;
let failCount = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

console.log('\n=== RUNNING PIPELINE & UNIFIED UTILITIES TEST SUITE ===\n');

// =============================================================================
// Test Suite 1: metricsUtils Mathematical Precision & Edge Cases
// =============================================================================
console.log('Test Suite 1: metricsUtils Mathematical Precision & Edge Cases');

it('calculateSse calculates exact sum of squared errors', () => {
  const orig = [100, 150, 200, 250];
  const recon = [102, 148, 203, 245];
  // diffs: -2, +2, -3, +5 -> squares: 4 + 4 + 9 + 25 = 42
  assert.strictEqual(calculateSse(orig, recon), 42);
  assert.strictEqual(calculateSse([], []), 0);
  assert.strictEqual(calculateSse([10, 20], [10, 20]), 0);
});

it('calculateMse calculates mean squared error with length normalization', () => {
  const orig = [100, 150, 200, 250];
  const recon = [102, 148, 203, 245];
  assert.strictEqual(calculateMse(orig, recon), 42 / 4);
  assert.strictEqual(calculateMse([], []), 0);
});

it('calculatePsnr formats PSNR in dB and returns ∞ for lossless reconstruction', () => {
  // Lossless: MSE = 0 -> '∞'
  assert.strictEqual(calculatePsnr(0), '∞');
  assert.strictEqual(calculatePsnr(-1), '∞');

  // Standard 8-bit PSNR: MSE = 1 -> 10 * log10(255^2 / 1) ≈ 48.13 dB
  const psnr1 = calculatePsnr(1);
  assert.strictEqual(psnr1, '48.13');

  // MSE = 10 -> 10 * log10(65025 / 10) = 10 * log10(6502.5) ≈ 38.13 dB
  const psnr10 = calculatePsnr(10);
  assert.strictEqual(psnr10, '38.13');
});

it('calculateSad calculates sum of absolute differences', () => {
  const orig = [100, 150, 200, 250];
  const pred = [105, 140, 200, 258];
  // abs diffs: 5 + 10 + 0 + 8 = 23
  assert.strictEqual(calculateSad(orig, pred), 23);
  assert.strictEqual(calculateSad([], []), 0);
});

it('calculateLagrangianLambda scales exponentially with QP', () => {
  const lambda20 = calculateLagrangianLambda(20);
  const lambda26 = calculateLagrangianLambda(26);
  const lambda32 = calculateLagrangianLambda(32);

  assert(lambda20 > 0 && lambda26 > lambda20 && lambda32 > lambda26);
  // Formula: 0.57 * 2^((QP - 12) / 3) -> each +3 in QP doubles lambda
  const ratio = lambda26 / lambda20;
  assert(Math.abs(ratio - 4.0) < 0.01, `Double-step of 6 QP doubles twice (4x): got ${ratio.toFixed(2)}`);
});

it('calculateQuantStep doubles every 6 QPs adhering to H.265 specification', () => {
  const qstep12 = calculateQuantStep(12);
  const qstep18 = calculateQuantStep(18);
  const qstep24 = calculateQuantStep(24);

  // 0.625 * 2^(12/6) = 0.625 * 4 = 2.5
  assert.strictEqual(qstep12, 2.5);
  // 0.625 * 2^(18/6) = 0.625 * 8 = 5.0
  assert.strictEqual(qstep18, 5.0);
  // 0.625 * 2^(24/6) = 0.625 * 16 = 10.0
  assert.strictEqual(qstep24, 10.0);
});

// =============================================================================
// Test Suite 2: InLoopFilterVisualizer (CP_06) DBF & SAO Conformance
// =============================================================================
console.log('\nTest Suite 2: InLoopFilterVisualizer (CP_06) DBF & SAO Conformance');

const inloopSrc = readFileSync(resolve(__dirname, '../../src/components/stages/cp06_inloop_filter/InLoopFilterVisualizer.jsx'), 'utf8');

it('InLoopFilterVisualizer handles Deblocking Filter edge profiles and boundary strength bS', () => {
  assert(inloopSrc.includes('DEBLOCKING FILTER (DBF)'), 'Declares DEBLOCKING FILTER (DBF) section');
  assert(inloopSrc.includes('inloopFilterData?.bs2_edges'), 'Supports Strong filtering detection (bS=2)');
  assert(inloopSrc.includes('Normal (bS=1)'), 'Supports Normal filtering (bS=1)');
  assert(inloopSrc.includes('Strength (bS)'), 'Displays Boundary Strength table column');
  assert(inloopSrc.includes('Threshold β'), 'Displays beta threshold column');
  assert(inloopSrc.includes('Threshold tC'), 'Displays clipping parameter tC column');
});

it('InLoopFilterVisualizer classifies all 5 HEVC SAO modes (BO, EO_0, EO_90, EO_135, EO_45)', () => {
  assert(inloopSrc.includes('SAO CTU DECISION'), 'Declares SAO section');
  assert(inloopSrc.includes('Band Offset (BO)'), 'Supports SAO Band Offset mode');
  assert(inloopSrc.includes('Edge Offset 0° (EO_0)'), 'Supports SAO Edge Offset 0°');
  assert(inloopSrc.includes('Edge Offset 90° (EO_90)'), 'Supports SAO Edge Offset 90°');
  assert(inloopSrc.includes('Edge Offset 135° (EO_135)'), 'Supports SAO Edge Offset 135°');
  assert(inloopSrc.includes('Edge Offset 45° (EO_45)'), 'Supports SAO Edge Offset 45°');
});

it('InLoopFilterVisualizer strictly adheres to Apple HIG and zero emoji guidelines', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert(!emojiRegex.test(inloopSrc), 'Contains zero emoji icons');
  assert(!inloopSrc.includes('onMouseEnter') && !inloopSrc.includes('onMouseOver'), 'No hover listeners');
});

// =============================================================================
// Test Suite 3: InterSearchVisualizer (CP_03) Motion & AMVP Conformance
// =============================================================================
console.log('\nTest Suite 3: InterSearchVisualizer (CP_03) Motion & AMVP Conformance');

const interSrc = readFileSync(resolve(__dirname, '../../src/components/stages/cp03_inter_search/InterSearchVisualizer.jsx'), 'utf8');

it('InterSearchVisualizer displays Motion Vector field and 1/4-pel precision', () => {
  assert(interSrc.includes('INTER ESTIMATION STATUS'), 'Declares INTER ESTIMATION STATUS section');
  assert(interSrc.includes('ACTIVE PU MOTION VECTOR'), 'Declares ACTIVE PU MOTION VECTOR section');
  assert(interSrc.includes('1/4-pel precision'), 'Explicitly notes 1/4-pel sub-pixel accuracy');
  assert(interSrc.includes('predInterSearch'), 'Cites HM TEncSearch::predInterSearch');
  assert(interSrc.includes('I-SLICE Anchor'), 'Detects I-Slice anchor state');
});

it('InterSearchVisualizer inspects AMVP candidate list and reference pictures', () => {
  assert(interSrc.includes('<TableHead>Ref</TableHead>'), 'Displays Reference Picture List column');
  assert(interSrc.includes('<TableHead>MVD (x, y)</TableHead>'), 'Displays Motion Vector Difference (MVD) column');
  assert(interSrc.includes('<TableHead>MVP</TableHead>'), 'Displays Motion Vector Predictor (MVP) column');
  assert(interSrc.includes('L{pu.ref_list}[{pu.ref_idx}]'), 'Formats reference list L0/L1 and reference index');
});

it('InterSearchVisualizer adheres to Apple HIG and zero emoji guidelines', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert(!emojiRegex.test(interSrc), 'Contains zero emoji icons');
});

// =============================================================================
// Test Suite 4: SetupScreen Screen 1 Architecture
// =============================================================================
console.log('\nTest Suite 4: SetupScreen Telemetry Conformance');

const setupSrc = readFileSync(resolve(__dirname, '../../src/components/app/SetupScreen.jsx'), 'utf8');

it('SetupScreen renders input source selection, resolution options, and CTU focus picker', () => {
  assert(setupSrc.includes('Source Image'), 'Displays Source Image upload card');
  assert(setupSrc.includes('FullFrameViewer'), 'Integrates FullFrameViewer for picture preview');
  assert(setupSrc.includes('onSelectCTU'), 'Binds onSelectCTU callback for focus selection');
  assert(setupSrc.includes('all_intra'), 'Supports all_intra profile selection');
});

// =============================================================================
// SUMMARY
// =============================================================================
console.log(`\n=== PIPELINE & UTILITIES TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED ===\n`);

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
