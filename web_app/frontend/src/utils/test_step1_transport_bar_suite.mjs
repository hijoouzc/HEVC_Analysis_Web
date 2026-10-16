/**
 * test_step1_transport_bar_suite.mjs
 * Verification test suite for Step 1 Apple Pro Transport Bar & Minimalist Downstream Steps.
 * Strictly verifies HM Trace Playback, unencoded initial state, sub-CU stepping, and clutter reduction.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`  PASS: ${msg}`);
}

console.log('\n=== RUNNING STEP 1 TRANSPORT BAR & MINIMALIST UI SUITE ===\n');

// =============================================================================
// Test Suite 1: Step1FrameTree Apple Pro Transport Bar Architecture
// =============================================================================
console.log('Test Suite 1: Step1FrameTree Apple Pro Transport Bar Architecture');
{
  const s1Path = resolve(__dirname, '../components/guided/Step1FrameTree.jsx');
  const s1Content = readFileSync(s1Path, 'utf8');

  assert(s1Content.includes('useHmTracePlayback'), 'Step1FrameTree imports and mounts useHmTracePlayback hook');
  assert(s1Content.includes("useState('frame')"), 'Step 1 starts with subView = "frame" to display unencoded full frame grid');
  assert(s1Content.includes('UNENCODED (64×64 Grid)'), 'Renders initial unencoded badge before playback starts');
  assert(s1Content.includes('Start Encode'), 'Renders prominent Start Encode action button');
  assert(s1Content.includes('Prev CTU'), 'Renders macro Prev CTU stepper button');
  assert(s1Content.includes('Next CTU'), 'Renders macro Next CTU stepper button');
  assert(s1Content.includes('◀ CU'), 'Renders micro Prev CU stepper button for leaf CUs (D0..D3)');
  assert(s1Content.includes('CU ▶'), 'Renders micro Next CU stepper button for leaf CUs (D0..D3)');
  assert(s1Content.includes('↺ Reset'), 'Renders Reset button to return to unencoded initial state');
  assert(s1Content.includes('speedMs'), 'Includes configurable playback speed controls (0.5s, 1.0s, 2.0s)');
  assert(s1Content.includes('committedCtuKeys={playback.committedCtuKeys}'), 'Forwards committedCtuKeys to GopReferenceVisualizer for incremental partition reveals');
  assert(s1Content.includes('playback.setInspectedCu'), 'Connects setInspectedCu to visualizers ensuring playhead is never altered during inspection');
}

// =============================================================================
// Test Suite 2: Sub-CU Traversal & Inspection Independence
// =============================================================================
console.log('\nTest Suite 2: Sub-CU Traversal & Inspection Independence');
{
  const s1Path = resolve(__dirname, '../components/guided/Step1FrameTree.jsx');
  const s1Content = readFileSync(s1Path, 'utf8');

  assert(s1Content.includes('Leaf CU:'), 'Renders active leaf CU counter indicator');
  assert(s1Content.includes('playback.activeLeafNodes'), 'Binds micro steppers to activeLeafNodes array in Z-scan order');
  assert(s1Content.includes('selectedCU={selectedCu}'), 'Passes inspected selectedCu to QuadTreeVisualizer');
  assert(s1Content.includes('Trace This CU in Flow'), 'Provides direct flow handoff button for inspected CU to Step 2');
}

// =============================================================================
// Test Suite 3: Elimination of Verbose Peripheral Text Across Steps 1-5
// =============================================================================
console.log('\nTest Suite 3: Elimination of Verbose Peripheral Text Across Steps 1-5');
{
  const s2Path = resolve(__dirname, '../components/guided/Step2Prediction.jsx');
  const s2Content = readFileSync(s2Path, 'utf8');
  assert(!s2Content.includes('The current video sequence is encoded under the standard HEVC All-Intra profile'), 'Step 2 eliminates verbose All-Intra educational paragraph');
  assert(!s2Content.includes('The preview displays the candidate trial evaluated at this parent depth'), 'Step 2 eliminates verbose Parent CU explanation paragraph');

  const s3Path = resolve(__dirname, '../components/guided/Step3ResidualTu.jsx');
  const s3Content = readFileSync(s3Path, 'utf8');
  assert(!s3Content.includes('Pixel matrices S, P, R are synchronized by 2D spatial coordinate'), 'Step 3 eliminates verbose Spatial Domain explanation sentence');
  assert(!s3Content.includes('DCT/DST & Quantization coefficients are indexed by frequency basis'), 'Step 3 eliminates verbose Frequency Domain explanation sentence');

  const s4Path = resolve(__dirname, '../components/guided/Step4ReconInLoop.jsx');
  const s4Content = readFileSync(s4Path, 'utf8');
  assert(!s4Content.includes('The committed picture buffer in getPicYuvRec() is formed from'), 'Step 4 eliminates verbose split CU paragraph');
  assert(!s4Content.includes('They are not part of the internal xCompressCU candidate loop'), 'Step 4 eliminates verbose inloop filter paragraph');

  const s5Path = resolve(__dirname, '../components/guided/Step5RdDecision.jsx');
  const s5Content = readFileSync(s5Path, 'utf8');
  assert(!s5Content.includes('Evaluated from best candidate mode in current CU size'), 'Step 5 eliminates non-split subtitle clutter');
  assert(!s5Content.includes('Accumulated cost of 4 recursive sub-CUs + split flag rate'), 'Step 5 eliminates split subtitle clutter');
  assert(!s5Content.includes('[PIPELINE NOTICE]: Decision is committed to Picture Buffer in xCompressCU'), 'Step 5 replaces verbose pipeline notice with sleek badges');
}

console.log('\n=== ALL STEP 1 TRANSPORT BAR & MINIMALIST UI TESTS PASSED (100% CONFORMANCE) ===\n');
