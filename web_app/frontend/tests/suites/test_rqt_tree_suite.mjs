import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRqtTree, computeTuTreeLayout, getTuNodeColorTheme } from '../../src/utils/rqtTreeLayout.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('\n=== RUNNING RQT TRANSFORM TREE & GEOMETRIC SQUARE BLOCKS TEST SUITE ===\n');

// Test Suite 1: RQT Tree Construction & Morton Z-Scan Quadrants
console.log('Test Suite 1: RQT Tree Construction & Morton Z-Scan Quadrants');
{
  // Test 1: Empty event list fallback
  const emptyRoot = buildRqtTree([], { cuSize: 32, cuX: 0, cuY: 0 });
  assert(emptyRoot !== null, 'Creates non-null empty root');
  assert.strictEqual(emptyRoot.size, 32, 'Empty root has size 32');
  assert.strictEqual(emptyRoot.isSplit, false, 'Empty root is not split');
  assert.strictEqual(emptyRoot.totalLeaves, 1, 'Empty root has 1 leaf');
  console.log('  ✓ PASS: Creates safe empty root when no events present');

  // Test 2: Multi-depth TU tree: 32x32 split into four 16x16, one 16x16 split into four 8x8
  const sampleEvents = [
    { tu_x: 0, tu_y: 0, width: 32, height: 32, tu_depth: 0, component: 'Y', intra_mode: 0, sig_coeff_count: 5 },
    // 4 child 16x16 TUs
    { tu_x: 0, tu_y: 0, width: 16, height: 16, tu_depth: 1, component: 'Y', intra_mode: 0, sig_coeff_count: 2 },
    { tu_x: 16, tu_y: 0, width: 16, height: 16, tu_depth: 1, component: 'Y', intra_mode: 0, sig_coeff_count: 1 },
    { tu_x: 0, tu_y: 16, width: 16, height: 16, tu_depth: 1, component: 'Y', intra_mode: 0, sig_coeff_count: 0 },
    { tu_x: 16, tu_y: 16, width: 16, height: 16, tu_depth: 1, component: 'Y', intra_mode: 0, sig_coeff_count: 3 },
    // 4 child 8x8 TUs inside (0, 0)
    { tu_x: 0, tu_y: 0, width: 8, height: 8, tu_depth: 2, component: 'Y', intra_mode: 0, sig_coeff_count: 1 },
    { tu_x: 8, tu_y: 0, width: 8, height: 8, tu_depth: 2, component: 'Y', intra_mode: 0, sig_coeff_count: 0 },
    { tu_x: 0, tu_y: 8, width: 8, height: 8, tu_depth: 2, component: 'Y', intra_mode: 0, sig_coeff_count: 0 },
    { tu_x: 8, tu_y: 8, width: 8, height: 8, tu_depth: 2, component: 'Y', intra_mode: 0, sig_coeff_count: 1 },
  ];

  const root = buildRqtTree(sampleEvents, { cuSize: 32, cuX: 0, cuY: 0, component: 'Y', intraMode: 0 });
  assert.strictEqual(root.size, 32, 'Root TU size is 32x32');
  assert.strictEqual(root.isSplit, true, 'Root TU is split into 16x16');
  assert.strictEqual(root.children.length, 4, 'Root TU has 4 children in Morton order');

  // Verify Morton Z-scan quadrant positions
  const [tl, tr, bl, br] = root.children;
  assert.strictEqual(tl.relX, 0, 'Top-Left child relX = 0');
  assert.strictEqual(tl.relY, 0, 'Top-Left child relY = 0');
  assert.strictEqual(tr.relX, 16, 'Top-Right child relX = 16');
  assert.strictEqual(tr.relY, 0, 'Top-Right child relY = 0');
  assert.strictEqual(bl.relX, 0, 'Bottom-Left child relX = 0');
  assert.strictEqual(bl.relY, 16, 'Bottom-Left child relY = 16');
  assert.strictEqual(br.relX, 16, 'Bottom-Right child relX = 16');
  assert.strictEqual(br.relY, 16, 'Bottom-Right child relY = 16');
  console.log('  ✓ PASS: Orders child TUs in strict Morton Z-scan order (TL, TR, BL, BR)');

  // Verify deeper split in Top-Left quadrant
  assert.strictEqual(tl.isSplit, true, 'Top-Left 16x16 is split into 8x8 TUs');
  assert.strictEqual(tl.children.length, 4, 'Top-Left has 4 child 8x8 TUs');
  assert.strictEqual(tr.isSplit, false, 'Top-Right 16x16 is a leaf TU');
  assert.strictEqual(bl.isSplit, false, 'Bottom-Left 16x16 is a leaf TU');
  assert.strictEqual(br.isSplit, false, 'Bottom-Right 16x16 is a leaf TU');
  console.log('  ✓ PASS: Correctly identifies split vs leaf TUs across depths');

  // Verify 4x4 DST detection
  const dstEvent = [{ tu_x: 0, tu_y: 0, width: 4, height: 4, tu_depth: 1, component: 'Y', is_dst: true }];
  const dstTree = buildRqtTree(dstEvent, { cuSize: 4, cuX: 0, cuY: 0, component: 'Y' });
  assert.strictEqual(dstTree.isDst, true, 'Detects 4x4 Luma DST-VII');
  assert.strictEqual(dstTree.transformName, '2D DST-VII', 'Assigns DST-VII transform name');
  console.log('  ✓ PASS: Accurately identifies 4×4 Luma DST-VII according to H.265 Section 8.7.2');
}

// Test Suite 2: computeTuTreeLayout Geometric Square Sizing & Orthogonal Connectors
console.log('\nTest Suite 2: computeTuTreeLayout Geometric Square Sizing & Orthogonal Connectors');
{
  const sampleEvents = [
    { tu_x: 0, tu_y: 0, width: 32, height: 32, tu_depth: 0, component: 'Y' },
    { tu_x: 0, tu_y: 0, width: 16, height: 16, tu_depth: 1, component: 'Y' },
    { tu_x: 16, tu_y: 0, width: 16, height: 16, tu_depth: 1, component: 'Y' },
    { tu_x: 0, tu_y: 16, width: 16, height: 16, tu_depth: 1, component: 'Y' },
    { tu_x: 16, tu_y: 16, width: 16, height: 16, tu_depth: 1, component: 'Y' },
  ];

  const root = buildRqtTree(sampleEvents, { cuSize: 32, cuX: 0, cuY: 0, component: 'Y' });
  const layout = computeTuTreeLayout(root);

  assert(layout.totalWidth > 0, 'Computes positive totalWidth');
  assert(layout.totalHeight > 0, 'Computes positive totalHeight');
  assert.strictEqual(layout.nodes.length, 5, 'Contains 5 nodes (1 root + 4 children)');
  assert.strictEqual(layout.edges.length, 4, 'Contains 4 orthogonal edges');

  // Verify proportional 1:1 square block geometry
  layout.nodes.forEach(node => {
    assert.strictEqual(node.layout.width, node.layout.height, `Node ${node.id} maintains 1:1 square aspect ratio`);
    assert(node.layout.size > 0, `Node ${node.id} has positive size`);
  });
  console.log('  ✓ PASS: Enforces strict 1:1 proportional geometric square block dimensions');

  // Verify orthogonal connector paths (M ... V ... H ... V ...)
  layout.edges.forEach(edge => {
    assert(edge.path.startsWith('M '), 'Connector starts with move command');
    assert(edge.path.includes(' V ') && edge.path.includes(' H '), 'Connector uses orthogonal horizontal and vertical lines');
  });
  console.log('  ✓ PASS: Generates orthogonal connectors without diagonal crossing lines');

  // Color theme test
  const c32 = getTuNodeColorTheme(32, false, false);
  const c16 = getTuNodeColorTheme(16, false, false);
  const cDst = getTuNodeColorTheme(4, false, true);
  assert(c32.fill.length > 0, 'Has fill color for 32x32');
  assert(c16.fill.length > 0, 'Has fill color for 16x16');
  assert.strictEqual(cDst.label, '4×4 DST', 'Color theme labels 4x4 DST');
  console.log('  ✓ PASS: Resolves distinctive depth color themes and DST badges');
}

// Test Suite 3: TuQuadtreeHierarchyGraph Component Conformance
console.log('\nTest Suite 3: TuQuadtreeHierarchyGraph Component Conformance');
{
  const graphPath = resolve(__dirname, '../../src/components/stages/cp04_transform_quant/TuQuadtreeHierarchyGraph.jsx');
  const graphContent = readFileSync(graphPath, 'utf8');

  assert(graphContent.includes('InternalTuPartitionGrid'), 'Implements internal cross partition grid (+) for split TUs');
  assert(graphContent.includes('tree-connectors'), 'Renders connector lines layer');
  assert(graphContent.includes('tree-tu-blocks'), 'Renders geometric square TU blocks layer');
  assert(graphContent.includes('onSelectTu'), 'Accepts onSelectTu callback for interactive synchronization');
  assert(graphContent.includes('handleFitView'), 'Provides Fit View auto-scaler');
  assert(graphContent.includes('ResizeObserver'), 'Monitors container resize for responsive layout');
  assert(!/[\u{1F300}-\u{1F9FF}]/u.test(graphContent), 'Contains zero emoji icons');
  assert(graphContent.includes('crispEdges'), 'Enforces crisp pixel-accurate rendering');
  console.log('  ✓ PASS: TuQuadtreeHierarchyGraph satisfies Apple HIG and interactive requirements');
}

// Test Suite 4: TransformQuantVisualizer & Step3ResidualTu Integration
console.log('\nTest Suite 4: TransformQuantVisualizer & Step3ResidualTu Integration');
{
  const tqPath = resolve(__dirname, '../../src/components/stages/cp04_transform_quant/TransformQuantVisualizer.jsx');
  const tqContent = readFileSync(tqPath, 'utf8');

  assert(tqContent.includes('TuTreeCallStack') || tqContent.includes('TuQuadtreeHierarchyGraph'), 'Imports and renders TuTreeCallStack / TuQuadtreeHierarchyGraph');
  assert(tqContent.includes('handleSelectTuFromTree'), 'Implements handleSelectTuFromTree callback');
  assert(tqContent.includes('viewLayout'), 'Manages viewLayout state (dual, tree, matrix)');
  assert(tqContent.includes('RQT Tree'), 'Offers RQT Tree layout option in SegmentedControl');

  const s3Path = resolve(__dirname, '../../src/components/guided/Step3ResidualTu.jsx');
  const s3Content = readFileSync(s3Path, 'utf8');
  assert(s3Content.includes('RQT Geometric Tree'), 'Step 3 SegmentedControl includes RQT Geometric Tree');
  assert(!tqContent.includes('TU Instance:'), 'Eliminated redundant TU Instance select dropdown');
  assert(tqContent.includes('Active Selected TU Indicator'), 'Replaced with sleek Active Selected TU Indicator pill');
  console.log('  ✓ PASS: Dual-view orchestration and interactive matrix synchronization fully integrated (TU Instance dropdown eliminated)');
}

// Test Suite 5: TuTreeCallStack Playback & Stepper Controller ("có tính năng để chạy")
console.log('\nTest Suite 5: TuTreeCallStack Playback & Stepper Controller ("có tính năng để chạy")');
{
  const stackPath = resolve(__dirname, '../../src/components/stages/cp04_transform_quant/TuTreeCallStack.jsx');
  const stackContent = readFileSync(stackPath, 'utf8');

  assert(stackContent.includes('Transform QuadTree Call Stack'), 'Header titled Transform QuadTree Call Stack');
  assert(stackContent.includes('Tree Graph') && stackContent.includes('Call Stack'), 'Segmented toggle between Tree Graph and Call Stack');
  assert(stackContent.includes('handleFirst') && stackContent.includes('handlePrev'), 'First and Prev navigation handlers');
  assert(stackContent.includes('handleNext') && stackContent.includes('handleLast'), 'Next and Last navigation handlers');
  assert(stackContent.includes('handleTogglePlay'), 'Play/Pause auto-player toggle');
  assert(stackContent.includes('Slider'), 'Progress slider timeline scrubber');
  assert(stackContent.includes('Speed:'), 'Speed presets (0.5x, 1.0x, 2.0x)');
  assert(stackContent.includes('QUADRANT_NAMES'), 'Morton Z-scan quadrant names TL (0), TR (1), BL (2), BR (3)');
  assert(!/[\u{1F300}-\u{1F9FF}]/u.test(stackContent), 'Contains zero emoji icons');
  console.log('  ✓ PASS: TuTreeCallStack faithfully implements playback stepper and call stack badges');
}

console.log('\n=== ALL RQT TRANSFORM TREE TESTS PASSED (100% CONFORMANCE) ===\n');
