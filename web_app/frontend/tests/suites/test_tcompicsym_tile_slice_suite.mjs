/**
 * test_tcompicsym_tile_slice_suite.mjs
 * Comprehensive mathematical & architectural conformance suite for HM-18.0 TComPicSym,
 * TComTile, TComSlice, and TEncSlice interactive visualizer.
 */

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SLICE_CONSTRAINTS,
  computeCtuGridGeometry,
  initTiles,
  calculateNextCtuRsAddr,
  initCtuTsRsAddrMaps,
  partitionSlices,
  runTComPicSymSimulation,
} from '../../src/utils/tcomPicSymEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('\n=== RUNNING TCOMPICSYM: TILE & SLICE ARCHITECTURE TEST SUITE ===\n');

// ---------------------------------------------------------------------------
// Test Suite 1: TComPicSym::create() CTU Grid & 256 Base Partition Quantum
// ---------------------------------------------------------------------------
console.log('Test Suite 1: TComPicSym::create() CTU Grid & Boundary Padding (416×240)');
{
  const grid = computeCtuGridGeometry(416, 240, 64, 64, 4);
  assert.strictEqual(grid.frameWidthInCtus, 7, '416px / 64 = 6.5 -> 7 CTU columns');
  assert.strictEqual(grid.frameHeightInCtus, 4, '240px / 64 = 3.75 -> 4 CTU rows');
  assert.strictEqual(grid.numCtusInFrame, 28, '7 * 4 = 28 CTUs in frame');
  assert.strictEqual(grid.nominalWidth, 448, '7 * 64 = 448px nominal width');
  assert.strictEqual(grid.nominalHeight, 256, '4 * 64 = 256px nominal height');
  assert.strictEqual(grid.rightPadding, 32, '448 - 416 = 32px right boundary padding');
  assert.strictEqual(grid.bottomPadding, 16, '256 - 240 = 16px bottom boundary padding');
  assert.strictEqual(grid.minCuWidth, 4, '64 >> 4 = 4px min partition width');
  assert.strictEqual(grid.numPartInCtuWidth, 16, '64 / 4 = 16 partitions per CTU side');
  assert.strictEqual(grid.numPartitionsInCtu, 256, '1 << (4 << 1) = 256 base 4x4 partitions');

  // Verify interior vs boundary CTUs
  const ctu0 = grid.ctuList[0]; // top-left (0, 0)
  assert.strictEqual(ctu0.isBoundary, false);
  assert.strictEqual(ctu0.validW, 64);
  assert.strictEqual(ctu0.validH, 64);

  const ctu6 = grid.ctuList[6]; // right-most col 6, row 0
  assert.strictEqual(ctu6.isRightBoundary, true);
  assert.strictEqual(ctu6.isBottomBoundary, false);
  assert.strictEqual(ctu6.validW, 32);
  assert.strictEqual(ctu6.validH, 64);

  const ctu27 = grid.ctuList[27]; // bottom-right corner (col 6, row 3: px=384, py=192)
  assert.strictEqual(ctu27.isRightBoundary, true);
  assert.strictEqual(ctu27.isBottomBoundary, true);
  assert.strictEqual(ctu27.validW, 32, '416 - 384 = 32px valid width');
  assert.strictEqual(ctu27.validH, 48, '240 - 192 = 48px valid height (16px bottom padding)');

  console.log('  ✓ PASS: RaceHorses 416×240 CTU grid (7×4=28), padding (+32px/+16px), and 256 SCU verified');
}

// ---------------------------------------------------------------------------
// Test Suite 2: TComPicSym::xInitTiles() Uniform & Non-Uniform 2D Partitioning
// ---------------------------------------------------------------------------
console.log('\nTest Suite 2: TComPicSym::xInitTiles() Uniform & Non-Uniform 2D Partitioning');
{
  const grid = computeCtuGridGeometry(416, 240, 64, 64, 4);

  // Uniform 2x1 tiles on 7x4 grid -> HM formula gives col0 = floor(7/2)=3, col1 = 7-3=4
  // Also test Non-Uniform 2x1 with col0 = 4, col1 = 3 (matching TCOM_PICSYM_STRUCTURE.md diagram)
  const uniform2x1 = initTiles(grid, { uniformSpacing: true, numCols: 2, numRows: 1 });
  assert.deepStrictEqual(uniform2x1.colWidths, [3, 4], 'Uniform 7 cols split into [3, 4] per HM integer formula');
  assert.strictEqual(uniform2x1.numTiles, 2);

  const nonUniform4_3 = initTiles(grid, {
    uniformSpacing: false,
    numCols: 2,
    numRows: 1,
    colWidths: [4],
  });
  assert.deepStrictEqual(nonUniform4_3.colWidths, [4, 3], 'Non-uniform [4, 3] tile columns');
  assert.strictEqual(nonUniform4_3.tileParameters[0].firstCtuRsAddr, 0);
  assert.strictEqual(nonUniform4_3.tileParameters[0].rightEdgePosInCtus, 3);
  assert.strictEqual(nonUniform4_3.tileParameters[0].bottomEdgePosInCtus, 3);
  assert.strictEqual(nonUniform4_3.tileParameters[1].firstCtuRsAddr, 4);
  assert.strictEqual(nonUniform4_3.tileParameters[1].rightEdgePosInCtus, 6);
  assert.strictEqual(nonUniform4_3.tileParameters[1].bottomEdgePosInCtus, 3);

  // Verify m_puiTileIdxMap for RS 0..6 (first row)
  assert.deepStrictEqual(
    nonUniform4_3.tileIdxMap.slice(0, 7),
    [0, 0, 0, 0, 1, 1, 1],
    'Row 0 m_puiTileIdxMap must map RS 0..3 -> Tile 0 and RS 4..6 -> Tile 1'
  );

  // Verify ITU-T H.265 / HM-18.0 Main Profile minimum tile constraints (>= 256px width, >= 64px height)
  assert.strictEqual(uniform2x1.isHevcMainProfileCompliant, false, 'Uniform 2x1 on 416px violates >= 256px min width');
  assert.strictEqual(uniform2x1.tileParameters[0].isWidthViolated, true, 'Tile 0 (192px) is marked width violated');
  assert.strictEqual(uniform2x1.tileParameters[1].isWidthViolated, false, 'Tile 1 (256px) satisfies >= 256px');

  // Single tile default is always compliant
  const singleTile = initTiles(grid, { uniformSpacing: true, numCols: 1, numRows: 1 });
  assert.strictEqual(singleTile.isHevcMainProfileCompliant, true, 'Single tile 1x1 is always compliant');

  // 512x256 grid with 2x1 tiles (4 CTUs + 4 CTUs = 256px each) is fully compliant
  const grid512 = computeCtuGridGeometry(512, 256, 64, 64, 4);
  const compliant2x1 = initTiles(grid512, { uniformSpacing: true, numCols: 2, numRows: 1 });
  assert.strictEqual(compliant2x1.isHevcMainProfileCompliant, true, '2x1 tiles on 512px (4 CTUs each = 256px) is fully compliant');
  console.log('  ✓ PASS: Uniform [3,4] and Non-Uniform [4,3] TComTile parameters, Main Profile limits, & m_puiTileIdxMap verified');
}

// ---------------------------------------------------------------------------
// Test Suite 3: xInitCtuTsRsAddrMaps() & xCalculateNextCtuRSAddr() Bijection
// ---------------------------------------------------------------------------
console.log('\nTest Suite 3: xInitCtuTsRsAddrMaps() & xCalculateNextCtuRSAddr() Bijection');
{
  const grid = computeCtuGridGeometry(416, 240, 64, 64, 4);
  const tiles4_3 = initTiles(grid, {
    uniformSpacing: false,
    numCols: 2,
    numRows: 1,
    colWidths: [4],
  });
  const maps = initCtuTsRsAddrMaps(grid, tiles4_3.tileParameters, tiles4_3.tileIdxMap);

  // Both maps must have size N + 1 = 29 with sentinel [28] = 28
  assert.strictEqual(maps.ctuTsToRsAddrMap.length, 29);
  assert.strictEqual(maps.ctuRsToTsAddrMap.length, 29);
  assert.strictEqual(maps.ctuTsToRsAddrMap[28], 28, 'Sentinel m_ctuTsToRsAddrMap[28] === 28');
  assert.strictEqual(maps.ctuRsToTsAddrMap[28], 28, 'Sentinel m_ctuRsToTsAddrMap[28] === 28');

  // Verify exact Tile 0 scan order: TS 0..3 -> RS 0..3; TS 4 -> RS 7 (jump over Tile 1!); TS 15 -> RS 24
  assert.strictEqual(maps.ctuTsToRsAddrMap[0], 0);
  assert.strictEqual(maps.ctuTsToRsAddrMap[3], 3);
  assert.strictEqual(maps.ctuTsToRsAddrMap[4], 7, 'TS 4 must jump to RS 7 (row 1 of Tile 0)');
  assert.strictEqual(maps.ctuTsToRsAddrMap[15], 24, 'TS 15 is last CTU of Tile 0 (RS 24)');

  // Verify transition from end of Tile 0 (TS 15 / RS 24) to start of Tile 1 (TS 16 / RS 4)
  const nextAfterTile0 = calculateNextCtuRsAddr(24, grid, tiles4_3.tileParameters, tiles4_3.tileIdxMap);
  assert.strictEqual(nextAfterTile0, 4, 'After RS 24 (bottom-right of Tile 0), next RS must jump to RS 4 (top-left of Tile 1)');
  assert.strictEqual(maps.ctuTsToRsAddrMap[16], 4, 'TS 16 must map to RS 4');
  assert.strictEqual(maps.ctuTsToRsAddrMap[27], 27, 'TS 27 must map to RS 27');

  // Verify bijection for all 0..27
  for (let ts = 0; ts < 28; ts++) {
    const rs = maps.ctuTsToRsAddrMap[ts];
    assert.strictEqual(maps.ctuRsToTsAddrMap[rs], ts, `Bijection failed at TS=${ts}, RS=${rs}`);
  }
  console.log('  ✓ PASS: TS <-> RS bijection, Tile row jumps (RS 3 -> RS 7), Tile transitions (RS 24 -> RS 4), and [28]=28 sentinel verified');
}

// ---------------------------------------------------------------------------
// Test Suite 4: All 4 SliceConstraint Modes (NO_SLICES, FIXED_CTU, FIXED_BYTES, FIXED_TILES)
// ---------------------------------------------------------------------------
console.log('\nTest Suite 4: SliceConstraint Modes (0, 1, 2, 3) & Tile-Boundary Truncation');
{
  const grid = computeCtuGridGeometry(416, 240, 64, 64, 4);
  const tileInfo = initTiles(grid, {
    uniformSpacing: false,
    numCols: 2,
    numRows: 1,
    colWidths: [4],
  }); // Tile 0 has 16 CTUs [TS 0..16), Tile 1 has 12 CTUs [TS 16..28)
  const tsRsMaps = initCtuTsRsAddrMaps(grid, tileInfo.tileParameters, tileInfo.tileIdxMap);

  // Mode 0: NO_SLICES -> 1 Slice covering [0..28)
  const m0 = partitionSlices(grid, tileInfo, tsRsMaps, {
    sliceMode: SLICE_CONSTRAINTS.NO_SLICES,
  });
  assert.strictEqual(m0.apSlices.length, 1);
  assert.strictEqual(m0.apSlices[0].startCtuTsAddr, 0);
  assert.strictEqual(m0.apSlices[0].endCtuTsAddr, 28);

  // Mode 1: FIXED_NUMBER_OF_CTU = 10 with Tile boundary truncation
  // Tile 0 has 16 CTUs -> Slice 0 gets [0..10), Slice 1 gets truncated at Tile 0 end [10..16) (6 CTUs!)
  // Tile 1 has 12 CTUs -> Slice 2 gets [16..26), Slice 3 gets [26..28) (2 CTUs)
  const m1 = partitionSlices(grid, tileInfo, tsRsMaps, {
    sliceMode: SLICE_CONSTRAINTS.FIXED_NUMBER_OF_CTU,
    sliceArgument: 10,
    respectTileBoundaries: true,
  });
  assert.strictEqual(m1.apSlices.length, 4);
  assert.deepStrictEqual(
    m1.apSlices.map((s) => [s.startCtuTsAddr, s.endCtuTsAddr]),
    [
      [0, 10],
      [10, 16],
      [16, 26],
      [26, 28],
    ],
    'FIXED_NUMBER_OF_CTU=10 must truncate Slice #1 at Tile 0 boundary TS=16'
  );
  assert.strictEqual(m1.apSlices[1].terminatedByTileBoundary, true);

  // Mode 2: FIXED_NUMBER_OF_BYTES = 500 Bytes (4000 bits) with deterministic 1500 bits/CTU
  // Each slice can hold floor(4000 / 1500) = 2 CTUs (3000 bits <= 4000 bits; 3rd CTU would be 4500 > 4000)
  const uniformBitsMap = {};
  for (let rs = 0; rs < 28; rs++) uniformBitsMap[rs] = 1500;
  const m2 = partitionSlices(
    grid,
    tileInfo,
    tsRsMaps,
    {
      sliceMode: SLICE_CONSTRAINTS.FIXED_NUMBER_OF_BYTES,
      sliceArgument: 500,
      respectTileBoundaries: true,
    },
    uniformBitsMap
  );
  assert.strictEqual(m2.apSlices[0].numCtus, 2, 'Dynamic byte slice at 500B (4000b) and 1500b/CTU must cut after 2 CTUs');
  assert.strictEqual(m2.apSlices[0].terminatedByByteLimit, true);

  // Mode 3: FIXED_NUMBER_OF_TILES = 1 -> 2 Slices matching Tile 0 [0..16) and Tile 1 [16..28)
  const m3 = partitionSlices(grid, tileInfo, tsRsMaps, {
    sliceMode: SLICE_CONSTRAINTS.FIXED_NUMBER_OF_TILES,
    sliceArgument: 1,
  });
  assert.strictEqual(m3.apSlices.length, 2);
  assert.deepStrictEqual(m3.apSlices[0].ctuTsList.length, 16);
  assert.deepStrictEqual(m3.apSlices[1].ctuTsList.length, 12);

  console.log('  ✓ PASS: All 4 SliceConstraint modes (NO_SLICES, FIXED_CTU, FIXED_BYTES, FIXED_TILES) verified');
}

// ---------------------------------------------------------------------------
// Test Suite 5: TEncSlice::compressSlice() Execution Stepper & UI Integration
// ---------------------------------------------------------------------------
console.log('\nTest Suite 5: TEncSlice::compressSlice() Stepper & Step1FrameTree Integration');
{
  const sim = runTComPicSymSimulation({
    picWidth: 416,
    picHeight: 240,
    tileConfig: { uniformSpacing: false, numCols: 2, numRows: 1, colWidths: [4] },
    sliceConfig: { sliceMode: SLICE_CONSTRAINTS.FIXED_NUMBER_OF_CTU, sliceArgument: 10 },
  });
  assert.strictEqual(sim.grid.initialIdentityMap.length, 29, 'Initial identity map before xInitCtuTsRsAddrMaps has length 29');
  assert.strictEqual(sim.grid.initialIdentityMap[7], 7, 'Initial identity map[7] === 7');
  assert.strictEqual(sim.compressSteps.length, 28);
  assert.strictEqual(sim.compressSteps[3].isTileJumpOnNext, true, 'TS=3 (RS=3) jumps to RS=7 on next step');
  assert.strictEqual(sim.compressSteps[15].isTileJumpOnNext, true, 'TS=15 (RS=24) jumps to RS=4 (Tile 1) on next step');
  assert.strictEqual(sim.compressSteps[16].isTileBoundaryCrossed, true, 'TS=16 crosses into Tile 1');
  assert.strictEqual(sim.compressSteps[0].allocatedSliceCountAtStep, 1, 'At TS=0 only 1 slice is allocated in m_apSlices');
  assert.strictEqual(sim.compressSteps[10].allocatedSliceCountAtStep, 2, 'At TS=10 second slice is dynamically allocated in m_apSlices');
  assert.strictEqual(sim.compressSteps[16].isCabacReset, true, 'TS=16 (firstCtuRsAddrOfTile for Tile 1) triggers CABAC context reset');

  const visPath = resolve(__dirname, '../../src/components/stages/cp00_frame_gop/TComPicSymVisualizer.jsx');
  const visContent = readFileSync(visPath, 'utf8');
  assert(visContent.includes('m_ctuTsToRsAddrMap'), 'Visualizer renders m_ctuTsToRsAddrMap');
  assert(visContent.includes('m_puiTileIdxMap') || visContent.includes('m_tileParameters'), 'Visualizer renders tile parameters');
  assert(visContent.includes('m_apSlices'), 'Visualizer renders m_apSlices');
  assert(visContent.includes('m_pictureCtuArray'), 'Visualizer renders m_pictureCtuArray');
  assert(visContent.includes('TComPicSym C++ MEMORY ARRAYS'), 'Visualizer includes sticky right-column C++ memory array dock');
  assert(visContent.includes('inspectedCtuStep'), 'Visualizer displays live inspected CTU telemetry in right dock');
  assert(visContent.includes('handleDeselectCtu'), 'Visualizer contains handleDeselectCtu function');
  assert(visContent.includes('No CTU selected'), 'Visualizer renders clean placeholder when CTU is unselected');

  const s1Path = resolve(__dirname, '../../src/components/guided/Step1FrameTree.jsx');
  const s1Content = readFileSync(s1Path, 'utf8');
  assert(s1Content.includes('TComPicSymVisualizer'), 'Step1FrameTree integrates TComPicSymVisualizer');
  assert(s1Content.includes("id: 'picsym', label: 'Tile & Slice'"), 'Step1FrameTree exposes Tile & Slice sub-view tab');
  assert(s1Content.includes('ctuX={ctuX}'), 'Step1FrameTree forwards raw ctuX to allow null deselection');

  console.log('  ✓ PASS: TEncSlice::compressSlice() stepper, deselection/unselect, and Step1FrameTree UI integration verified');
}

console.log('\n=== ALL TCOMPICSYM: TILE & SLICE ARCHITECTURE TESTS PASSED (100% CONFORMANCE) ===\n');
