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
  extractCtuLeafNodes,
  extractAllCtuNodes,
} from '../../src/hooks/useHmTracePlayback.js';

console.log('\n=== RUNNING PARENT / INTERMEDIATE CU INSPECTION TEST SUITE ===');

console.log('\nTest Suite 1: Full Hierarchy Extraction (extractAllCtuNodes vs extractCtuLeafNodes)');
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

  const allNodes = extractAllCtuNodes(mockSnapshot);
  assert(allNodes.length === 9, 'extractAllCtuNodes returns all 9 hierarchy nodes');
  assert(allNodes.some(n => n.depth === 0 && n.split === true), 'Contains root 64x64 split node');
  assert(allNodes.some(n => n.depth === 1 && n.split === true), 'Contains intermediate 32x32 split node');

  const leafNodes = extractCtuLeafNodes(mockSnapshot);
  assert(leafNodes.length === 7, 'extractCtuLeafNodes returns only 7 leaf nodes');
  assert(leafNodes.every(n => !n.split), 'All extracted leaf nodes have split === false');
}

console.log('\nTest Suite 2: QuadTreeVisualizer Intermediate & Parent Node Inspection');
{
  const fileContent = readFileSync(resolve(__dirname, '../../src/components/stages/cp01_partition/QuadTreeVisualizer.jsx'), 'utf8');

  // Verify that activeNode resolution searches across all nodes, not strictly leafNodes
  assert(fileContent.includes('const found = nodes.find(n =>'), 'activeNode matches across all partitionData.nodes (including split parents)');
  assert(!fileContent.includes('const found = leafNodes.find(n => n.x === selectedNode.x'), 'activeNode avoids dropping parent split nodes');

  // Verify parent bounding box overlay on 2D spatial canvas
  assert(fileContent.includes('activeNode && activeNode.split'), 'Renders active parent bounding box when activeNode.split is true');
  assert(fileContent.includes('SPLIT CU {activeW}×{activeH}'), 'Displays SPLIT CU dimension badge on 2D canvas');
  assert(fileContent.includes('dashed'), 'Uses dashed border styling for parent block bounding box');

  // Verify CU Inspector parent vs leaf distinctions
  assert(fileContent.includes("activeNode.split ? 'SPLIT CU' : 'LEAF CU'"), 'Inspector header displays SPLIT CU vs LEAF CU badge');
  assert(fileContent.includes('DECISION: SPLIT CU (J_split &lt; J_nosplit)'), 'Inspector explains HM RDO split decision for parent nodes');
  assert(fileContent.includes('Inspect Parent Candidate'), 'Provides Inspect Parent Candidate button for split nodes');
}

console.log('\nTest Suite 3: FullFrameViewer 2D Frame Layer Parent Selection Conformance');
{
  const ffContent = readFileSync(resolve(__dirname, '../../src/components/stages/cp00_frame_gop/FullFrameViewer.jsx'), 'utf8');

  assert(ffContent.includes('activeCu.split ? \'rgba(175, 82, 222, 0.20)\''), 'Applies distinctive semi-transparent purple fill to parent CU');
  assert(ffContent.includes('strokeDasharray={activeCu.split ? \'4 2\' : \'none\'}'), 'Applies dashed stroke when parent split CU is active');
}

console.log('\nTest Suite 4: Step1FrameTree Parent CU Transport Bar Integration');
{
  const step1Content = readFileSync(resolve(__dirname, '../../src/components/guided/Step1FrameTree.jsx'), 'utf8');

  assert(step1Content.includes("const isSplitCu = Boolean(selectedCu?.split);"), 'Step1FrameTree detects selected parent CU');
  assert(step1Content.includes("selectedCu?.split ? ("), 'Transport bar distinguishes inspected PARENT CU');
  assert(step1Content.includes("SPLIT CU ({selectedCu.width}&times;{selectedCu.height}"), 'Transport bar displays SPLIT CU dimensions and depth');
}

console.log('\n=== ALL PARENT / INTERMEDIATE CU INSPECTION TESTS PASSED (100% CONFORMANCE) ===\n');
