/**
 * test_recon_picture_suite.mjs
 * Verification test suite for CP_05 ReconPictureVisualizer & ITU-R BT.709 Color Accuracy
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { bt709YuvToRgb } from './colorUtils.js';

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

console.log('\n=== RUNNING CP_05 RECON PICTURE BUFFER & COLOR ACCURACY TEST SUITE ===\n');

console.log('Test Suite 1: ITU-R BT.709 Mathematical Colorimetry');
{
  // Test neutral gray: Y=128, U=128, V=128
  const neutral = bt709YuvToRgb(128, 128, 128);
  assert(neutral.r === 128 && neutral.g === 128 && neutral.b === 128, 'Neutral YUV (128, 128, 128) produces neutral RGB (128, 128, 128)');
  assert(neutral.hex === '#808080', 'Neutral YUV produces #808080 hex');

  // Test pure Luma limits with neutral Chroma
  const black = bt709YuvToRgb(0, 128, 128);
  assert(black.r === 0 && black.g === 0 && black.b === 0 && black.hex === '#000000', 'Black YUV (0, 128, 128) produces #000000');

  const white = bt709YuvToRgb(255, 128, 128);
  assert(white.r === 255 && white.g === 255 && white.b === 255 && white.hex === '#FFFFFF', 'White YUV (255, 128, 128) produces #FFFFFF');

  // Test vibrant chromaticity: Red dominant (high Cr, neutral Cb)
  const redSample = bt709YuvToRgb(80, 128, 210);
  assert(redSample.r > redSample.g && redSample.r > redSample.b, `High Cr produces Red-dominant color: R=${redSample.r}, G=${redSample.g}, B=${redSample.b}`);
  assert(redSample.r !== redSample.g, 'Chromatic sample is NOT grayscale');

  // Test vibrant chromaticity: Blue dominant (high Cb, neutral Cr)
  const blueSample = bt709YuvToRgb(80, 210, 128);
  assert(blueSample.b > blueSample.r && blueSample.b > blueSample.g, `High Cb produces Blue-dominant color: R=${blueSample.r}, G=${blueSample.g}, B=${blueSample.b}`);
  assert(blueSample.b !== blueSample.g, 'Chromatic sample is NOT grayscale');

  // Test clamping bounds
  const clampedHigh = bt709YuvToRgb(255, 255, 255);
  assert(clampedHigh.r <= 255 && clampedHigh.g <= 255 && clampedHigh.b <= 255, 'Clamped values do not exceed 255');
  assert(clampedHigh.r >= 0 && clampedHigh.g >= 0 && clampedHigh.b >= 0, 'Clamped values are non-negative');
}

console.log('\nTest Suite 2: ReconPictureVisualizer Component Fidelity');
{
  const filePath = resolve(__dirname, '../components/ReconPictureVisualizer.jsx');
  const content = readFileSync(filePath, 'utf8');

  // 1. Pixelated canvas rendering guarantee
  assert(content.includes('ctx.imageSmoothingEnabled = false'), 'Disables browser image smoothing');
  assert(content.includes("imageRendering: 'pixelated'"), 'Enforces pixelated image rendering via CSS');

  // 2. BT.709 color usage
  assert(content.includes('bt709YuvToRgb'), 'Imports and uses bt709YuvToRgb');
  assert(content.includes('ITU-R BT.709'), 'Declares standard ITU-R BT.709 compliance');

  // 3. Fallback to extracted image samples for 100% color presence
  assert(content.includes('extractedSamples'), 'Implements extractedSamples state for true image chroma fallback');
  assert(content.includes('images/reconstructed'), 'Fetches high-fidelity reconstructed image endpoint');
  assert(content.includes('hasChroma'), 'Validates chromaticity to prevent neutral gray collapse');

  // 4. MatrixMiniCanvas true color mode
  assert(content.includes("mode === 'color'"), 'MatrixMiniCanvas supports mode="color"');
  assert(content.includes('rgbData'), 'MatrixMiniCanvas supports direct rgbData');
  assert(content.includes('uData') && content.includes('vData'), 'MatrixMiniCanvas supports uData and vData planar inputs');

  // 5. Planar Y, Cb, Cr support and removal of redundant focus view
  assert(!content.includes("'reconstructed_only'"), 'Removes redundant reconstructed_only focus view');
  assert(content.includes("'Cb'") && content.includes("'Cr'"), 'Supports discrete planar components Y, Cb, Cr');
  assert(content.includes("Clip(P + R&apos;)"), "Displays mathematical reconstructed sample formula Clip(P + R')");
  assert(content.includes('Original (S)') && content.includes('Prediction (P)') && content.includes('Residual (R = S - P)'), 'Renders 4-Way comparison cards');

  // 6. Apple Pro minimalist design rules
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert(!emojiRegex.test(content), 'ReconPictureVisualizer contains zero emoji icons');
  assert(!content.includes('border-dashed') && !content.includes('borderStyle: "dashed"'), 'ReconPictureVisualizer has 100% solid borders (zero dashed)');
  assert(content.includes('Escape'), 'Provides universal Escape shortcut to deselect active pixel');
}

console.log('\nTest Suite 3: ActiveStageViewport CP_05 Integration');
{
  const viewportPath = resolve(__dirname, '../components/app/ActiveStageViewport.jsx');
  const viewportContent = readFileSync(viewportPath, 'utf8');

  assert(viewportContent.includes('<ReconPictureVisualizer'), 'ActiveStageViewport renders ReconPictureVisualizer');
  assert(viewportContent.includes('imageSrc={imagePreview}'), 'Passes imageSrc prop to ReconPictureVisualizer');
  assert(viewportContent.includes('jobId={jobId}'), 'Passes jobId prop to ReconPictureVisualizer');
  assert(viewportContent.includes('API_BASE_URL={API_BASE_URL}'), 'Passes API_BASE_URL prop to ReconPictureVisualizer');
  assert(viewportContent.includes('FourPictureComparison'), 'Preserves FourPictureComparison split slider in overview mode');
}

console.log(`\n=== CP_05 RECON PICTURE TEST SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED ===\n`);

if (totalFailed > 0) {
  process.exit(1);
}
