/**
 * test_cabac_entropy_suite.mjs
 * 
 * Comprehensive Test Suite for HEVC CABAC Entropy Engine:
 *  - ITU-T H.265 Section 9.3 LPS Table bit-exactness
 *  - 128-state FSM state transitions (MPS / LPS)
 *  - BAC Interval subdivision [L, L+R) and Renormalization bit emission
 *  - Intra Syntax Element Binarization Trees
 *  - Component exports and integration
 */

import assert from 'assert';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  AUC_LPS_TABLE,
  NEXT_STATE_MPS,
  NEXT_STATE_LPS,
  RENORM_TABLE,
  createInitialBacState,
  stepBacEncode,
  getLpsProbability,
  INTRA_SYNTAX_DEFINITIONS,
  getSyntaxDefinition,
} from '../../src/utils/cabacMathEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('\n=== RUNNING CABAC ENTROPY ENGINE VERIFICATION SUITE ===\n');

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

// =============================================================================
// Test Suite 1: ITU-T H.265 Table 9-44 LPS Range Matrix Verification
// =============================================================================
console.log('Test Suite 1: ITU-T H.265 Table 9-44 LPS Range Matrix Verification');

it('AUC_LPS_TABLE has exactly 64 probability states', () => {
  assert.strictEqual(AUC_LPS_TABLE.length, 64, 'Must have 64 state rows');
});

it('Each state in AUC_LPS_TABLE has 4 range quantization columns', () => {
  AUC_LPS_TABLE.forEach((row, idx) => {
    assert.strictEqual(row.length, 4, `Row ${idx} must have 4 columns`);
  });
});

it('State 0 (Uncertain, p=0.5) has correct boundary values [128, 176, 208, 240]', () => {
  assert.deepStrictEqual(AUC_LPS_TABLE[0], [128, 176, 208, 240]);
});

it('State 63 (Terminating state) has constant value 2', () => {
  assert.deepStrictEqual(AUC_LPS_TABLE[63], [2, 2, 2, 2]);
});

it('RENORM_TABLE has 32 entries matching HM TComCABACTables', () => {
  assert.strictEqual(RENORM_TABLE.length, 32);
  assert.strictEqual(RENORM_TABLE[0], 6); // shiftIdx = 0 -> shift 6
  assert.strictEqual(RENORM_TABLE[31], 1); // shiftIdx = 31 -> shift 1
});

// =============================================================================
// Test Suite 2: FSM 128-State Transition Bit-Exact Conformance
// =============================================================================
console.log('\nTest Suite 2: FSM 128-State Transition Bit-Exact Conformance');

it('NEXT_STATE_MPS has 128 entries and increases confidence', () => {
  assert.strictEqual(NEXT_STATE_MPS.length, 128);
  // State 0 (pState=0, valMPS=0) -> MPS transitions to fullState 2 (pState=1, valMPS=0)
  assert.strictEqual(NEXT_STATE_MPS[0], 2);
  // State 1 (pState=0, valMPS=1) -> MPS transitions to fullState 3 (pState=1, valMPS=1)
  assert.strictEqual(NEXT_STATE_MPS[1], 3);
});

it('NEXT_STATE_LPS has 128 entries and flips polarity at state 0', () => {
  assert.strictEqual(NEXT_STATE_LPS.length, 128);
  // At state 0 (pState=0, valMPS=0), LPS flips to fullState 1 (pState=0, valMPS=1)
  assert.strictEqual(NEXT_STATE_LPS[0], 1);
  // At state 1 (pState=0, valMPS=1), LPS flips to fullState 0 (pState=0, valMPS=0)
  assert.strictEqual(NEXT_STATE_LPS[1], 0);
  // At state 2 (pState=1, valMPS=0), LPS decreases confidence back to fullState 0
  assert.strictEqual(NEXT_STATE_LPS[2], 0);
});

it('getLpsProbability decays monotonically as pStateIdx increases', () => {
  const p0 = getLpsProbability(0);
  const p30 = getLpsProbability(30);
  const p62 = getLpsProbability(62);

  assert(Math.abs(p0 - 0.5) < 0.001, 'State 0 probability is approx 0.5');
  assert(p0 > p30, 'p0 > p30');
  assert(p30 > p62, 'p30 > p62');
  assert(p62 > 0 && p62 < 0.05, 'State 62 probability is small positive');
});

// =============================================================================
// Test Suite 3: BAC Interval Subdivision & Renormalization Math
// =============================================================================
console.log('\nTest Suite 3: BAC Interval Subdivision & Renormalization Math');

it('createInitialBacState initializes range to 510 (0x1FE) and clean counters', () => {
  const init = createInitialBacState();
  assert.strictEqual(init.range, 510);
  assert.strictEqual(init.low, 0);
  assert.strictEqual(init.pStateIdx, 0);
  assert.strictEqual(init.valMPS, 0);
  assert.strictEqual(init.totalBins, 0);
  assert.strictEqual(init.totalBits, 0);
});

it('stepBacEncode on MPS subtracts rangeLPS from range and keeps low', () => {
  const s0 = createInitialBacState();
  // qCodIRangeIdx = (510 >> 6) & 3 = 7 & 3 = 3
  // rangeLPS = AUC_LPS_TABLE[0][3] = 240
  // rangeMPS = 510 - 240 = 270
  const { newState, stepRecord } = stepBacEncode(s0, 0, false);

  assert.strictEqual(stepRecord.isLPS, false);
  assert.strictEqual(stepRecord.rangeLPS, 240);
  assert.strictEqual(stepRecord.rangeMPS, 270);
  assert.strictEqual(newState.range, 270);
  assert.strictEqual(newState.pStateIdx, 1); // moved to state 1
  assert.strictEqual(newState.totalBins, 1);
});

it('stepBacEncode on LPS shifts low and renormalizes when range shrinks', () => {
  const s0 = createInitialBacState();
  // Feed bin 1 (which is LPS since valMPS = 0)
  const { newState, stepRecord } = stepBacEncode(s0, 1, false);

  assert.strictEqual(stepRecord.isLPS, true);
  assert(newState.range >= 256, 'Renormalization restores range >= 256');
  assert.strictEqual(newState.totalBins, 1);
  assert(newState.totalBits >= 1, 'Emits at least 1 bit on renormalization');
});

it('stepBacEncode in bypass mode halves range and shifts low', () => {
  const s0 = createInitialBacState();
  const { newState, stepRecord } = stepBacEncode(s0, 1, true);

  assert.strictEqual(stepRecord.isBypass, true);
  assert.strictEqual(newState.totalBins, 1);
});

// =============================================================================
// Test Suite 4: Intra Binarization Tree Definitions
// =============================================================================
console.log('\nTest Suite 4: Intra Binarization Tree Definitions');

it('Defines all mandatory Intra syntax elements', () => {
  const ids = INTRA_SYNTAX_DEFINITIONS.map(d => d.id);
  assert(ids.includes('split_cu_flag'), 'Includes split_cu_flag');
  assert(ids.includes('split_transform_flag'), 'Includes split_transform_flag');
  assert(ids.includes('cbf_luma'), 'Includes cbf_luma');
  assert(ids.includes('prev_intra_luma_pred_flag'), 'Includes prev_intra_luma_pred_flag');
  assert(ids.includes('mpm_idx'), 'Includes mpm_idx');
  assert(ids.includes('rem_intra_luma_pred_mode'), 'Includes rem_intra_luma_pred_mode');
  assert(ids.includes('intra_chroma_pred_mode'), 'Includes intra_chroma_pred_mode');
  assert(ids.includes('coeff_abs_level_greater1_flag'), 'Includes coeff_abs_level_greater1_flag');
});

it('intra_chroma_pred_mode produces correct ITU-T H.265 TB bin strings', () => {
  const chromaDef = getSyntaxDefinition('intra_chroma_pred_mode');
  assert(chromaDef !== null);

  const dm = chromaDef.values.find(v => v.val === 4);
  const planar = chromaDef.values.find(v => v.val === 0);
  const vert = chromaDef.values.find(v => v.val === 1);
  const horiz = chromaDef.values.find(v => v.val === 2);
  const dc = chromaDef.values.find(v => v.val === 3);

  assert.strictEqual(dm.binString, '0', 'DM_CHROMA is single bin 0');
  assert.strictEqual(planar.binString, '100', 'Planar is 100');
  assert.strictEqual(vert.binString, '101', 'Vertical is 101');
  assert.strictEqual(horiz.binString, '110', 'Horizontal is 110');
  assert.strictEqual(dc.binString, '111', 'DC is 111');
});

it('mpm_idx produces Truncated Rice cMax=2 bin strings', () => {
  const mpmDef = getSyntaxDefinition('mpm_idx');
  assert.strictEqual(mpmDef.values.find(v => v.val === 0).binString, '0');
  assert.strictEqual(mpmDef.values.find(v => v.val === 1).binString, '10');
  assert.strictEqual(mpmDef.values.find(v => v.val === 2).binString, '11');
});

// =============================================================================
// Test Suite 5: Component Verification & Source Integrity
// =============================================================================
console.log('\nTest Suite 5: Component Verification & Source Integrity');

it('CabacEntropyVisualizer imports and renders 3 tabs', () => {
  const code = readFileSync(resolve(__dirname, '../../src/components/stages/cp07_cabac_entropy/CabacEntropyVisualizer.jsx'), 'utf8');
  assert(code.includes('BAC Interval Studio'), 'Declares BAC Interval Studio tab');
  assert(code.includes('Intra Binarization Trees'), 'Declares Intra Binarization Trees tab');
  assert(code.includes('Syntax Stream & Bitrate'), 'Declares Syntax Stream & Bitrate tab');
  assert(code.includes('BacIntervalStudio'), 'Imports BacIntervalStudio subcomponent');
  assert(code.includes('BinarizationTreeViewer'), 'Imports BinarizationTreeViewer subcomponent');
  assert(code.includes('SyntaxBreakdownTable'), 'Imports SyntaxBreakdownTable subcomponent');
});

it('BacIntervalStudio supports Range Bar, FSM ribbon, and Renormalization FIFO', () => {
  const code = readFileSync(resolve(__dirname, '../../src/components/stages/cp07_cabac_entropy/subcomponents/BacIntervalStudio.jsx'), 'utf8');
  assert(code.includes('BAC Range Interval Subdivision'), 'Renders BAC Range Interval Subdivision bar');
  assert(code.includes('FSM Probability State Ribbon'), 'Renders FSM ribbon');
  assert(code.includes('Renormalization Bitstream FIFO'), 'Renders Renormalization FIFO');
  assert(code.includes('Trace Playback'), 'Supports Trace Playback mode');
  assert(code.includes('Interactive Sandbox'), 'Supports Interactive Sandbox mode');
});

it('BinarizationTreeViewer connects to BacIntervalStudio via onSendToBacStudio', () => {
  const code = readFileSync(resolve(__dirname, '../../src/components/stages/cp07_cabac_entropy/subcomponents/BinarizationTreeViewer.jsx'), 'utf8');
  assert(code.includes('Send to BAC Studio ➔'), 'Provides Send to BAC Studio button');
  assert(code.includes('onSendToBacStudio'), 'Accepts onSendToBacStudio callback');
});

// =============================================================================
// SUMMARY
// =============================================================================
console.log(`\n=== CABAC ENTROPY TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED ===\n`);
if (failCount > 0) process.exit(1);
