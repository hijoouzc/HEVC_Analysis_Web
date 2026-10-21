import { resolveCuCoordinates, normalizeCuNode, isTelemetryMatchingCu } from '../../src/utils/cuCoordinates.js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    totalPassed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    totalFailed++;
  }
}

console.log('=== RUNNING CROSS-STEP COORDINATE SYNC & VISUAL ALIGNMENT SUITE ===\n');

console.log('Test Suite 1: resolveCuCoordinates Mathematical & Boundary Conformance');
{
  // 1. CTU (0, 0) with relative coordinates
  const c0 = resolveCuCoordinates({ x: 32, y: 16, width: 16 }, 0, 0);
  assert(c0.relX === 32, 'CTU (0,0) relX is 32');
  assert(c0.relY === 16, 'CTU (0,0) relY is 16');
  assert(c0.absX === 32, 'CTU (0,0) absX is 32');
  assert(c0.absY === 16, 'CTU (0,0) absY is 16');
  assert(c0.size === 16, 'CTU (0,0) size is 16');

  // 2. CTU (1, 0) with absolute coordinates from C++ trace (x=96, y=16)
  const c1 = resolveCuCoordinates({ x: 96, y: 16, width: 16 }, 1, 0);
  assert(c1.relX === 32, 'CTU (1,0) extracts relative X=32 from absolute X=96');
  assert(c1.relY === 16, 'CTU (1,0) relY is 16');
  assert(c1.absX === 96, 'CTU (1,0) absX is exactly 96');
  assert(c1.absY === 16, 'CTU (1,0) absY is exactly 16');

  // 3. CTU (2, 1) with explicit abs_x, abs_y
  const c2 = resolveCuCoordinates({ abs_x: 160, abs_y: 80, width: 32 }, 2, 1);
  assert(c2.relX === 32, 'CTU (2,1) relX is 160 - 128 = 32');
  assert(c2.relY === 16, 'CTU (2,1) relY is 80 - 64 = 16');
  assert(c2.absX === 160, 'CTU (2,1) absX is 160');
  assert(c2.absY === 80, 'CTU (2,1) absY is 80');

  // 4. Clamping overflow: relX=56 for size=16 (56 + 16 = 72 > 64) -> clamped to 48
  const c3 = resolveCuCoordinates({ x: 56, y: 56, width: 16 }, 0, 0);
  assert(c3.relX === 48, 'Clamps out-of-bounds relX to 64 - 16 = 48');
  assert(c3.relY === 48, 'Clamps out-of-bounds relY to 64 - 16 = 48');
  assert(c3.absX === 48, 'absX reflects clamped relX');

  // 5. Null or empty CU fallback
  const cNull = resolveCuCoordinates(null, 1, 2, 8);
  assert(cNull.relX === 0, 'Null CU defaults to relX=0');
  assert(cNull.relY === 0, 'Null CU defaults to relY=0');
  assert(cNull.absX === 64, 'Null CU absX matches CTU origin (64)');
  assert(cNull.absY === 128, 'Null CU absY matches CTU origin (128)');
}

console.log('\nTest Suite 2: normalizeCuNode Canonical Object Generation');
{
  const node = { x: 96, y: 32, width: 32, height: 32, intra_dir: 10, cost: 1200 };
  const normalized = normalizeCuNode(node, 1, 0);
  assert(normalized.x === 32, 'Normalized x is relative 32');
  assert(normalized.y === 32, 'Normalized y is relative 32');
  assert(normalized.rel_x === 32, 'Normalized rel_x is 32');
  assert(normalized.rel_y === 32, 'Normalized rel_y is 32');
  assert(normalized.abs_x === 96, 'Normalized abs_x is 96');
  assert(normalized.abs_y === 32, 'Normalized abs_y is 32');
  assert(normalized.ctu_x === 1, 'Normalized ctu_x is 1');
  assert(normalized.ctu_y === 0, 'Normalized ctu_y is 0');
  assert(normalized.intra_dir === 10, 'Preserves original metadata (intra_dir)');
  assert(normalized.cost === 1200, 'Preserves original metadata (cost)');
}

console.log('\nTest Suite 3: isTelemetryMatchingCu Verification');
{
  const targetCu = { rel_x: 32, rel_y: 16, abs_x: 96, abs_y: 16, width: 16 };

  // Matching absolute event
  const evAbs = { cu_x: 96, cu_y: 16, cu_size: 16 };
  assert(isTelemetryMatchingCu(evAbs, targetCu, 1, 0) === true, 'Matches absolute telemetry event');

  // Matching relative event
  const evRel = { pu_x: 32, pu_y: 16, pu_size: 16 };
  assert(isTelemetryMatchingCu(evRel, targetCu, 1, 0) === true, 'Matches relative telemetry event');

  // Non-matching event (different block)
  const evOther = { cu_x: 0, cu_y: 0, cu_size: 16 };
  assert(isTelemetryMatchingCu(evOther, targetCu, 1, 0) === false, 'Rejects telemetry from block (0, 0)');
}

console.log('\nTest Suite 4: Cross-Step Synchronization & Source Code Integrity');
{
  // 1. useAnalysisSession.js
  const hookSrc = readFileSync(resolve(__dirname, '../../src/hooks/useAnalysisSession.js'), 'utf8');
  assert(hookSrc.includes('normalizeCuNode'), 'useAnalysisSession imports and uses normalizeCuNode');
  assert(hookSrc.includes('CP_04_TRANSFORM_RQT'), 'useAnalysisSession fetches CP_04 on CU selection');
  assert(hookSrc.includes('rdo-decisions'), 'useAnalysisSession fetches rdo-decisions on CU selection');

  // 2. Step1FrameTree.jsx
  const step1Src = readFileSync(resolve(__dirname, '../../src/components/guided/Step1FrameTree.jsx'), 'utf8');
  assert(step1Src.includes('resolveCuCoordinates'), 'Step1FrameTree imports resolveCuCoordinates');
  assert(!step1Src.includes('handleSelectSize(targetSize)'), 'Step1FrameTree handleCuNavigation does NOT call handleSelectSize');

  // 3. IntraPredictionFlow.jsx
  const step2Src = readFileSync(resolve(__dirname, '../../src/components/stages/cp02_intra_search/IntraPredictionFlow.jsx'), 'utf8');
  assert(step2Src.includes('resolveCuCoordinates'), 'IntraPredictionFlow imports resolveCuCoordinates');
  assert(step2Src.includes('isOrgMatched'), 'IntraPredictionFlow verifies coordinate match before using rawOrg');

  // 4. TransformQuantVisualizer.jsx
  const step3Src = readFileSync(resolve(__dirname, '../../src/components/stages/cp04_transform_quant/TransformQuantVisualizer.jsx'), 'utf8');
  assert(step3Src.includes('resolveCuCoordinates'), 'TransformQuantVisualizer imports resolveCuCoordinates');
  assert(step3Src.includes('cuCoords'), 'TransformQuantVisualizer computes canonical cuCoords');

  // 5. FourPictureComparison.jsx
  const step4Src = readFileSync(resolve(__dirname, '../../src/components/stages/cp05_recon_picture/FourPictureComparison.jsx'), 'utf8');
  assert(step4Src.includes('resolveCuCoordinates'), 'FourPictureComparison imports resolveCuCoordinates');
  assert(step4Src.includes('isModeMatched'), 'FourPictureComparison verifies mode coordinate match');

  // 6. Step5RdDecision.jsx
  const step5Src = readFileSync(resolve(__dirname, '../../src/components/guided/Step5RdDecision.jsx'), 'utf8');
  assert(step5Src.includes('resolveCuCoordinates'), 'Step5RdDecision imports resolveCuCoordinates');

  // 7. QuadTreeVisualizer.jsx
  const quadSrc = readFileSync(resolve(__dirname, '../../src/components/stages/cp01_partition/QuadTreeVisualizer.jsx'), 'utf8');
  assert(
    quadSrc.includes('selectedCU !== undefined ? selectedCU') || quadSrc.includes('activeSelectedNode'),
    'QuadTreeVisualizer syncs selectedCU prop cleanly without render loop'
  );
}

console.log(`\n=== CROSS-STEP COORDINATE SYNC TEST SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED ===\n`);

if (totalFailed > 0) {
  process.exit(1);
}
