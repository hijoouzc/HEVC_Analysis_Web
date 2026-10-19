import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPixelTrace, INTRA_PRED_ANGLES, INV_ANGLES } from '../../src/utils/intraTraceUtils.js';
import { getIntraModeInfo } from '../../src/utils/colorUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== RUNNING HEVC INTRA PREDICTION GROUNDTRUTH VERIFICATION SUITE ===\n');

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

// -------------------------------------------------------------
// TEST SUITE 1: ITU-T H.265 Specification Standards Conformance
// -------------------------------------------------------------
console.log('Test Suite 1: ITU-T H.265 Table Conformance');

assert(Object.keys(INTRA_PRED_ANGLES).length === 33, '33 Angular Modes defined (2 to 34)');
assert(INTRA_PRED_ANGLES[10] === 0, 'Mode 10 is pure Horizontal (angle = 0)');
assert(INTRA_PRED_ANGLES[26] === 0, 'Mode 26 is pure Vertical (angle = 0)');
assert(INTRA_PRED_ANGLES[2] === 32, 'Mode 2 is diagonal Bottom-Left (angle = +32)');
assert(INTRA_PRED_ANGLES[18] === -32, 'Mode 18 is diagonal Top-Left (angle = -32)');
assert(INTRA_PRED_ANGLES[34] === 32, 'Mode 34 is diagonal Top-Right (angle = +32)');

assert(INV_ANGLES['-32'] === 256, 'Inverse angle for -32 is 256 (32*8192 >> 8 equivalent)');
assert(INV_ANGLES['-2'] === 4096, 'Inverse angle for -2 is 4096');

// -------------------------------------------------------------
// TEST SUITE 2: Standard Mode Classifications & ITU-T Naming
// -------------------------------------------------------------
console.log('\nTest Suite 2: ITU-T Mode Category & Descriptions');

assert(getIntraModeInfo(0).type === 'Non-Angular (Planar)', 'Mode 0 is Non-Angular (Planar)');
assert(getIntraModeInfo(1).type === 'Non-Angular (DC)', 'Mode 1 is Non-Angular (DC)');
assert(getIntraModeInfo(10).type === 'Angular (Horizontal)', 'Mode 10 is Angular (Horizontal)');
assert(getIntraModeInfo(26).type === 'Angular (Vertical)', 'Mode 26 is Angular (Vertical)');
assert(getIntraModeInfo(2).type.includes('Angular'), 'Mode 2 is Angular');

// -------------------------------------------------------------
// TEST SUITE 3: HM-18.0 Groundtruth 35-Mode Bit-Exact Trace Validation
// -------------------------------------------------------------
console.log('\nTest Suite 3: HM-18.0 Reference Software 2,240 Pixel Bit-Exact Verification');

const fixturePath = path.resolve(__dirname, '../../../backend/tests/fixtures/sample_trace.jsonl');
assert(fs.existsSync(fixturePath), `Fixture trace exists at: ${fixturePath}`);

const lines = fs.readFileSync(fixturePath, 'utf-8').trim().split('\n');
const intraEvents = lines.map(l => JSON.parse(l)).filter(e => e.event === 'RDO_INTRA_SEARCH');
assert(intraEvents.length === 35, `Found all 35 intra search mode events (0 to 34) in trace`);

let totalPixels = 0;
let exactMatches = 0;
let residualMatches = 0;

for (const ev of intraEvents) {
  const mode = ev.mode;
  const predGt = ev.pred_data;
  const orgGt = ev.org_data;
  const resiGt = ev.resi_data;
  const refTop = ev.ref_top;
  const refLeft = ev.ref_left;
  const N = ev.cu_size || 8;

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      totalPixels++;
      const idx = y * N + x;
      const gtPredVal = predGt[idx];
      const gtOrgVal = orgGt[idx];
      const gtResiVal = resiGt[idx];

      // Verify Residual math in groundtruth: Org - Pred === Resi
      if (gtOrgVal - gtPredVal === gtResiVal) {
        residualMatches++;
      }

      // Verify mathematical formula from intraTraceUtils vs groundtruth
      const trace = getPixelTrace(mode, x, y, N, refTop, refLeft);
      if (trace.predictedVal === gtPredVal) {
        exactMatches++;
      }
    }
  }
}

assert(residualMatches === totalPixels, `All ${residualMatches}/${totalPixels} residuals satisfy S - P === R exactly`);
assert(exactMatches === totalPixels, `All ${exactMatches}/${totalPixels} pixels match HM-18.0 groundtruth with 100.00% precision`);

console.log(`\n=== INTRA TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED ===\n`);

if (failCount > 0) {
  process.exit(1);
}
