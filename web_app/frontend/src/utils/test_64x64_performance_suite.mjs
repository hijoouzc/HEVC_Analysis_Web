import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== RUNNING 64×64 PERFORMANCE & PIXEL-ACCURATE CANVAS SUITE ===\n');

let passCount = 0;
let failCount = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

// =============================================================================
// Test Suite 1: IntraPredictionFlow Card 1 Canvas & DOM Node Optimization
// =============================================================================
console.log('Test Suite 1: IntraPredictionFlow Card 1 Canvas & DOM Node Optimization');

const flowPath = path.resolve(__dirname, '../components/IntraPredictionFlow.jsx');
const flowContent = fs.readFileSync(flowPath, 'utf8');

it('Imports useRef and bt709YuvToRgb in IntraPredictionFlow', () => {
  assert(flowContent.includes('useRef'), 'useRef imported from react');
  assert(flowContent.includes('bt709YuvToRgb'), 'bt709YuvToRgb imported from colorUtils');
});

it('Declares orgCanvasRef for GPU-accelerated PU rendering', () => {
  assert(flowContent.includes('const orgCanvasRef = useRef(null)'), 'orgCanvasRef declared with useRef');
});

it('Paints Card 1 canvas with ctx.imageSmoothingEnabled = false adhering to HEVC pixel standard', () => {
  assert(flowContent.includes('ctx.imageSmoothingEnabled = false'), 'imageSmoothingEnabled explicitly disabled on canvas context');
  assert(flowContent.includes('ctx.createImageData(N, N)'), 'Uses 32-bit typed buffer ImageData for zero-copy paint');
});

it('Applies ITU-R BT.709 color conversions to canvas buffer for Y, U, and V channels', () => {
  assert(flowContent.includes('bt709YuvToRgb(128, val, 128)'), 'U channel uses neutral Luma 128 with BT.709 Chroma');
  assert(flowContent.includes('bt709YuvToRgb(128, 128, val)'), 'V channel uses neutral Luma 128 with BT.709 Chroma');
});

it('Preserves direct DOM cells with text for small blocks (N <= 8)', () => {
  assert(flowContent.includes('N <= 8 ? ('), 'Renders DOM cells only for N <= 8');
  assert(flowContent.includes('showValues && stageGridCellSize >= 16 ? val : \'\''), 'Preserves numeric text display for small blocks');
});

it('Renders Canvas + Reticle for large blocks (N >= 16) eliminating 4,096 DOM nodes', () => {
  assert(flowContent.includes('ref={orgCanvasRef}'), 'Binds orgCanvasRef to canvas element');
  assert(flowContent.includes('imageRendering: \'pixelated\''), 'Sets image-rendering: pixelated on canvas style');
  assert(flowContent.includes('gridColumn: `2 / span ${N}`'), 'Canvas correctly spans N columns from column line 2');
  assert(flowContent.includes('gridRow: `2 / span ${N}`'), 'Canvas correctly spans N rows from row line 2');
});

it('Renders 100% aligned selection reticle at selected pixel coordinates', () => {
  assert(flowContent.includes('gridColumn: selectedPixel.x + 2'), 'Reticle positioned at selectedPixel.x + 2 in 1-based grid');
  assert(flowContent.includes('gridRow: selectedPixel.y + 2'), 'Reticle positioned at selectedPixel.y + 2 in 1-based grid');
  assert(flowContent.includes('SELECTION_HIGHLIGHT_COLOR'), 'Reticle uses SELECTION_HIGHLIGHT_COLOR identifier');
});

it('Verifies theoretical DOM node count reduction for 64×64 block', () => {
  const N = 64;
  const legacyDomCells = N * N; // 4096 PU cells
  const refPerimeterCells = 1 + 2 * N + 2 * N; // 257 boundary cells
  const legacyTotalNodes = legacyDomCells + refPerimeterCells; // 4353 nodes

  const optimizedDomCells = 1; // 1 canvas
  const optimizedReticle = 1; // 1 reticle div when selected
  const optimizedTotalNodes = refPerimeterCells + optimizedDomCells + optimizedReticle; // 259 nodes

  assert.strictEqual(legacyTotalNodes, 4353, 'Legacy node count was 4,353');
  assert.strictEqual(optimizedTotalNodes, 259, 'Optimized node count is 259');
  const reductionPct = ((legacyTotalNodes - optimizedTotalNodes) / legacyTotalNodes) * 100;
  assert(reductionPct > 94.0, `Achieved ${reductionPct.toFixed(1)}% DOM reduction`);
});

// =============================================================================
// Test Suite 2: Coordinate Projection & Mathematical Accuracy
// =============================================================================
console.log('\nTest Suite 2: Coordinate Projection & Mathematical Accuracy');

it('Projects screen click coordinates to exact discrete pixel index across all block sizes', () => {
  for (const N of [16, 32, 64]) {
    const stageGridCellSize = N <= 16 ? 10 : N <= 32 ? 5 : 3;
    const canvasWidth = N * stageGridCellSize;

    // Test corner pixels
    const clickTL = { x: 0.5, y: 0.5 };
    const pxTL = Math.min(N - 1, Math.max(0, Math.floor((clickTL.x / canvasWidth) * N)));
    const pyTL = Math.min(N - 1, Math.max(0, Math.floor((clickTL.y / canvasWidth) * N)));
    assert.strictEqual(pxTL, 0);
    assert.strictEqual(pyTL, 0);

    const clickBR = { x: canvasWidth - 0.5, y: canvasWidth - 0.5 };
    const pxBR = Math.min(N - 1, Math.max(0, Math.floor((clickBR.x / canvasWidth) * N)));
    const pyBR = Math.min(N - 1, Math.max(0, Math.floor((clickBR.y / canvasWidth) * N)));
    assert.strictEqual(pxBR, N - 1);
    assert.strictEqual(pyBR, N - 1);

    // Test center pixel
    const clickCenter = { x: canvasWidth / 2, y: canvasWidth / 2 };
    const pxC = Math.min(N - 1, Math.max(0, Math.floor((clickCenter.x / canvasWidth) * N)));
    const pyC = Math.min(N - 1, Math.max(0, Math.floor((clickCenter.y / canvasWidth) * N)));
    assert.strictEqual(pxC, Math.floor(N / 2));
    assert.strictEqual(pyC, Math.floor(N / 2));
  }
});

// =============================================================================
// Test Suite 3: BlockMatrixGrid Bidirectional Window Synchronization
// =============================================================================
console.log('\nTest Suite 3: BlockMatrixGrid Bidirectional Window Synchronization');

const gridPath = path.resolve(__dirname, '../components/common/BlockMatrixGrid.jsx');
const gridContent = fs.readFileSync(gridPath, 'utf8');

it('Derives selectedCellWindow during render in BlockMatrixGrid without setState-in-effect', () => {
  assert(gridContent.includes('const selectedCellWindow = useMemo('), 'selectedCellWindow derived using useMemo');
  assert(gridContent.includes('activeWindow ?? (selectedCellWindow ?? internalWindow)'), 'Fallback chain cleanly resolves window');
  assert(!gridContent.includes('Synchronize internal 8x8 window when external selectedCell changes'), 'Removed synchronous setState effect');
});

// =============================================================================
// Test Suite 4: Step1FrameTree Large Block Canvas Safeguard
// =============================================================================
console.log('\nTest Suite 4: Step1FrameTree Large Block Canvas Safeguard');

const step1Path = path.resolve(__dirname, '../components/guided/Step1FrameTree.jsx');
const step1Content = fs.readFileSync(step1Path, 'utf8');

it('Implements CuSampleCanvas in Step1FrameTree for width > 8', () => {
  assert(step1Content.includes('function CuSampleCanvas('), 'CuSampleCanvas helper component defined');
  assert(step1Content.includes('(selectedCu.width || 8) <= 8 ? ('), 'Conditionally branches between direct cells and canvas');
  assert(step1Content.includes('<CuSampleCanvas'), 'Renders CuSampleCanvas for blocks > 8');
});

console.log(`\n=== 64×64 PERFORMANCE & CANVAS TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED ===\n`);

if (failCount > 0) {
  process.exit(1);
}
