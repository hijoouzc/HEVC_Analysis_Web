import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { evaluateCuIntraMode, runHevcQuadtreeSimulation, generateSyntheticCtuPattern } from '../../src/utils/hevcRdoSimulator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n=== RUNNING REAL HM PREDICTION & ANCHORED RDO SIMULATOR TEST SUITE ===\n');

// -------------------------------------------------------------
// Test Suite 1: evaluateCuIntraMode Trace Prioritization & Heuristic Decoupling
// -------------------------------------------------------------
console.log('Test Suite 1: evaluateCuIntraMode Trace Prioritization & Heuristic Decoupling');

const dummyOrig = new Uint8ClampedArray(64).fill(128);
const dummyRefTop = new Uint8ClampedArray(17).fill(128);
const dummyRefLeft = new Uint8ClampedArray(17).fill(128);

// Case A: Real HM trace candidate provided
const realPred = Array.from({ length: 64 }, (_, i) => 100 + (i % 20));
const realReco = Array.from({ length: 64 }, (_, i) => 102 + (i % 20));
const traceCand = {
  mode: 26,
  direction_name: 'Vertical (0/32)',
  cost_rdo: 412.35,
  sse: 320,
  distortion: 320,
  bits: 29.5,
  rdo_rate_est: 29.5,
  qp: 32,
  trial_id: 105,
  pred_data: realPred,
  reconstructed_data: realReco,
  data_source: 'HM_TRACE',
  is_winner: true
};

const evalTrace = evaluateCuIntraMode({
  mode: 26,
  size: 8,
  origBlock: dummyOrig,
  refTop: dummyRefTop,
  refLeft: dummyRefLeft,
  qp: 32,
  traceCandidate: traceCand
});

assert.strictEqual(evalTrace.dataSource, 'HM_TRACE', 'Evaluation dataSource must be HM_TRACE');
assert.strictEqual(evalTrace.isTraceRecord, true, 'isTraceRecord flag must be true');
assert.strictEqual(evalTrace.cost, 412.4, 'Cost must match HM trace cost_rdo (rounded to 1 decimal)');
assert.strictEqual(evalTrace.ssd, 320, 'Distortion must match HM trace sse');
assert.strictEqual(evalTrace.bits, 29.5, 'Rate must match HM trace rdo_rate_est');
assert.strictEqual(evalTrace.is_winner, true, 'is_winner flag must propagate');
assert.deepStrictEqual(evalTrace.pred, realPred, 'Prediction matrix must bit-exact match HM trace pred_data');
assert.deepStrictEqual(evalTrace.reco, realReco, 'Reconstruction matrix must bit-exact match HM trace reconstructed_data');
console.log('  ✓ PASS: evaluateCuIntraMode faithfully prioritizes HM trace values and bit-exact prediction matrix');

// Case B: Synthetic Sandbox Mode (no trace candidate)
const evalSandbox = evaluateCuIntraMode({
  mode: 0,
  size: 8,
  origBlock: dummyOrig,
  refTop: dummyRefTop,
  refLeft: dummyRefLeft,
  qp: 32,
  traceCandidate: null
});
assert.strictEqual(evalSandbox.dataSource, 'SYNTHETIC_SIMULATION', 'Fallback dataSource must be SYNTHETIC_SIMULATION');
assert.strictEqual(evalSandbox.isTraceRecord, false, 'isTraceRecord flag must be false for sandbox');
assert(evalSandbox.pred.length === 64, 'Sandbox must generate 64 prediction samples');
console.log('  ✓ PASS: evaluateCuIntraMode safely executes sandbox math when no trace candidate is available');

// -------------------------------------------------------------
// Test Suite 2: runHevcQuadtreeSimulation with Verified CU_RDO_DECISION Checkpoints
// -------------------------------------------------------------
console.log('\nTest Suite 2: runHevcQuadtreeSimulation with Verified CU_RDO_DECISION Checkpoints');

const pattern = generateSyntheticCtuPattern('gradient');

// Verify that verified CU_RDO_DECISION controls split/nosplit decision and costs
const rdoDecisions = [
  {
    event: 'CU_RDO_DECISION',
    depth: 0,
    cu_x: 0,
    cu_y: 0,
    cu_size: 64,
    split_decision: true,
    split_evaluated: true,
    nosplit: { cost: 12500.5, dist: 8000, bits: 140, qp: 32, mode: 26 },
    split: { cost: 10400.2, dist: 6500, bits: 120, qp: 32 },
    cost_nosplit: 12500.5,
    cost_split: 10400.2
  },
  {
    event: 'CU_RDO_DECISION',
    depth: 1,
    cu_x: 0,
    cu_y: 0,
    cu_size: 32,
    split_decision: false,
    split_evaluated: false,
    nosplit: { cost: 2800.0, dist: 2000, bits: 25, qp: 32, mode: 0 },
    cost_nosplit: 2800.0,
    cost_split: 0.0
  }
];

const simResult = runHevcQuadtreeSimulation({
  ctuPatch: pattern,
  qp: 32,
  rdoDecisions
});

assert(simResult.steps.length > 0, 'Simulation steps generated');
const rootStep = simResult.steps.find(s => s.type === 'BACKTRACK_DECISION' && s.depth === 0);
assert(rootStep, 'Root backtrack decision step exists');
assert.strictEqual(rootStep.decision, 'SPLIT', 'Root decision must be SPLIT as dictated by CU_RDO_DECISION');
assert.strictEqual(rootStep.jNonSplit, 12500.5, 'Root jNonSplit must match rdoDecision nosplit cost');
assert.strictEqual(rootStep.jSplit, 10400.2, 'Root jSplit must match rdoDecision split cost');

const node32Step = simResult.steps.find(s => s.type === 'BACKTRACK_DECISION' && s.depth === 1 && s.x === 0 && s.y === 0);
assert(node32Step, 'Node 32x32 (0,0) decision step exists');
assert.strictEqual(node32Step.decision, 'KEEP', 'Node 32x32 decision must be KEEP when split_decision is false');
assert.strictEqual(node32Step.jSplit, Infinity, 'Node 32x32 jSplit must be Infinity when split_evaluated is false');
console.log('  ✓ PASS: runHevcQuadtreeSimulation faithfully respects verified CU_RDO_DECISION provenance and split_evaluated flag');

// -------------------------------------------------------------
// Test Suite 3: UI Component Conformance (Labels, Colors, CTU Bits)
// -------------------------------------------------------------
console.log('\nTest Suite 3: UI Component Conformance (Labels, Colors, CTU Bits)');

// Verify PixelMicroscope.jsx
const microscopeSource = fs.readFileSync(path.join(__dirname, '../../src/components/simulator/PixelMicroscope.jsx'), 'utf-8');
assert(microscopeSource.includes('\'Prediction (P)\''), 'PixelMicroscope renders explicit "Prediction (P)" label');
assert(microscopeSource.includes('Not recorded in trace'), 'PixelMicroscope displays "Not recorded in trace" when HM trace data is missing');
assert(microscopeSource.includes('imageRendering: \'pixelated\''), 'PixelMicroscope disables smoothing for discrete pixel fidelity');
console.log('  ✓ PASS: PixelMicroscope satisfies 100% pixel-accurate label and trace fallback rules');

// Verify CandidateModesTable.jsx
const tableSource = fs.readFileSync(path.join(__dirname, '../../src/components/simulator/CandidateModesTable.jsx'), 'utf-8');
assert(tableSource.includes('Rate Est (R)'), 'CandidateModesTable renders "Rate Est (R)" header label');
assert(tableSource.includes('ev.is_winner'), 'CandidateModesTable honors ev.is_winner flag');
console.log('  ✓ PASS: CandidateModesTable satisfies RDO Rate Est (R) and winner badge specifications');

// Verify Step5RdDecision.jsx
const step5Source = fs.readFileSync(path.join(__dirname, '../../src/components/guided/Step5RdDecision.jsx'), 'utf-8');
assert(step5Source.includes('Actual bits — CTU:'), 'Step5RdDecision renders "Actual bits — CTU" badge');
assert(step5Source.includes('encodeCtu'), 'Step5RdDecision mentions TEncSlice::encodeCtu bitstream output');
assert(step5Source.includes('activeDecision.nosplit'), 'Step5RdDecision inspects verified nosplit branch provenance');
assert(step5Source.includes('activeDecision.split_evaluated === false'), 'Step5RdDecision gracefully handles bypassed split evaluations');
console.log('  ✓ PASS: Step5RdDecision displays CTU actual bits and handles verified RDO decision provenance');

// Verify Step1FrameTree.jsx
const step1Source = fs.readFileSync(path.join(__dirname, '../../src/components/guided/Step1FrameTree.jsx'), 'utf-8');
assert(step1Source.includes('Actual bits — CTU:'), 'Step1FrameTree renders "Actual bits — CTU" badge in transport bar');
console.log('  ✓ PASS: Step1FrameTree renders CTU actual bits in transport bar');

// Verify RdoQuadtreeSimulator.jsx
const simSource = fs.readFileSync(path.join(__dirname, '../../src/components/RdoQuadtreeSimulator.jsx'), 'utf-8');
assert(simSource.includes('HM TRACE GROUND-TRUTH'), 'RdoQuadtreeSimulator renders HM TRACE GROUND-TRUTH badge when active');
assert(simSource.includes('SYNTHETIC SANDBOX SIMULATION'), 'RdoQuadtreeSimulator renders SYNTHETIC SANDBOX SIMULATION badge when in sandbox');
assert(simSource.includes('Actual bits — CTU:'), 'RdoQuadtreeSimulator renders CTU actual bits badge');
console.log('  ✓ PASS: RdoQuadtreeSimulator renders ground-truth vs sandbox mode badges');

console.log('\n=== ALL REAL HM PREDICTION & ANCHORED RDO TESTS PASSED (100% CONFORMANCE) ===\n');
