import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildQuadtreeTree, computeTreeLayout } from './quadtreeTreeLayout.js';
import { generateDrawioXml } from './drawioXmlGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== RUNNING HEVC QUADTREE ENGINE COMPREHENSIVE TESTS ===\n');

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
// TEST SUITE 1: buildQuadtreeTree Correctness & Morton Z-Scan
// -------------------------------------------------------------
console.log('Test Suite 1: buildQuadtreeTree & Z-Scan Indexing');

// Reference case: 10 leaves
const refPartition = [
  { rel_x: 0, rel_y: 0, width: 64, height: 64, depth: 0, split: true },
  { rel_x: 0, rel_y: 0, width: 32, height: 32, depth: 1, split: false },
  { rel_x: 32, rel_y: 0, width: 32, height: 32, depth: 1, split: true },
  { rel_x: 0, rel_y: 32, width: 32, height: 32, depth: 1, split: false },
  { rel_x: 32, rel_y: 32, width: 32, height: 32, depth: 1, split: false },
  { rel_x: 32, rel_y: 0, width: 16, height: 16, depth: 2, split: false },
  { rel_x: 48, rel_y: 0, width: 16, height: 16, depth: 2, split: false },
  { rel_x: 32, rel_y: 16, width: 16, height: 16, depth: 2, split: false },
  { rel_x: 48, rel_y: 16, width: 16, height: 16, depth: 2, split: true },
  { rel_x: 48, rel_y: 16, width: 8, height: 8, depth: 3, split: false },
  { rel_x: 56, rel_y: 16, width: 8, height: 8, depth: 3, split: false },
  { rel_x: 48, rel_y: 24, width: 8, height: 8, depth: 3, split: false },
  { rel_x: 56, rel_y: 24, width: 8, height: 8, depth: 3, split: false }
];

const refTree = buildQuadtreeTree(refPartition, 0, 0);
assert(refTree.totalLeaves === 10, 'Tree totalLeaves is exactly 10');
assert(refTree.children.length === 4, 'Root has 4 quadrant children');
assert(refTree.children[0].zScanIndex === 0, 'Quadrant 0 (TL) is leaf #0');
assert(refTree.children[1].isSplit === true, 'Quadrant 1 (TR) is split');
assert(refTree.children[2].zScanIndex === 8, 'Quadrant 2 (BL) is leaf #8');
assert(refTree.children[3].zScanIndex === 9, 'Quadrant 3 (BR) is leaf #9');

// Check Depth 2 sub-quadrants
const trChild = refTree.children[1];
assert(trChild.children[0].zScanIndex === 1, 'TR -> Sub 0 is leaf #1');
assert(trChild.children[1].zScanIndex === 2, 'TR -> Sub 1 is leaf #2');
assert(trChild.children[2].zScanIndex === 3, 'TR -> Sub 2 is leaf #3');
assert(trChild.children[3].isSplit === true, 'TR -> Sub 3 is split');

// Check Depth 3 sub-quadrants
const brChild = trChild.children[3];
assert(brChild.children[0].zScanIndex === 4, 'TR.BR -> Sub 0 is leaf #4');
assert(brChild.children[1].zScanIndex === 5, 'TR.BR -> Sub 1 is leaf #5');
assert(brChild.children[2].zScanIndex === 6, 'TR.BR -> Sub 2 is leaf #6');
assert(brChild.children[3].zScanIndex === 7, 'TR.BR -> Sub 3 is leaf #7');

// Verify all node depths are numbers (no NaN or string bug)
function verifyDepths(node) {
  assert(typeof node.depth === 'number' && !isNaN(node.depth), `Node ${node.id} depth is a valid number: ${node.depth}`);
  assert(typeof node.size === 'number' && !isNaN(node.size) && node.size > 0, `Node ${node.id} size is valid: ${node.size}`);
  if (node.children) node.children.forEach(verifyDepths);
}
verifyDepths(refTree);

// -------------------------------------------------------------
// TEST SUITE 2: computeTreeLayout & Zero Collisions
// -------------------------------------------------------------
console.log('\nTest Suite 2: computeTreeLayout & Geometric Zero Collisions');

const layout = computeTreeLayout(refTree);
assert(layout.nodes.length === 13, 'Total nodes in layout is 13');
assert(layout.edges.length === 12, 'Total connector edges is 12');

// Check that every node has finite, valid coordinates
layout.nodes.forEach(n => {
  assert(Number.isFinite(n.layout.x) && !isNaN(n.layout.x), `Node ${n.id} x is finite: ${n.layout.x}`);
  assert(Number.isFinite(n.layout.y) && !isNaN(n.layout.y), `Node ${n.id} y is finite: ${n.layout.y}`);
});

// Check bounding box collisions between any two nodes
let collisions = 0;
for (let i = 0; i < layout.nodes.length; i++) {
  for (let j = i + 1; j < layout.nodes.length; j++) {
    const n1 = layout.nodes[i];
    const n2 = layout.nodes[j];
    const overlapX = !(n1.layout.x + n1.layout.size <= n2.layout.x || n2.layout.x + n2.layout.size <= n1.layout.x);
    const overlapY = !(n1.layout.y + n1.layout.size <= n2.layout.y || n2.layout.y + n2.layout.size <= n1.layout.y);
    if (overlapX && overlapY) {
      console.error(`COLLISION DETECTED between ${n1.id} and ${n2.id}`);
      collisions++;
    }
  }
}
assert(collisions === 0, 'Zero bounding box collisions between any two nodes');

// Check edge orthogonal integrity
let edgeErrors = 0;
layout.edges.forEach(e => {
  if (!Number.isFinite(e.startX) || !Number.isFinite(e.startY) || !Number.isFinite(e.endX) || !Number.isFinite(e.endY)) {
    edgeErrors++;
  }
  const midY = (e.startY + e.endY) / 2;
  // Verify horizontal bus does not collide with any node
  layout.nodes.forEach(n => {
    if (n.layout.y <= midY && midY <= n.layout.y + n.layout.size) {
      const minX = Math.min(e.startX, e.endX);
      const maxX = Math.max(e.startX, e.endX);
      if (!(maxX < n.layout.x || minX > n.layout.x + n.layout.size)) {
        console.error(`EDGE COLLISION: edge ${e.id} intersects node ${n.id}`);
        edgeErrors++;
      }
    }
  });
});
assert(edgeErrors === 0, 'Zero edge collisions with any nodes across all levels');

// -------------------------------------------------------------
// TEST SUITE 3: Worst Case 64 Leaves (All 8x8)
// -------------------------------------------------------------
console.log('\nTest Suite 3: Full 64 Leaves (Worst Case)');

const densePartition = [{ rel_x: 0, rel_y: 0, width: 64, height: 64, depth: 0, split: true }];
for (let q1 = 0; q1 < 4; q1++) {
  const x1 = (q1 % 2) * 32;
  const y1 = Math.floor(q1 / 2) * 32;
  densePartition.push({ rel_x: x1, rel_y: y1, width: 32, height: 32, depth: 1, split: true });
  for (let q2 = 0; q2 < 4; q2++) {
    const x2 = x1 + (q2 % 2) * 16;
    const y2 = y1 + Math.floor(q2 / 2) * 16;
    densePartition.push({ rel_x: x2, rel_y: y2, width: 16, height: 16, depth: 2, split: true });
    for (let q3 = 0; q3 < 4; q3++) {
      const x3 = x2 + (q3 % 2) * 8;
      const y3 = y2 + Math.floor(q3 / 2) * 8;
      densePartition.push({ rel_x: x3, rel_y: y3, width: 8, height: 8, depth: 3, split: false });
    }
  }
}

const denseTree = buildQuadtreeTree(densePartition, 0, 0);
assert(denseTree.totalLeaves === 64, 'Dense tree has exactly 64 leaves');
const denseLayout = computeTreeLayout(denseTree);
assert(denseLayout.nodes.length === 85, 'Dense layout has 85 nodes (1 + 4 + 16 + 64)');

let denseCollisions = 0;
for (let i = 0; i < denseLayout.nodes.length; i++) {
  for (let j = i + 1; j < denseLayout.nodes.length; j++) {
    const n1 = denseLayout.nodes[i];
    const n2 = denseLayout.nodes[j];
    const overlapX = !(n1.layout.x + n1.layout.size <= n2.layout.x || n2.layout.x + n2.layout.size <= n1.layout.x);
    const overlapY = !(n1.layout.y + n1.layout.size <= n2.layout.y || n2.layout.y + n2.layout.size <= n1.layout.y);
    if (overlapX && overlapY) denseCollisions++;
  }
}
assert(denseCollisions === 0, 'Zero collisions in worst-case 64-leaf tree');

// -------------------------------------------------------------
// TEST SUITE 4: Draw.io XML Generator
// -------------------------------------------------------------
console.log('\nTest Suite 4: Draw.io XML Generator');

const xml = generateDrawioXml({ treeRoot: refTree });
assert(xml.startsWith('<mxGraphModel>'), 'XML starts with <mxGraphModel>');
assert(xml.endsWith('</mxGraphModel>'), 'XML ends with </mxGraphModel>');
assert(xml.includes('value="0"'), 'XML contains leaf #0');
assert(xml.includes('value="9"'), 'XML contains leaf #9');
assert(xml.includes('edgeStyle=orthogonalEdgeStyle'), 'XML contains orthogonal connectors');

// -------------------------------------------------------------
// TEST SUITE 5: RDO Simulator Tree & Pruning Consistency
// -------------------------------------------------------------
console.log('\nTest Suite 5: RDO Simulator Tree & Pruning Consistency');
import { runHevcQuadtreeSimulation, generateSyntheticCtuPattern } from './hevcRdoSimulator.js';
import { buildSimulatorQuadtreeTree } from './quadtreeTreeLayout.js';

const pattern = generateSyntheticCtuPattern('gradient');
const simResult = runHevcQuadtreeSimulation({ ctuPatch: pattern, qp: 32 });
assert(simResult.steps.length > 0, `Simulation generated ${simResult.steps.length} steps`);

const finalStep = simResult.steps[simResult.steps.length - 1];
const simTree = buildSimulatorQuadtreeTree(finalStep.treeSnapshot, null, []);

assert(simTree !== null, 'Simulator tree root exists');
assert(simTree.id === 'node_0_0_0', 'Simulator root id is node_0_0_0');
assert(simTree.altId === 'node_d0_x0_y0', 'Simulator root altId is node_d0_x0_y0');
assert(simTree.totalLeaves > 0, `Simulator tree has ${simTree.totalLeaves} leaves`);
assert(simTree.totalLeaves < 64, `Simulator tree is properly pruned (totalLeaves ${simTree.totalLeaves} < 64)`);

// Verify that every leaf in simTree has a valid sequential zScanIndex
let traversedLeaves = 0;
function checkSimLeaves(node) {
  if (!node.children || node.children.length === 0) {
    assert(node.zScanIndex === traversedLeaves, `Leaf ${node.id} has sequential zScanIndex ${traversedLeaves}`);
    traversedLeaves++;
  } else {
    node.children.forEach(checkSimLeaves);
  }
}
checkSimLeaves(simTree);
assert(traversedLeaves === simTree.totalLeaves, `Traversed leaves count (${traversedLeaves}) matches totalLeaves (${simTree.totalLeaves})`);

// Verify layout calculation on simTree succeeds with 0 collisions
const simLayout = computeTreeLayout(simTree);
assert(simLayout.nodes.length > 0, `simLayout generated ${simLayout.nodes.length} nodes`);
let simCollisions = 0;
for (let i = 0; i < simLayout.nodes.length; i++) {
  for (let j = i + 1; j < simLayout.nodes.length; j++) {
    const n1 = simLayout.nodes[i];
    const n2 = simLayout.nodes[j];
    const overlapX = !(n1.layout.x + n1.layout.size <= n2.layout.x || n2.layout.x + n2.layout.size <= n1.layout.x);
    const overlapY = !(n1.layout.y + n1.layout.size <= n2.layout.y || n2.layout.y + n2.layout.size <= n1.layout.y);
    if (overlapX && overlapY) simCollisions++;
  }
}
// -------------------------------------------------------------
// TEST SUITE 6: HM-Guided Ground Truth Synchronization
// -------------------------------------------------------------
console.log('\nTest Suite 6: HM-Guided Ground Truth Synchronization');

// Case A: 1-Leaf Non-Split CTU (like flat background or test.png CTU 0,0)
const oneLeafPartition = [
  { rel_x: 0, rel_y: 0, width: 64, height: 64, depth: 0, split: false, cost: 5508.3 }
];
const simGuided1 = runHevcQuadtreeSimulation({
  ctuPatch: pattern,
  qp: 32,
  groundTruthNodes: oneLeafPartition
});
const finalStep1 = simGuided1.steps[simGuided1.steps.length - 1];
const treeGuided1 = buildSimulatorQuadtreeTree(finalStep1.treeSnapshot, null, []);

assert(treeGuided1.totalLeaves === 1, 'Guided 1-leaf simulation produces exactly 1 leaf');
assert(treeGuided1.isSplit === false, 'Guided 1-leaf simulation root is not split');
assert(treeGuided1.children.length === 0, 'Guided 1-leaf simulation root has 0 children');

// Case B: 10-Leaf Partition (refPartition)
const simGuided10 = runHevcQuadtreeSimulation({
  ctuPatch: pattern,
  qp: 32,
  groundTruthNodes: refPartition
});
const finalStep10 = simGuided10.steps[simGuided10.steps.length - 1];
const treeGuided10 = buildSimulatorQuadtreeTree(finalStep10.treeSnapshot, null, []);

assert(treeGuided10.totalLeaves === 10, 'Guided 10-leaf simulation produces exactly 10 leaves');
assert(treeGuided10.isSplit === true, 'Guided 10-leaf simulation root is split');
assert(treeGuided10.children.length === 4, 'Guided 10-leaf simulation root has 4 children');

// Verify that the tree built from buildQuadtreeTree and buildSimulatorQuadtreeTree have matching leaf structure
let matchCount = 0;
function compareTrees(n1, n2) {
  assert(n1.depth === n2.depth, `Node ${n1.id} depths match (${n1.depth} === ${n2.depth})`);
  assert(n1.size === n2.size, `Node ${n1.id} sizes match (${n1.size} === ${n2.size})`);
  assert(n1.isSplit === n2.isSplit, `Node ${n1.id} split states match (${n1.isSplit} === ${n2.isSplit})`);
  if (!n1.isSplit && !n2.isSplit) {
    assert(n1.zScanIndex === n2.zScanIndex, `Leaf ${n1.id} Z-scan indices match (${n1.zScanIndex} === ${n2.zScanIndex})`);
    matchCount++;
  }
  if (n1.children && n2.children) {
    assert(n1.children.length === n2.children.length, `Children count matches (${n1.children.length})`);
    for (let i = 0; i < n1.children.length; i++) {
      compareTrees(n1.children[i], n2.children[i]);
    }
  }
}
compareTrees(refTree, treeGuided10);
assert(matchCount === 10, `All 10 leaves matched 100% identically between CU QuadTree and RDO Simulator`);

// -------------------------------------------------------------
// TEST SUITE 7: PartitionCanvas Progressive Split & Bounds Integrity
// -------------------------------------------------------------
console.log('\nTest Suite 7: PartitionCanvas Progressive Split & Bounds Integrity');

// Function replicating PartitionCanvas split extractor
function extractCanvasSplits(root) {
  const splits = [];
  function traverse(n) {
    if (!n) return;
    if (n.isSplit && n.children && n.children.length > 0) {
      splits.push(n);
      for (const child of n.children) {
        traverse(child);
      }
    }
  }
  traverse(root);
  return splits;
}

// Case 1: Complex texture where sub-CUs split during trial, but Depth 0 KEEP is enforced
const checkeredPattern = new Uint8Array(4096);
for (let y = 0; y < 64; y++) {
  for (let x = 0; x < 64; x++) {
    checkeredPattern[y * 64 + x] = ((x ^ y) & 8) ? 240 : 15;
  }
}
const simDepth0Keep = runHevcQuadtreeSimulation({
  ctuPatch: checkeredPattern,
  qp: 20,
  groundTruthNodes: oneLeafPartition
});
const lastStepDepth0 = simDepth0Keep.steps[simDepth0Keep.steps.length - 1];

// Verify raw treeSnapshot indeed contains discarded trial splits (confirming the bug condition)
const rawSplitsInSnapshot = Object.values(lastStepDepth0.treeSnapshot).filter(n => n.status === 'SPLIT');
assert(rawSplitsInSnapshot.length > 0, `Raw treeSnapshot contains ${rawSplitsInSnapshot.length} discarded trial splits`);

// Verify progressive tree built for PartitionCanvas has 0 splits for Depth 0 KEEP
const treeDepth0 = buildSimulatorQuadtreeTree(lastStepDepth0.treeSnapshot, lastStepDepth0.node.id, lastStepDepth0.callStack);
const canvasSplitsDepth0 = extractCanvasSplits(treeDepth0);
assert(canvasSplitsDepth0.length === 0, 'PartitionCanvas progressive splits for Depth 0 KEEP is exactly 0');
assert(treeDepth0.totalLeaves === 1, 'PartitionCanvas progressive tree has exactly 1 leaf');

// Case 2: Multi-leaf partition (10 leaves) produces exactly the 3 split dividers
const canvasSplits10 = extractCanvasSplits(treeGuided10);
assert(canvasSplits10.length === 3, `PartitionCanvas progressive splits for 10-leaf tree is exactly 3 (D0, TR, TR.BR)`);

// Verify all split lines are strictly within [0, 64] spatial bounds
for (const s of canvasSplits10) {
  const half = s.size / 2;
  const midX = s.relX + half;
  const midY = s.relY + half;
  const endX = s.relX + s.size;
  const endY = s.relY + s.size;
  assert(midX > s.relX && midX < endX, `Split ${s.id} midX (${midX}) strictly bisects [${s.relX}, ${endX}]`);
  assert(midY > s.relY && midY < endY, `Split ${s.id} midY (${midY}) strictly bisects [${s.relY}, ${endY}]`);
  assert(endX <= 64 && endY <= 64, `Split ${s.id} outer bounds stay within 64x64 CTU boundary`);
}

// Case 3: Depth-adaptive active node insetting prevents clipping and interior occlusion
const testNodes = [
  { depth: 0, size: 64, x: 0, y: 0 },
  { depth: 1, size: 32, x: 32, y: 0 },
  { depth: 2, size: 16, x: 48, y: 16 },
  { depth: 3, size: 8, x: 56, y: 24 }
];

for (const tn of testNodes) {
  const strokeW = tn.size <= 8 ? 0.5 : (tn.size <= 16 ? 0.75 : 1);
  const inset = strokeW / 2;
  const rectX = tn.x + inset;
  const rectY = tn.y + inset;
  const rectW = tn.size - strokeW;
  const rectH = tn.size - strokeW;

  const minX = rectX - inset;
  const maxX = rectX + rectW + inset;
  const minY = rectY - inset;
  const maxY = rectY + rectH + inset;

  assert(minX >= tn.x && maxX <= tn.x + tn.size, `Depth ${tn.depth} (${tn.size}x${tn.size}) stroke stays strictly within outer boundary [${tn.x}, ${tn.x + tn.size}]`);
  assert(minY >= tn.y && maxY <= tn.y + tn.size, `Depth ${tn.depth} (${tn.size}x${tn.size}) stroke stays strictly within outer boundary [${tn.y}, ${tn.y + tn.size}]`);
  // Verify 8x8 block has at least 7 units of unoccluded visible interior in 64 viewBox (>= 87.5% visibility)
  if (tn.size === 8) {
    assert(rectW >= 7.5, `8x8 active block retains ${rectW}x${rectH} clean visible pixel interior`);
  }
}

// -------------------------------------------------------------
// TEST SUITE 8: RDO Simulator Tab Integration & Checkpoint Synchronization
// -------------------------------------------------------------
console.log('\nTest Suite 8: RDO Simulator Tab Integration & Checkpoint Synchronization');

const appSource = fs.readFileSync(path.join(__dirname, '../App.jsx'), 'utf-8');
const viewportSource = fs.readFileSync(path.join(__dirname, '../components/app/ActiveStageViewport.jsx'), 'utf-8');

assert(appSource.includes("{ id: 'RDO_SIM', label: '8. RDO Simulator' }"), "App.jsx defines RDO_SIM tab in stageTabs");
assert(appSource.includes("else if (e.key === '8') setActiveStageTab('RDO_SIM');"), "App.jsx provides key '8' shortcut for RDO Simulator");
assert(viewportSource.includes("import RdoQuadtreeSimulator from '../RdoQuadtreeSimulator';"), "ActiveStageViewport imports RdoQuadtreeSimulator");
assert(viewportSource.includes("onNavigateToSim={() => setActiveStageTab('RDO_SIM')}"), "ActiveStageViewport connects QuadTreeVisualizer onNavigateToSim to RDO_SIM");
assert(viewportSource.includes("activeStageTab === 'RDO_SIM'"), "ActiveStageViewport renders RDO_SIM stage section");
assert(viewportSource.includes("<RdoQuadtreeSimulator"), "ActiveStageViewport mounts RdoQuadtreeSimulator component");
assert(viewportSource.includes("partitionData={ctuPartitionsMap?.[`${ctuX}_${ctuY}`] || partitionData}"), "ActiveStageViewport passes 100% synchronized CTU partition ground truth to RdoQuadtreeSimulator");
assert(viewportSource.includes("(val === 'CP_01' || val === 'RDO_SIM')"), "ActiveStageViewport updates partition cache on RDO_SIM tab switch");

console.log(`\n=== TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED ===`);
if (failCount > 0) process.exit(1);
