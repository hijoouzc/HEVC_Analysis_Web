import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bt709RgbToYuv,
  extractChannelBlockFromRgba,
  extractChannelPerimeterFromRgba,
} from '../../src/utils/colorUtils.js';
import { makeCtuCacheKey, updateLruCache } from '../../src/hooks/useAnalysisSession.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcRoot = path.resolve(__dirname, '../../src');

console.log('=== RUNNING FRONTEND RUNTIME REGRESSION SUITE ===\n');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

// 1. Chroma planar & BT.709 RGB 4:2:0 extraction tests
test('Planar grayscale /images/u & /images/v buffers preserve exact Cb/Cr values (!== 128)', () => {
  // Simulate 16x16 half-res chroma plane for a 32x32 frame with varied grayscale chroma values
  const bufW = 16;
  const bufH = 16;
  const rgba = new Uint8ClampedArray(bufW * bufH * 4);
  for (let y = 0; y < bufH; y++) {
    for (let x = 0; x < bufW; x++) {
      const val = (50 + y * 5 + x * 3) & 255;
      const off = (y * bufW + x) * 4;
      rgba[off] = val;
      rgba[off + 1] = val;
      rgba[off + 2] = val;
      rgba[off + 3] = 255;
    }
  }

  // CU at luma (16, 8) with 8x8 luma size => 4x4 chroma at (8, 4)
  const block = extractChannelBlockFromRgba(rgba, bufW, bufH, {
    absX: 16,
    absY: 8,
    size: 4,
    channel: 'Cb',
    frameWidth: 32,
    isPlanarGray: true,
  });

  assert.strictEqual(block.length, 16);
  // Top-left chroma sample at (x=8, y=4): 50 + 4*5 + 8*3 = 94
  assert.strictEqual(block[0], 94);
  // Next column chroma sample at (x=9, y=4): 97
  assert.strictEqual(block[1], 97);
  // Must not collapse grayscale PNG to constant 128 via bt709RgbToYuv
  assert(block.some(v => v !== 128), 'Planar chroma samples must not be collapsed to 128');

  const perim = extractChannelPerimeterFromRgba(rgba, bufW, bufH, {
    absX: 16,
    absY: 8,
    size: 4,
    channel: 'Cr',
    frameWidth: 32,
    isPlanarGray: true,
  });
  // Corner at chroma (7, 3): 50 + 3*5 + 7*3 = 86
  assert.strictEqual(perim.refTop[0], 86);
  // Top[0] at chroma (8, 3): 50 + 3*5 + 8*3 = 89
  assert.strictEqual(perim.refTop[1], 89);
  // Left[0] at chroma (7, 4): 50 + 4*5 + 7*3 = 91
  assert.strictEqual(perim.refLeft[1], 91);
});

test('Full-res RGB canvas applies 2x2 4:2:0 stride and BT.709 Cb/Cr conversion (not Luma Y)', () => {
  const bufW = 16;
  const bufH = 16;
  const rgba = new Uint8ClampedArray(bufW * bufH * 4);
  // Pure blue block at (x>=4, y>=4): R=0, G=0, B=255 -> high Cb (~255), low Cr (~116), low Y (~18)
  for (let y = 0; y < bufH; y++) {
    for (let x = 0; x < bufW; x++) {
      const off = (y * bufW + x) * 4;
      rgba[off] = 0;
      rgba[off + 1] = 0;
      rgba[off + 2] = 255;
      rgba[off + 3] = 255;
    }
  }
  const expected = bt709RgbToYuv(0, 0, 255);
  const cbBlock = extractChannelBlockFromRgba(rgba, bufW, bufH, {
    absX: 4,
    absY: 4,
    size: 4,
    channel: 'Cb',
    frameWidth: 16,
    isPlanarGray: false,
  });
  const crBlock = extractChannelBlockFromRgba(rgba, bufW, bufH, {
    absX: 4,
    absY: 4,
    size: 4,
    channel: 'Cr',
    frameWidth: 16,
    isPlanarGray: false,
  });
  assert.strictEqual(cbBlock[0], expected.cb);
  assert.strictEqual(crBlock[0], expected.cr);
  assert.notStrictEqual(cbBlock[0], expected.y);
});

// 2. Cache key consistency & LRU eviction tests
test('makeCtuCacheKey builds consistent keys across POC, CTU, and CU dimensions', () => {
  const ctuOnly = makeCtuCacheKey(1, 2, 3, 16);
  const cuSpecific = makeCtuCacheKey(1, 2, 3, 16, 128, 192);
  assert.strictEqual(ctuOnly, '1_2_3_16');
  assert.strictEqual(cuSpecific, '1_2_3_16_128_192');
  assert.notStrictEqual(makeCtuCacheKey(0, 2, 3, 16), makeCtuCacheKey(1, 2, 3, 16));
});

test('updateLruCache enforces bounded capacity and evicts oldest entries', () => {
  let cache = {};
  cache = updateLruCache(cache, 'k1', { id: 1 }, 2);
  cache = updateLruCache(cache, 'k2', { id: 2 }, 2);
  cache = updateLruCache(cache, 'k1', { id: 1 }, 2); // refresh k1
  cache = updateLruCache(cache, 'k3', { id: 3 }, 2); // should evict k2
  assert.strictEqual('k2' in cache, false);
  assert.strictEqual('k1' in cache, true);
  assert.strictEqual('k3' in cache, true);
});

// 3. Pixel-accurate, zero lint-disable, and UI standard compliance checks
test('Pixel-accurate rendering and UI standard invariants hold cleanly', () => {
  const fourPic = fs.readFileSync(path.join(srcRoot, 'components/stages/cp05_recon_picture/FourPictureComparison.jsx'), 'utf8');
  assert(fourPic.includes('size >= 16'), 'FourPictureComparison cuts over to canvas at size >= 16');
  assert(!fourPic.includes('contrast(300%)'), 'FourPictureComparison omits banned CSS contrast() filter');

  const css = fs.readFileSync(path.join(srcRoot, 'index.css'), 'utf8');
  assert(!css.includes('brightness('), 'index.css omits CSS brightness() filter');

  const cabacVis = fs.readFileSync(path.join(srcRoot, 'components/stages/cp07_cabac_entropy/CabacEntropyVisualizer.jsx'), 'utf8');
  const binTree = fs.readFileSync(path.join(srcRoot, 'components/stages/cp07_cabac_entropy/subcomponents/BinarizationTreeViewer.jsx'), 'utf8');
  assert(!cabacVis.includes('§'), 'CabacEntropyVisualizer does not expose § clause numbers');
  assert(!binTree.includes('activeDef.standardRef'), 'BinarizationTreeViewer does not render raw standardRef clause badge');

  const hookCode = fs.readFileSync(path.join(srcRoot, 'hooks/useAnalysisSession.js'), 'utf8');
  const intraCode = fs.readFileSync(path.join(srcRoot, 'components/stages/cp02_intra_search/IntraPredictionFlow.jsx'), 'utf8');
  assert(!hookCode.includes('oxlint-disable'), 'useAnalysisSession contains zero lint suppression comments');
  assert(!intraCode.includes('oxlint-disable'), 'IntraPredictionFlow contains zero lint suppression comments');
});

console.log(`\n=== FRONTEND RUNTIME REGRESSION SUMMARY: ${passCount} PASSED, ${failCount} FAILED ===`);
if (failCount > 0) process.exit(1);
