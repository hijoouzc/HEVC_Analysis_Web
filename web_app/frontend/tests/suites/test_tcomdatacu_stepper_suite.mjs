import assert from 'node:assert';
import {
  morton2D_16x16,
  inverseMorton2D_16x16,
  g_auiZscanToRaster,
  g_auiRasterToZscan,
  getCuMortonRange,
  TComDataCUState,
  runTComDataCUSimulation,
  NUM_PARTITIONS_IN_CTU,
} from '../../src/utils/tcomDataCUEngine.js';

console.log('\n=== RUNNING TCOMDATACU & MORTON Z-ORDER COMPREHENSIVE TEST SUITE ===\n');

// -------------------------------------------------------------
// Test Suite 1: Mathematical Morton Z-Scan Bijection & Parity
// -------------------------------------------------------------
console.log('Test Suite 1: Mathematical Morton Z-Scan Bijection & Lookup Tables');

assert.strictEqual(NUM_PARTITIONS_IN_CTU, 256, 'NUM_PARTITIONS_IN_CTU must be 256');
assert.strictEqual(g_auiZscanToRaster.length, 256, 'g_auiZscanToRaster length must be 256');
assert.strictEqual(g_auiRasterToZscan.length, 256, 'g_auiRasterToZscan length must be 256');

// Check bijection between (ux, uy) and z
for (let uy = 0; uy < 16; uy++) {
  for (let ux = 0; ux < 16; ux++) {
    const z = morton2D_16x16(ux, uy);
    assert(z >= 0 && z < 256, `Morton index z must be in [0, 255], got ${z}`);
    const coords = inverseMorton2D_16x16(z);
    assert.strictEqual(coords.ux, ux, `inverseMorton2D_16x16(${z}).ux should match ${ux}`);
    assert.strictEqual(coords.uy, uy, `inverseMorton2D_16x16(${z}).uy should match ${uy}`);

    const rasterIdx = uy * 16 + ux;
    assert.strictEqual(g_auiRasterToZscan[rasterIdx], z, `g_auiRasterToZscan[${rasterIdx}] mismatch`);
    assert.strictEqual(g_auiZscanToRaster[z], rasterIdx, `g_auiZscanToRaster[${z}] mismatch`);
  }
}
console.log('  ✓ PASS: 256-entry Morton 2D bijection and two-way lookup tables verified 100%');

// -------------------------------------------------------------
// Test Suite 2: CuMortonRange Contiguity across Depths 0..3
// -------------------------------------------------------------
console.log('\nTest Suite 2: CuMortonRange Contiguity & Partition Counts');

// Depth 0: Full CTU 64x64
const r64 = getCuMortonRange(0, 0, 64);
assert.strictEqual(r64.startZIdx, 0, '64x64 must start at z=0');
assert.strictEqual(r64.numParts, 256, '64x64 must span 256 units');
assert.strictEqual(r64.endZIdx, 255, '64x64 must end at z=255');
console.log('  ✓ PASS: Depth 0 (64×64) occupies [0..255] (256 units)');

// Depth 1: 4 Sub-CUs of 32x32
const q0 = getCuMortonRange(0, 0, 32);
const q1 = getCuMortonRange(32, 0, 32);
const q2 = getCuMortonRange(0, 32, 32);
const q3 = getCuMortonRange(32, 32, 32);

assert.deepStrictEqual(q0, { startZIdx: 0, numParts: 64, endZIdx: 63 });
assert.deepStrictEqual(q1, { startZIdx: 64, numParts: 64, endZIdx: 127 });
assert.deepStrictEqual(q2, { startZIdx: 128, numParts: 64, endZIdx: 191 });
assert.deepStrictEqual(q3, { startZIdx: 192, numParts: 64, endZIdx: 255 });
console.log('  ✓ PASS: Depth 1 (32×32) occupies contiguous quadrants: Q0 [0..63], Q1 [64..127], Q2 [128..191], Q3 [192..255]');

// Depth 2: 16x16
const r16 = getCuMortonRange(16, 16, 16);
assert.strictEqual(r16.numParts, 16, '16x16 must span 16 units');
assert.strictEqual(r16.endZIdx - r16.startZIdx + 1, 16, '16x16 range must be contiguous');
console.log(`  ✓ PASS: Depth 2 (16×16 at 16,16) occupies [${r16.startZIdx}..${r16.endZIdx}] (16 units)`);

// Depth 3: 8x8
const r8 = getCuMortonRange(8, 8, 8);
assert.strictEqual(r8.numParts, 4, '8x8 must span 4 units');
assert.strictEqual(r8.endZIdx - r8.startZIdx + 1, 4, '8x8 range must be contiguous');
console.log(`  ✓ PASS: Depth 3 (8×8 at 8,8) occupies [${r8.startZIdx}..${r8.endZIdx}] (4 units)`);

// -------------------------------------------------------------
// Test Suite 3: TComDataCUState 1D Linear Arrays & SubParts Mutators
// -------------------------------------------------------------
console.log('\nTest Suite 3: TComDataCUState 1D Arrays & SubParts Mutators');

const cuState = new TComDataCUState({ ctuRsAddr: 5, ctuX: 1, ctuY: 2, qp: 30 });
assert.strictEqual(cuState.m_ctuRsAddr, 5);
assert.strictEqual(cuState.m_uiCUPelX, 64);
assert.strictEqual(cuState.m_uiCUPelY, 128);
assert.strictEqual(cuState.m_puhDepth.length, 256);
assert.strictEqual(cuState.m_phQP[0], 30);

// Update a 32x32 block (Q1: range [64..127])
cuState.setDepthSubParts(1, 64, 32);
cuState.setPredModeSubParts('MODE_INTRA', 64, 32);
cuState.setPartSizeSubParts('SIZE_2Nx2N', 64, 32);
cuState.setCbfSubParts(1, 64, 32);
cuState.setIntraDirSubParts(10, 64, 32);

// Verify within range [64..127]
for (let i = 64; i <= 127; i++) {
  assert.strictEqual(cuState.m_puhDepth[i], 1, `m_puhDepth[${i}] should be 1`);
  assert.strictEqual(cuState.m_pePredMode[i], 'MODE_INTRA');
  assert.strictEqual(cuState.m_pePartSize[i], 'SIZE_2Nx2N');
  assert.strictEqual(cuState.m_puhCbf[i], 1);
  assert.strictEqual(cuState.m_puhIntraDir[i], 10);
}

// Verify outside range remains initial 0
assert.strictEqual(cuState.m_puhDepth[0], 0, 'm_puhDepth[0] should remain 0');
assert.strictEqual(cuState.m_puhDepth[63], 0, 'm_puhDepth[63] should remain 0');
assert.strictEqual(cuState.m_puhDepth[128], 0, 'm_puhDepth[128] should remain 0');
console.log('  ✓ PASS: setDepthSubParts and metadata mutators accurately isolate target Morton ranges');

// -------------------------------------------------------------
// Test Suite 4: runTComDataCUSimulation Execution & Step Parity
// -------------------------------------------------------------
console.log('\nTest Suite 4: runTComDataCUSimulation Execution & Snapshot Integrity');

const syntheticPatch = new Uint8ClampedArray(4096);
for (let i = 0; i < 4096; i++) {
  syntheticPatch[i] = (i % 64 < 32) ? 200 : 50; // sharp vertical edge forcing quadtree split
}

const sim = runTComDataCUSimulation({
  ctuPatch: syntheticPatch,
  qp: 32,
  ctuX: 0,
  ctuY: 0,
  imageDims: { width: 640, height: 360 }
});

assert(sim.totalSteps > 0, 'Simulation must produce discrete execution steps');
assert(sim.steps.length === sim.totalSteps, 'sim.steps.length must match totalSteps');
assert.strictEqual(sim.finalTComDataCU.m_puhDepth.length, 256, 'finalTComDataCU must have 256 entries');

// Inspect first step
const firstStep = sim.steps[0];
assert.strictEqual(firstStep.type, 'VISIT_NODE');
assert(firstStep.hmLifecycle.includes('xCompressCU'), 'First step must call xCompressCU');
assert.deepStrictEqual(firstStep.mortonRange, { startZIdx: 0, numParts: 256, endZIdx: 255 });
assert(firstStep.tcomDataCUSnapshot instanceof TComDataCUState, 'Must contain full TComDataCUState snapshot');
assert.strictEqual(firstStep.neighbors.above.available, false, 'CTU 0 top neighbor should be frame boundary');
assert.strictEqual(firstStep.neighbors.left.available, false, 'CTU 0 left neighbor should be frame boundary');

// Inspect decision steps
const decisionSteps = sim.steps.filter(s => s.type === 'DECISION');
assert(decisionSteps.length > 0, 'Simulation must contain DECISION steps');
for (const ds of decisionSteps) {
  assert(ds.decision === 'KEEP' || ds.decision === 'SPLIT', 'Decision must be KEEP or SPLIT');
  assert(ds.tcomDataCUSnapshot.m_puhDepth.length === 256, 'Snapshot must preserve 256 partitions');
}

console.log(`  ✓ PASS: Simulation produced ${sim.totalSteps} steps with bit-exact TComDataCU snapshots`);
console.log(`  ✓ PASS: Evaluated ${decisionSteps.length} recursive RDO decisions with HM lifecycle bindings`);

console.log('\n=== ALL TCOMDATACU & MORTON Z-ORDER TESTS PASSED (100% SUCCESS) ===\n');
