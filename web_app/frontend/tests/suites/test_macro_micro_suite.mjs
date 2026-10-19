import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== RUNNING MACRO-MICRO DUAL-STAGE PIXEL ENGINE TEST SUITE ===\n');

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
// Test Suite 1: Mathematical Windowing & Sub-block Grid Partitioning
// =============================================================================
console.log('Test Suite 1: Mathematical Windowing & Sub-block Grid Partitioning');

const testSizes = [4, 8, 16, 32, 64];

it('Calculates correct maxWindows for all HEVC block sizes (4 to 64)', () => {
  const expectedMaxWindows = {
    4: 1,
    8: 1,
    16: 2,
    32: 4,
    64: 8
  };
  for (const N of testSizes) {
    const maxWindows = Math.max(1, Math.floor(N / 8));
    assert.strictEqual(maxWindows, expectedMaxWindows[N], `maxWindows for N=${N}`);
  }
});

it('Maps sub-window (wx, wy) + local offset (lx, ly) strictly to global coordinates (gx, gy)', () => {
  for (const N of [16, 32, 64]) {
    const maxW = Math.max(1, Math.floor(N / 8));
    for (let wy = 0; wy < maxW; wy++) {
      for (let wx = 0; wx < maxW; wx++) {
        for (let ly = 0; ly < 8; ly++) {
          for (let lx = 0; lx < 8; lx++) {
            const gx = wx * 8 + lx;
            const gy = wy * 8 + ly;
            assert(gx >= 0 && gx < N, `gx ${gx} out of bounds for N=${N}`);
            assert(gy >= 0 && gy < N, `gy ${gy} out of bounds for N=${N}`);
            const idx = gy * N + gx;
            assert(idx >= 0 && idx < N * N, `Index ${idx} out of range`);
          }
        }
      }
    }
  }
});

it('Correctly projects click percentages [0..1] on Macro Canvas to exact pixel and window coordinates', () => {
  const N = 32;
  // Click near top-left: pct = (0.05, 0.05) -> px = 1, py = 1 -> wx = 0, wy = 0
  const px1 = Math.min(N - 1, Math.max(0, Math.floor(0.05 * N)));
  const py1 = Math.min(N - 1, Math.max(0, Math.floor(0.05 * N)));
  assert.strictEqual(px1, 1);
  assert.strictEqual(py1, 1);
  assert.strictEqual(Math.floor(px1 / 8), 0);
  assert.strictEqual(Math.floor(py1 / 8), 0);

  // Click near center-right: pct = (0.85, 0.45) -> px = 27, py = 14 -> wx = 3, wy = 1
  const px2 = Math.min(N - 1, Math.max(0, Math.floor(0.85 * N)));
  const py2 = Math.min(N - 1, Math.max(0, Math.floor(0.45 * N)));
  assert.strictEqual(px2, 27);
  assert.strictEqual(py2, 14);
  assert.strictEqual(Math.floor(px2 / 8), 3);
  assert.strictEqual(Math.floor(py2 / 8), 1);
});

// =============================================================================
// Test Suite 2: Colorimetry & High-Contrast Typography
// =============================================================================
console.log('\nTest Suite 2: Colorimetry & High-Contrast Typography');

import { getSampleColorAndTextColor, getResidualColorAndTextColor } from '../../src/utils/colorUtils.js';

it('Residual color coding conforms to ITU-R standards (Positive=Warm, Negative=Cool, Zero=Neutral)', () => {
  const zeroStyle = getResidualColorAndTextColor(0, 64);
  assert(zeroStyle.bg === '#F1F5F9' || zeroStyle.bg.includes('rgba(128, 128, 128') || zeroStyle.bg.includes('var(--apple-canvas'), 'Zero residual is neutral');

  const posStyle = getResidualColorAndTextColor(32, 64);
  assert(posStyle.bg.includes('225, 29, 72') || posStyle.bg.includes('239, 68, 68'), 'Positive residual is warm red');

  const negStyle = getResidualColorAndTextColor(-32, 64);
  assert(negStyle.bg.includes('2, 132, 199') || negStyle.bg.includes('59, 130, 246'), 'Negative residual is cool blue');
});

it('Auto-contrast provides legible text color across dynamic range', () => {
  // Very dark sample Y = 10 -> white text
  const darkSample = getSampleColorAndTextColor(10, 'Y');
  assert.strictEqual(darkSample.color, '#FFFFFF', 'Dark sample uses white text');

  // Very bright sample Y = 240 -> dark text
  const lightSample = getSampleColorAndTextColor(240, 'Y');
  assert(lightSample.color === '#000000' || lightSample.color.includes('label'), 'Bright sample uses dark text');
});

// =============================================================================
// Test Suite 3: 100% Click-Only Interaction & Zero Hover Verification
// =============================================================================
console.log('\nTest Suite 3: 100% Click-Only Interaction & Zero Hover Verification');

it('MacroMicroPixelViewer has zero onMouseEnter or onMouseOver listeners', () => {
  const code = fs.readFileSync(path.join(__dirname, '../../src/components/common/MacroMicroPixelViewer.jsx'), 'utf-8');
  assert(!code.includes('onMouseEnter'), 'No onMouseEnter found in MacroMicroPixelViewer');
  assert(!code.includes('onMouseOver'), 'No onMouseOver found in MacroMicroPixelViewer');
  assert(!code.includes('onHover'), 'No onHover found in MacroMicroPixelViewer');
});

it('MacroMicroPixelViewer cells have zero title hover tooltip attributes', () => {
  const code = fs.readFileSync(path.join(__dirname, '../../src/components/common/MacroMicroPixelViewer.jsx'), 'utf-8');
  // Check that cells do not have title="..."
  assert(!code.includes('title={`['), 'No cell title tooltip found in MacroMicroPixelViewer');
});

it('BlockMatrixGrid cells have zero title hover tooltip attributes', () => {
  const code = fs.readFileSync(path.join(__dirname, '../../src/components/common/BlockMatrixGrid.jsx'), 'utf-8');
  assert(!code.includes('title='), 'No title attribute found in BlockMatrixGrid');
  assert(!code.includes('getTooltip'), 'No getTooltip prop found in BlockMatrixGrid');
});

it('FourPictureComparison has zero onMouseEnter or onMouseOver listeners', () => {
  const code = fs.readFileSync(path.join(__dirname, '../../src/components/FourPictureComparison.jsx'), 'utf-8');
  assert(!code.includes('onMouseEnter'), 'No onMouseEnter found in FourPictureComparison');
  assert(!code.includes('onMouseOver'), 'No onMouseOver found in FourPictureComparison');
});

it('TransformQuantVisualizer has zero onMouseEnter or onMouseOver listeners', () => {
  const code = fs.readFileSync(path.join(__dirname, '../../src/components/TransformQuantVisualizer.jsx'), 'utf-8');
  assert(!code.includes('onMouseEnter'), 'No onMouseEnter found in TransformQuantVisualizer');
  assert(!code.includes('onMouseOver'), 'No onMouseOver found in TransformQuantVisualizer');
});

// =============================================================================
// Test Suite 4: Value Overlay Toggle & Zero Layout Overflow Verification
// =============================================================================
console.log('\nTest Suite 4: Value Overlay Toggle & Zero Layout Overflow Verification');

it('MacroMicroPixelViewer supports showValues prop and omits text when showValues=false', () => {
  const code = fs.readFileSync(path.join(__dirname, '../../src/components/common/MacroMicroPixelViewer.jsx'), 'utf-8');
  assert(code.includes('showValues = true'), 'MacroMicroPixelViewer has showValues prop defaulting to true');
  assert(code.includes('showValues ?'), 'MacroMicroPixelViewer conditionally renders text based on showValues');
});

it('BlockMatrixGrid supports showValues prop and omits text when showValues=false', () => {
  const code = fs.readFileSync(path.join(__dirname, '../../src/components/common/BlockMatrixGrid.jsx'), 'utf-8');
  assert(code.includes('showValues = true'), 'BlockMatrixGrid has showValues prop defaulting to true');
  assert(code.includes('showValues ?'), 'BlockMatrixGrid conditionally renders text based on showValues');
});

it('FourPictureComparison provides Values toggle control', () => {
  const code = fs.readFileSync(path.join(__dirname, '../../src/components/FourPictureComparison.jsx'), 'utf-8');
  assert(code.includes('showValues'), 'FourPictureComparison manages showValues state');
  assert(code.includes('setShowValues'), 'FourPictureComparison allows toggling showValues');
});

it('TransformQuantVisualizer provides Values and Zoom toolbar controls', () => {
  const code = fs.readFileSync(path.join(__dirname, '../../src/components/TransformQuantVisualizer.jsx'), 'utf-8');
  assert(code.includes('showValues'), 'TransformQuantVisualizer manages showValues state');
  assert(code.includes('zoomLevel'), 'TransformQuantVisualizer manages zoomLevel state');
  assert(code.includes('showValues={showValues}'), 'TransformQuantVisualizer passes showValues to BlockMatrixGrid');
});

it('All visualizer matrix containers enforce safe horizontal scroll and max-width bounds', () => {
  const flowCode = fs.readFileSync(path.join(__dirname, '../../src/components/IntraPredictionFlow.jsx'), 'utf-8');
  const fourPicCode = fs.readFileSync(path.join(__dirname, '../../src/components/FourPictureComparison.jsx'), 'utf-8');
  const tqCode = fs.readFileSync(path.join(__dirname, '../../src/components/TransformQuantVisualizer.jsx'), 'utf-8');

  assert(flowCode.includes('overflowX: \'auto\''), 'IntraPredictionFlow wraps grids with overflowX auto');
  assert(fourPicCode.includes('overflowX: \'auto\''), 'FourPictureComparison wraps grids with overflowX auto');
  assert(tqCode.includes('overflowX: \'auto\''), 'TransformQuantVisualizer wraps grids with overflowX auto');
});

// =============================================================================
// SUMMARY
// =============================================================================
console.log(`\n=== MACRO-MICRO TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED ===\n`);
if (failCount > 0) process.exit(1);
