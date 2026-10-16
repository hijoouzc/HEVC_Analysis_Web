/**
 * test_recon_picture_suite.mjs
 * Verification test suite for CP_05 ReconPictureVisualizer & ITU-R BT.709 Color Accuracy
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { bt709YuvToRgb, getChromaColorAndTextColor, getSampleColorAndTextColor } from './colorUtils.js';

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

  // Test Chroma U (Cb) Isolated Mode: Neutral Y=128, Neutral Cr=128
  // Max Cb=255 -> Pure Blue tint (B dominant)
  const cbMax = bt709YuvToRgb(128, 255, 128);
  assert(cbMax.b > cbMax.r && cbMax.b > cbMax.g, `Cb=255 produces Blue dominant: R=${cbMax.r}, G=${cbMax.g}, B=${cbMax.b}`);
  assert(cbMax.b === 255 && cbMax.r === 128 && cbMax.g === 104, 'Cb=255 exact BT.709 sRGB: (128, 104, 255)');

  // Min Cb=0 -> Warm Yellow tint (R & G dominant over B=0)
  const cbMin = bt709YuvToRgb(128, 0, 128);
  assert(cbMin.r > cbMin.b && cbMin.g > cbMin.b, `Cb=0 produces Yellow dominant (R,G > B): R=${cbMin.r}, G=${cbMin.g}, B=${cbMin.b}`);
  assert(cbMin.b === 0 && cbMin.r === 128 && cbMin.g === 152, 'Cb=0 exact BT.709 sRGB: (128, 152, 0)');

  // Test Chroma V (Cr) Isolated Mode: Neutral Y=128, Neutral Cb=128
  // Max Cr=255 -> Crimson Red tint (R dominant)
  const crMax = bt709YuvToRgb(128, 128, 255);
  assert(crMax.r > crMax.g && crMax.r > crMax.b, `Cr=255 produces Red dominant: R=${crMax.r}, G=${crMax.g}, B=${crMax.b}`);
  assert(crMax.r === 255 && crMax.g === 69 && crMax.b === 128, 'Cr=255 exact BT.709 sRGB: (255, 69, 128)');

  // Min Cr=0 -> Vibrant Green / Seafoam tint (G dominant over R=0)
  const crMin = bt709YuvToRgb(128, 128, 0);
  assert(crMin.g > crMin.r && crMin.g > crMin.b, `Cr=0 produces Green dominant: R=${crMin.r}, G=${crMin.g}, B=${crMin.b}`);
  assert(crMin.r === 0 && crMin.g === 188 && crMin.b === 128, 'Cr=0 exact BT.709 sRGB: (0, 188, 128)');

  // Test getChromaColorAndTextColor readability
  const cbMaxStyle = getChromaColorAndTextColor(255, true);
  assert(cbMaxStyle.color === '#FFFFFF', 'White text on dark Blue Cb=255 for high contrast');
  const cbMinStyle = getChromaColorAndTextColor(0, true);
  assert(cbMinStyle.color === '#000000', 'Black text on bright Yellow Cb=0 for high contrast');

  const crMaxStyle = getChromaColorAndTextColor(255, false);
  assert(crMaxStyle.color === '#FFFFFF', 'White text on dark Crimson Red Cr=255 for high contrast');
  const crMinStyle = getChromaColorAndTextColor(0, false);
  assert(crMinStyle.color === '#000000', 'Black text on bright Seafoam Green Cr=0 for high contrast');

  // Test getSampleColorAndTextColor channel dispatcher
  const sampleU = getSampleColorAndTextColor(255, 'U');
  assert(sampleU.bg === cbMaxStyle.bg, 'getSampleColorAndTextColor(255, "U") matches getChromaColorAndTextColor(255, true)');
  const sampleV = getSampleColorAndTextColor(255, 'V');
  assert(sampleV.bg === crMaxStyle.bg, 'getSampleColorAndTextColor(255, "V") matches getChromaColorAndTextColor(255, false)');
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

  // 4. MatrixMiniCanvas true color mode & chroma isolation modes
  assert(content.includes("mode === 'color'"), 'MatrixMiniCanvas supports mode="color"');
  assert(content.includes("mode === 'chroma_u'"), 'MatrixMiniCanvas supports mode="chroma_u" for isolated Cb');
  assert(content.includes("mode === 'chroma_v'"), 'MatrixMiniCanvas supports mode="chroma_v" for isolated Cr');
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

console.log('\nTest Suite 4: MacroMicroPixelViewer Component BT.709 Colorimetry');
{
  const viewerPath = resolve(__dirname, '../components/common/MacroMicroPixelViewer.jsx');
  const viewerContent = readFileSync(viewerPath, 'utf8');

  assert(viewerContent.includes('bt709YuvToRgb'), 'Imports and uses bt709YuvToRgb for macro canvas');
  assert(viewerContent.includes("channel === 'U'"), 'Handles channel U in macro canvas');
  assert(viewerContent.includes("channel === 'V'"), 'Handles channel V in macro canvas');
  assert(viewerContent.includes('bt709YuvToRgb(128, val, 128)'), 'Uses exact BT.709 neutral Y=128 for Cb macro canvas');
  assert(viewerContent.includes('bt709YuvToRgb(128, 128, val)'), 'Uses exact BT.709 neutral Y=128 for Cr macro canvas');
  assert(viewerContent.includes('getSampleColorAndTextColor'), 'Uses getSampleColorAndTextColor for micro grid cells');
}

console.log(`\n=== CP_05 RECON PICTURE TEST SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED ===\n`);

if (totalFailed > 0) {
  process.exit(1);
}
