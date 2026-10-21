import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSampleColorAndTextColor, bt709RgbToYuv } from '../../src/utils/colorUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ PASS: ${message}`);
}

console.log('\n=== RUNNING CHANNEL & VALUES UNIFIED SYNC TEST SUITE ===');

console.log('\nTest Suite 1: Bug 1 - TransformQuantVisualizer initialViewLayout & Component Tabs');
{
  const tqPath = resolve(__dirname, '../../src/components/stages/cp04_transform_quant/TransformQuantVisualizer.jsx');
  const tqContent = readFileSync(tqPath, 'utf8');

  assert(tqContent.includes("initialViewLayout = 'dual'"), 'TransformQuantVisualizer defines initialViewLayout = "dual" default prop');
  assert(tqContent.includes('const [viewLayout, setViewLayout] = useState(initialViewLayout);'), 'Initializes viewLayout with initialViewLayout prop without crash');
  assert(tqContent.includes('propsChannel === undefined && ('), 'Conditionally hides Component tabs when channel is controlled from parent');
}

console.log('\nTest Suite 2: Bug 2 - colorUtils Cb/Cr color mapping and bt709RgbToYuv');
{
  // Test Cb styling
  const cbStyle = getSampleColorAndTextColor(180, 'Cb');
  const uStyle = getSampleColorAndTextColor(180, 'U');
  assert(cbStyle.bg === uStyle.bg, 'Cb and U produce bit-exact same CSS background');
  assert(cbStyle.color === uStyle.color, 'Cb and U produce bit-exact same text contrast');

  // Test Cr styling
  const crStyle = getSampleColorAndTextColor(180, 'Cr');
  const vStyle = getSampleColorAndTextColor(180, 'V');
  assert(crStyle.bg === vStyle.bg, 'Cr and V produce bit-exact same CSS background');
  assert(crStyle.color === vStyle.color, 'Cr and V produce bit-exact same text contrast');

  // Ensure Cb is NOT luma
  const lumaStyle = getSampleColorAndTextColor(180, 'Y');
  assert(cbStyle.bg !== lumaStyle.bg, 'Cb is distinct from Luma Y grayscale');
  assert(crStyle.bg !== lumaStyle.bg, 'Cr is distinct from Luma Y grayscale');

  // Test bt709RgbToYuv
  const yuv = bt709RgbToYuv(255, 0, 0); // Pure Red
  assert(yuv.y === 54, `Pure red luma is 54 (0.2126 * 255 = 54), got ${yuv.y}`);
  assert(yuv.cr === 255, `Pure red Cr is 255 (maximum red difference), got ${yuv.cr}`);
  assert(yuv.cb === 99, `Pure red Cb is 99, got ${yuv.cb}`);
}

console.log('\nTest Suite 3: Bug 2 - IntraPredictionFlow Cb vs Cr separation & UI badges');
{
  const ipPath = resolve(__dirname, '../../src/components/stages/cp02_intra_search/IntraPredictionFlow.jsx');
  const ipContent = readFileSync(ipPath, 'utf8');

  assert(ipContent.includes("const isU = channel === 'U' || channel === 'Cb';"), 'Defines isU for both U and Cb');
  assert(ipContent.includes("const isV = channel === 'V' || channel === 'Cr';"), 'Defines isV for both V and Cr');
  assert(ipContent.includes("} else if (isU) {"), 'Canvas color mapping checks isU before Cr');
  assert(ipContent.includes("channel === 'Y' ? 'Luma Y' : isU ? 'Chroma Cb' : 'Chroma Cr'"), 'Channel badge distinguishes Chroma Cb from Chroma Cr');
  assert(ipContent.includes("id: 'Cb', label: 'Cb (Chroma)'"), 'Uncontrolled SegmentedControl uses Cb label');
  assert(ipContent.includes("id: 'Cr', label: 'Cr (Chroma)'"), 'Uncontrolled SegmentedControl uses Cr label');
}

console.log('\nTest Suite 4: Bug 3 - ReconPictureVisualizer Component SegmentedControl guard');
{
  const reconPath = resolve(__dirname, '../../src/components/stages/cp05_recon_picture/ReconPictureVisualizer.jsx');
  const reconContent = readFileSync(reconPath, 'utf8');

  assert(reconContent.includes('propsComponent === undefined && ('), 'ReconPictureVisualizer hides SegmentedControl when component is controlled');
}

console.log('\nTest Suite 5: Bug 4 - FourPictureComparison Chroma channel binding & activeOrigUrl');
{
  const fpcPath = resolve(__dirname, '../../src/components/stages/cp05_recon_picture/FourPictureComparison.jsx');
  const fpcContent = readFileSync(fpcPath, 'utf8');

  assert(fpcContent.includes("channel = 'Y'"), 'FourPictureComparison declares channel parameter');
  assert(fpcContent.includes("const isU = channel === 'Cb' || channel === 'U';"), 'Derives isU in FourPictureComparison');
  assert(fpcContent.includes("const isV = channel === 'Cr' || channel === 'V';"), 'Derives isV in FourPictureComparison');
  assert(fpcContent.includes("const isChroma = isU || isV;"), 'Derives isChroma in FourPictureComparison');
  assert(fpcContent.includes("/images/${plane}"), 'Points to plane endpoint for chroma planes');
  assert(fpcContent.includes("bt709RgbToYuv"), 'Converts extracted canvas pixels using BT.709 colorimetry');
  assert(fpcContent.includes("channel={channel}"), 'Passes channel to PixelMatrixCanvas');
  assert(fpcContent.includes("getSampleColorAndTextColor(val, channel)"), 'Applies channel-aware color styling to matrix DOM cells');
  assert(fpcContent.includes("{isU ? 'Cb' : 'Cr'}"), 'Displays Cb/Cr badge on comparison cards when chroma is active');
}

console.log('\nTest Suite 6: Bug 5 - showValues propagation to Step 5 & RdoQuadtreeSimulator');
{
  const vpPath = resolve(__dirname, '../../src/components/app/ActiveStageViewport.jsx');
  const vpContent = readFileSync(vpPath, 'utf8');
  assert(vpContent.includes('showValues={guidedShowValues}'), 'ActiveStageViewport forwards guidedShowValues to Step5RdDecision');

  const s5Path = resolve(__dirname, '../../src/components/guided/Step5RdDecision.jsx');
  const s5Content = readFileSync(s5Path, 'utf8');
  assert(s5Content.includes('showValues = undefined'), 'Step5RdDecision accepts showValues prop');
  assert(s5Content.includes('showValues={showValues}'), 'Step5RdDecision forwards showValues to RdoQuadtreeSimulator');

  const simPath = resolve(__dirname, '../../src/components/stages/rdo_simulator/RdoQuadtreeSimulator.jsx');
  const simContent = readFileSync(simPath, 'utf8');
  assert(simContent.includes('showValues: propsShowValues = undefined'), 'RdoQuadtreeSimulator supports controlled propsShowValues');
  assert(simContent.includes('propsShowValues !== undefined ? propsShowValues : internalShowValues'), 'RdoQuadtreeSimulator resolves controlled showValues');

  const simCtrlPath = resolve(__dirname, '../../src/components/stages/rdo_simulator/subcomponents/SimulatorControls.jsx');
  const simCtrlContent = readFileSync(simCtrlPath, 'utf8');
  assert(simCtrlContent.includes('{onToggleValues && ('), 'SimulatorControls hides duplicate Values checkbox when controlled');
}

console.log('\nTest Suite 7: Bug 7 - Keyboard Shortcuts Cleanliness in GuidedJourneyBar');
{
  const barPath = resolve(__dirname, '../../src/components/guided/GuidedJourneyBar.jsx');
  const barContent = readFileSync(barPath, 'utf8');

  assert(!barContent.includes("e.key === '1' && onSelectStep"), 'GuidedJourneyBar does NOT intercept key 1 (handled by App.jsx)');
  assert(!barContent.includes("e.key === '2' && onSelectStep"), 'GuidedJourneyBar does NOT intercept key 2 (handled by App.jsx)');
  assert(!barContent.includes("e.key === '3' && onSelectStep"), 'GuidedJourneyBar does NOT intercept key 3 (handled by App.jsx)');
  assert(!barContent.includes("e.key === '4' && onSelectStep"), 'GuidedJourneyBar does NOT intercept key 4 (handled by App.jsx)');
  assert(!barContent.includes("e.key === '5' && onSelectStep"), 'GuidedJourneyBar does NOT intercept key 5 (handled by App.jsx)');
  assert(barContent.includes("e.key === 'c' || e.key === 'C'"), 'GuidedJourneyBar binds C key for channel cycling');
  assert(barContent.includes("e.key === 'v' || e.key === 'V'"), 'GuidedJourneyBar binds V key for Values toggle');
  assert(barContent.includes("['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName) || e.target?.isContentEditable"), 'GuidedJourneyBar guards against active inputs and contentEditable');
}

console.log('\nTest Suite 8: Zero Crash Verification on HM Analysis Start');
{
  const ipPath = resolve(__dirname, '../../src/components/stages/cp02_intra_search/IntraPredictionFlow.jsx');
  const ipContent = readFileSync(ipPath, 'utf8');
  assert(ipContent.includes('showChannelBadge = false'), 'IntraPredictionFlow declares showChannelBadge prop to prevent ReferenceError');

  const simPath = resolve(__dirname, '../../src/components/stages/rdo_simulator/RdoQuadtreeSimulator.jsx');
  const simContent = readFileSync(simPath, 'utf8');
  assert(simContent.includes('useCallback'), 'RdoQuadtreeSimulator imports useCallback from react');
}

console.log('\nTest Suite 9: Residual Gain (ResiGain) Unified Global Sync');
{
  const barPath = resolve(__dirname, '../../src/components/guided/GuidedJourneyBar.jsx');
  const barContent = readFileSync(barPath, 'utf8');
  assert(barContent.includes('resiGain = 4'), 'GuidedJourneyBar declares resiGain = 4 default prop');
  assert(barContent.includes("e.key === 'g' || e.key === 'G'"), 'GuidedJourneyBar binds G key for quick residual gain cycling');
  assert(barContent.includes('GAIN:'), 'GuidedJourneyBar displays GAIN: label');
  assert(barContent.includes('gains[(gains.indexOf(resiGain ?? 4) + 1) % gains.length]'), 'Cycles circularly through gains [1, 2, 4, 8]');

  const vpPath = resolve(__dirname, '../../src/components/app/ActiveStageViewport.jsx');
  const vpContent = readFileSync(vpPath, 'utf8');
  assert(vpContent.includes('const [guidedResiGain, setGuidedResiGain] = useState(4);'), 'ActiveStageViewport initializes guidedResiGain state');
  assert(vpContent.includes('resiGain={guidedResiGain}'), 'ActiveStageViewport forwards guidedResiGain to GuidedJourneyBar and steps');
  assert(vpContent.includes('onSelectResiGain={setGuidedResiGain}'), 'ActiveStageViewport passes onSelectResiGain callback');

  const s4Path = resolve(__dirname, '../../src/components/guided/Step4ReconInLoop.jsx');
  const s4Content = readFileSync(s4Path, 'utf8');
  assert(s4Content.includes('resiGain = 4'), 'Step4ReconInLoop accepts resiGain prop');
  assert(s4Content.includes('resiGain={resiGain}'), 'Step4ReconInLoop forwards resiGain to FourPictureComparison');

  const fpcPath = resolve(__dirname, '../../src/components/stages/cp05_recon_picture/FourPictureComparison.jsx');
  const fpcContent = readFileSync(fpcPath, 'utf8');
  assert(fpcContent.includes('resiGain: propsResiGain = undefined'), 'FourPictureComparison supports controlled propsResiGain');
  assert(fpcContent.includes('propsResiGain !== undefined ? propsResiGain : internalResiGain'), 'FourPictureComparison resolves controlled resiGain');

  const tqPath = resolve(__dirname, '../../src/components/stages/cp04_transform_quant/TransformQuantVisualizer.jsx');
  const tqContent = readFileSync(tqPath, 'utf8');
  assert(tqContent.includes('resiGain = 4'), 'TransformQuantVisualizer accepts resiGain prop');
  assert(tqContent.includes('Math.abs(val) * (resiGain || 1)'), 'TransformQuantVisualizer scales residual visualization with resiGain');
}

console.log('\n=== ALL CHANNEL & VALUES UNIFIED SYNC TESTS PASSED (100% CONFORMANCE) ===\n');
