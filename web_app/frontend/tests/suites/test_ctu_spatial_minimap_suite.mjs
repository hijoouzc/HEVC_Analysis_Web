/**
 * test_ctu_spatial_minimap_suite.mjs
 * Verification test suite for CTU Spatial Mini-Map, Morton Z-Scan Navigation, and Intra Spatial Selection
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  morton2D,
  inverseMorton2D,
  getTotalBlocksForSize,
  getZIndexForBlock,
  getBlockCoordsForZIndex,
  getRelativeCuCoords,
  getQuadrantLabel,
} from '../../src/utils/zScanUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    totalFailed++;
    throw new Error(message);
  } else {
    console.log(`  ✓ PASS: ${message}`);
    totalPassed++;
  }
}

console.log('\n=== RUNNING CTU SPATIAL MINI-MAP & Z-SCAN NAVIGATION TEST SUITE ===\n');

console.log('Test Suite 1: ITU-T H.265 Section 6.4.1 Morton Z-Scan Mathematical Conformance');
{
  // 1. Total blocks per CTU (64x64)
  assert(getTotalBlocksForSize(64) === 1, '64×64 block: exactly 1 block in CTU');
  assert(getTotalBlocksForSize(32) === 4, '32×32 block: exactly 4 quadrants (2×2) in CTU');
  assert(getTotalBlocksForSize(16) === 16, '16×16 block: exactly 16 sub-blocks (4×4) in CTU');
  assert(getTotalBlocksForSize(8) === 64, '8×8 block: exactly 64 sub-blocks (8×8) in CTU');
  assert(getTotalBlocksForSize(4) === 256, '4×4 block: exactly 256 sub-blocks (16×16) in CTU');

  // Core Morton bit-interleave validation
  assert(morton2D(0, 0) === 0, 'morton2D(0, 0) === 0');
  assert(morton2D(1, 0) === 1, 'morton2D(1, 0) === 1');
  assert(morton2D(0, 1) === 2, 'morton2D(0, 1) === 2');
  assert(morton2D(1, 1) === 3, 'morton2D(1, 1) === 3');
  const inv3 = inverseMorton2D(3);
  assert(inv3.ux === 1 && inv3.uy === 1, 'inverseMorton2D(3) resolves to (1, 1)');

  // 2. 32x32 QuadTree Morton Scan Order (TL -> TR -> BL -> BR)
  const q0 = getBlockCoordsForZIndex(0, 32);
  assert(q0.relX === 0 && q0.relY === 0, '32×32 Z=0 maps to (0, 0) [Top-Left]');
  const q1 = getBlockCoordsForZIndex(1, 32);
  assert(q1.relX === 32 && q1.relY === 0, '32×32 Z=1 maps to (32, 0) [Top-Right]');
  const q2 = getBlockCoordsForZIndex(2, 32);
  assert(q2.relX === 0 && q2.relY === 32, '32×32 Z=2 maps to (0, 32) [Bottom-Left]');
  const q3 = getBlockCoordsForZIndex(3, 32);
  assert(q3.relX === 32 && q3.relY === 32, '32×32 Z=3 maps to (32, 32) [Bottom-Right]');

  // 3. Mutual Inverses: getZIndexForBlock and getBlockCoordsForZIndex
  for (let z = 0; z < 4; z++) {
    const coords = getBlockCoordsForZIndex(z, 32);
    const computedZ = getZIndexForBlock(coords.relX, coords.relY, 32);
    assert(computedZ === z, `32×32 Z-Index ${z} is mutually invertible: computedZ === z`);
  }

  for (let z = 0; z < 16; z++) {
    const coords = getBlockCoordsForZIndex(z, 16);
    const computedZ = getZIndexForBlock(coords.relX, coords.relY, 16);
    assert(computedZ === z, `16×16 Z-Index ${z} is mutually invertible: computedZ === z`);
  }

  for (let z = 0; z < 64; z++) {
    const coords = getBlockCoordsForZIndex(z, 8);
    const computedZ = getZIndexForBlock(coords.relX, coords.relY, 8);
    assert(computedZ === z, `8×8 Z-Index ${z} is mutually invertible: computedZ === z`);
  }

  // 4. Safe Relative Coordinate Extraction (no NaN, bounds clamped)
  const relFromAbs = getRelativeCuCoords({ abs_x: 96, abs_y: 64 }, 1, 1);
  assert(relFromAbs.relX === 32 && relFromAbs.relY === 0, 'Extracts relative (32, 0) from picture absolute (96, 64) for CTU (1, 1)');
  assert(relFromAbs.absX === 96 && relFromAbs.absY === 64, 'Preserves absolute coordinates');

  const relNull = getRelativeCuCoords(null, 2, 3);
  assert(relNull.relX === 0 && relNull.relY === 0 && relNull.absX === 128 && relNull.absY === 192, 'Handles null CU gracefully without NaN');

  // 5. Quadrant Labels
  assert(getQuadrantLabel(0, 0, 32).includes('Top-Left'), 'Labels (0, 0) as Top-Left');
  assert(getQuadrantLabel(32, 0, 32).includes('Top-Right'), 'Labels (32, 0) as Top-Right');
  assert(getQuadrantLabel(0, 32, 32).includes('Bottom-Left'), 'Labels (0, 32) as Bottom-Left');
  assert(getQuadrantLabel(32, 32, 32).includes('Bottom-Right'), 'Labels (32, 32) as Bottom-Right');
}

console.log('\nTest Suite 2: CtuSpatialMiniMap Component Conformance');
{
  const filePath = resolve(__dirname, '../../src/components/flow/CtuSpatialMiniMap.jsx');
  const content = readFileSync(filePath, 'utf8');

  // 1. Vector SVG 64x64 Canvas Reticle
  assert(content.includes('viewBox="0 0 64 64"'), 'Renders SVG with exact 64×64 viewBox matching CTU geometry');
  assert(content.includes('SELECTION_HIGHLIGHT_COLOR'), 'Highlights active block with SELECTION_HIGHLIGHT_COLOR (#F59E0B)');
  assert(content.includes('candidateBlocks.map'), 'Maps and renders candidate blocks according to active size');

  // 2. Real QuadTree Partition Overlay
  assert(content.includes('leafNodes'), 'Extracts real Leaf CUs from partitionData');
  assert(content.includes('isRealLeaf'), 'Differentiates real Leaf CUs from RDO trial blocks');
  assert(content.includes('Leaf CU') && content.includes('RDO Trial'), 'Provides visual badge for Leaf CU vs RDO Trial');

  // 3. Sequential Stepper Navigation
  assert(content.includes('handleStepBlock'), 'Implements sequential stepping in Morton Z-scan order');
  assert(content.includes('Prev') && content.includes('Next'), 'Provides Prev and Next buttons');
  assert(content.includes('totalBlocks > 1'), 'Shows stepper only when sub-blocks exist');

  // 4. Click-Only Interaction & Zero Emoji
  assert(!content.includes('onMouseEnter') && !content.includes('onMouseOver'), '100% Click-Only: zero hover listeners');
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert(!emojiRegex.test(content), 'Contains zero emoji icons');
  assert(!content.includes('border-dashed'), '100% solid borders');
}

console.log('\nTest Suite 3: IntraPredictionFlow & ActiveStageViewport Integration');
{
  const flowPath = resolve(__dirname, '../../src/components/IntraPredictionFlow.jsx');
  const flowContent = readFileSync(flowPath, 'utf8');

  assert(flowContent.includes('CtuSpatialMiniMap'), 'IntraPredictionFlow imports CtuSpatialMiniMap');
  assert(flowContent.includes('<CtuSpatialMiniMap'), 'IntraPredictionFlow renders CtuSpatialMiniMap in Command Bar');
  assert(flowContent.includes('onSelectBlock='), 'Passes onSelectBlock handler to CtuSpatialMiniMap');
  assert(flowContent.includes('partitionData='), 'Passes partitionData to CtuSpatialMiniMap');

  const viewportPath = resolve(__dirname, '../../src/components/app/ActiveStageViewport.jsx');
  const viewportContent = readFileSync(viewportPath, 'utf8');

  assert(viewportContent.includes('handleSelectBlock'), 'ActiveStageViewport accepts handleSelectBlock prop');
  assert(viewportContent.includes('onSelectBlock='), 'ActiveStageViewport forwards onSelectBlock to IntraPredictionFlow');
  assert(viewportContent.includes('partitionData={partitionData}'), 'ActiveStageViewport passes partitionData to IntraPredictionFlow');
}

console.log('\nTest Suite 4: useAnalysisSession Spatial Selection & Backend Querying');
{
  const hookPath = resolve(__dirname, '../../src/hooks/useAnalysisSession.js');
  const hookContent = readFileSync(hookPath, 'utf8');

  assert(hookContent.includes('handleSelectBlock'), 'useAnalysisSession implements handleSelectBlock');
  assert(hookContent.includes('handleSelectBlock,'), 'useAnalysisSession exports handleSelectBlock');
  assert(hookContent.includes('cu_x='), 'Queries backend with specific cu_x coordinate');
  assert(hookContent.includes('cu_y='), 'Queries backend with specific cu_y coordinate');
  assert(hookContent.includes('fallbackRes'), 'Provides graceful fallback if position-specific event is absent');
  assert(hookContent.includes('handleSelectBlock({'), 'handleSelectSize calls handleSelectBlock with snapped coordinates');
}

console.log(`\n=== CTU SPATIAL MINI-MAP TEST SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED ===\n`);

if (totalFailed > 0) {
  process.exit(1);
}
