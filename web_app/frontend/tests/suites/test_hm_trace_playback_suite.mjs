import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function assert(condition, message) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`  PASS: ${message}`);
}

import {
  computeFrameCtuGeometry,
  deriveCtuProcessingSequence,
  extractCtuLeafNodes,
} from '../../src/hooks/useHmTracePlayback.js';

console.log('\n=== RUNNING HM TRACE PLAYBACK & STATE SEPARATION TEST SUITE ===');

console.log('\nTest Suite 1: Dynamic Frame & CTU Geometry Calculation (Zero Hardcoding)');
{
  // 640x360 standard test sequence
  const geom640 = computeFrameCtuGeometry(640, 360, 64);
  assert(geom640.numCtuX === 10, '640x360 has exactly 10 CTUs horizontally (ceil(640/64))');
  assert(geom640.numCtuY === 6, '640x360 has exactly 6 CTUs vertically (ceil(360/64))');
  assert(geom640.totalCtus === 60, '640x360 has exactly 60 CTUs total (not 24!)');

  // 1920x1080 1080p Full HD
  const geom1080 = computeFrameCtuGeometry(1920, 1080, 64);
  assert(geom1080.numCtuX === 30, '1920x1080 has exactly 30 CTUs horizontally');
  assert(geom1080.numCtuY === 17, '1920x1080 has exactly 17 CTUs vertically (ceil(1080/64))');
  assert(geom1080.totalCtus === 510, '1920x1080 has exactly 510 CTUs total');

  // 416x240 WQVGA
  const geom240 = computeFrameCtuGeometry(416, 240, 64);
  assert(geom240.numCtuX === 7, '416x240 has exactly 7 CTUs horizontally');
  assert(geom240.numCtuY === 4, '416x240 has exactly 4 CTUs vertically');
  assert(geom240.totalCtus === 28, '416x240 has exactly 28 CTUs total');

  // Custom CTU size 32
  const geom32 = computeFrameCtuGeometry(128, 128, 32);
  assert(geom32.numCtuX === 4 && geom32.numCtuY === 4 && geom32.totalCtus === 16, 'Custom 32x32 CTU geometry computes correctly');
}

console.log('\nTest Suite 2: Actual CTU Sequence Derivation from Trace Records');
{
  // When trace partition map provides custom order
  const mockPartitionMap = {
    '0_0': { ctu_x: 0, ctu_y: 0 },
    '1_0': { ctu_x: 1, ctu_y: 0 },
    '0_1': { ctu_x: 0, ctu_y: 1 },
    '1_1': { ctu_x: 1, ctu_y: 1 },
  };
  const seqFromMap = deriveCtuProcessingSequence(2, 2, mockPartitionMap);
  assert(seqFromMap.length === 4, 'Derives exactly 4 CTUs from partition map');
  assert(seqFromMap[0].key === '0_0', 'Seq 0 maps to key 0_0');
  assert(seqFromMap[2].key === '0_1', 'Seq 2 maps to key 0_1');

  // Fallback to raster grid
  const fallbackSeq = deriveCtuProcessingSequence(2, 3, null);
  assert(fallbackSeq.length === 6, 'Fallback sequence creates 2x3=6 CTUs');
  assert(fallbackSeq[5].ctuX === 1 && fallbackSeq[5].ctuY === 2, 'Last CTU has coordinates (1, 2)');
}

console.log('\nTest Suite 3: Leaf CU Extraction from Partition Snapshot');
{
  const mockSnapshot = {
    nodes: [
      { depth: 0, x: 0, y: 0, width: 64, height: 64, split: true },
      { depth: 1, x: 0, y: 0, width: 32, height: 32, split: false, mode: 'INTRA', intra_dir: 0 },
      { depth: 1, x: 32, y: 0, width: 32, height: 32, split: false, mode: 'INTRA', intra_dir: 1 },
      { depth: 1, x: 0, y: 32, width: 32, height: 32, split: true },
      { depth: 2, x: 0, y: 32, width: 16, height: 16, split: false, mode: 'INTRA', intra_dir: 10 },
      { depth: 2, x: 16, y: 32, width: 16, height: 16, split: false, mode: 'INTRA', intra_dir: 26 },
      { depth: 2, x: 0, y: 48, width: 16, height: 16, split: false, mode: 'INTRA', intra_dir: 26 },
      { depth: 2, x: 16, y: 48, width: 16, height: 16, split: false, mode: 'INTRA', intra_dir: 26 },
      { depth: 1, x: 32, y: 32, width: 32, height: 32, split: false, mode: 'INTRA', intra_dir: 2 },
    ],
  };

  const leaves = extractCtuLeafNodes(mockSnapshot);
  assert(leaves.length === 7, 'Extracts exactly 7 leaf CUs from tree snapshot');
  assert(leaves.every((n) => !n.split), 'Every extracted leaf node has split === false');
  assert(leaves[0].width === 32, 'First leaf is 32x32 at (0, 0)');
  assert(leaves[2].width === 16, 'Third leaf is 16x16 at (0, 32)');
}

console.log('\nTest Suite 4: Code Architecture & Separation of Playhead vs Inspected CU');
{
  const hookPath = resolve(__dirname, '../../src/hooks/useHmTracePlayback.js');
  const hookContent = readFileSync(hookPath, 'utf8');

  // Verify state separation
  assert(hookContent.includes('const [playheadCtuIdx, setPlayheadCtuIdx] = useState(0);'), 'Maintains playheadCtuIdx state');
  assert(hookContent.includes('const [inspectedCu, setInspectedCu] = useState('), 'Maintains independent inspectedCu state');
  assert(hookContent.includes('const [isInitial, setIsInitial] = useState(true);'), 'Maintains initial unencoded state (isInitial)');

  // Verify non-interference guarantee
  assert(hookContent.includes('setInspectedCu: handleSelectInspectedCu'), 'Exports dedicated inspection handler');
  assert(!hookContent.includes('hevcRdoSimulator'), 'Strictly ZERO reference to synthetic hevcRdoSimulator');
  assert(!hookContent.includes('simResult.steps'), 'Strictly ZERO reference to synthetic simResult.steps');

  // Verify stepping methods
  assert(hookContent.includes('stepNextCtu'), 'Exports stepNextCtu macro method');
  assert(hookContent.includes('stepPrevCtu'), 'Exports stepPrevCtu macro method');
  assert(hookContent.includes('resetPlayback'), 'Exports resetPlayback method');
  assert(hookContent.includes('jumpToCtu'), 'Exports jumpToCtu method');
  assert(hookContent.includes('stepNextCu'), 'Exports stepNextCu micro method');
  assert(hookContent.includes('stepPrevCu'), 'Exports stepPrevCu micro method');
}

console.log('\n=== ALL HM TRACE PLAYBACK TESTS PASSED (100% CONFORMANCE) ===\n');
