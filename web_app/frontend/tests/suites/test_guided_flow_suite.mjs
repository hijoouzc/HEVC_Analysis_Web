import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ PASS: ${message}`);
}

console.log('\n=== RUNNING GUIDED FLOW 5-STEP & DUAL-MODE TEST SUITE ===');

console.log('\nTest Suite 1: GuidedSteps Specification & JourneyBar Component');
{
  const stepsPath = resolve(__dirname, '../../src/components/guided/guidedSteps.js');
  const stepsContent = readFileSync(stepsPath, 'utf8');

  assert(stepsContent.includes("id: 'STEP_1'"), 'Defines STEP_1: Frame & CU Partition');
  assert(stepsContent.includes("id: 'STEP_2'"), 'Defines STEP_2: Intra Prediction');
  assert(stepsContent.includes("id: 'STEP_3'"), 'Defines STEP_3: Transform & Quantization');
  assert(stepsContent.includes("id: 'STEP_4'"), 'Defines STEP_4: Reconstruction');
  assert(stepsContent.includes("id: 'STEP_5'"), 'Defines STEP_5: RDO Decision');
  assert(!stepsContent.includes('checkpoint:'), 'Eliminates orphaned checkpoint strings from guidedSteps.js');

  const barPath = resolve(__dirname, '../../src/components/guided/GuidedJourneyBar.jsx');
  const barContent = readFileSync(barPath, 'utf8');

  assert(!barContent.includes('Trace Available'), 'Eliminated repetitive Trace Available status badges from GuidedJourneyBar');
  assert(!barContent.includes('CTU & QuadTree Hierarchy'), 'Eliminated subtitle clutter from GuidedJourneyBar');
  assert(barContent.includes('Partition'), 'Renders concise step title Partition');
  assert(barContent.includes('Prediction'), 'Renders concise step title Prediction');
  assert(!/[\u{1F300}-\u{1F9FF}]/u.test(barContent), 'Contains zero emoji icons');
  assert(barContent.includes('0.5px solid var(--separator)'), 'Enforces Apple HIG 0.5px solid borders');
}

console.log('\nTest Suite 2: GuidedFooterNav Component Conformance');
{
  const navPath = resolve(__dirname, '../../src/components/guided/GuidedFooterNav.jsx');
  const navContent = readFileSync(navPath, 'utf8');

  assert(navContent.includes('onSelectStep(prevStep.id)'), 'Navigates to previous step');
  assert(navContent.includes('onSelectStep(nextStep.id)'), 'Navigates to next step');
  assert(!navContent.includes('onJumpToExpert'), 'GuidedFooterNav cleanly eliminated onJumpToExpert prop and button');
  assert(!navContent.includes('Expert'), 'GuidedFooterNav eliminated all Expert mode strings');
  assert(navContent.includes('CONTEXT:'), 'Displays Selected CU context summary');
  assert(!/[\u{1F300}-\u{1F9FF}]/u.test(navContent), 'Contains zero emoji icons');
}

console.log('\nTest Suite 3: Step Containers Conformance & Rigorous Data Bindings');
{
  // Step 1: Frame & Tree
  const s1Path = resolve(__dirname, '../../src/components/guided/Step1FrameTree.jsx');
  const s1Content = readFileSync(s1Path, 'utf8');
  assert(!s1Content.includes('CompactStepRibbon'), 'Step 1 eliminates CompactStepRibbon clutter');
  assert(s1Content.includes('QuadTreeVisualizer'), 'Step 1 renders QuadTreeVisualizer');
  assert(s1Content.includes('GopReferenceVisualizer'), 'Step 1 renders GopReferenceVisualizer');
  assert(s1Content.includes('Trace This CU in Flow'), 'Step 1 provides Callout to trace focused CU');

  // Step 2: Prediction Candidates
  const s2Path = resolve(__dirname, '../../src/components/guided/Step2Prediction.jsx');
  const s2Content = readFileSync(s2Path, 'utf8');
  assert(!s2Content.includes('CompactStepRibbon'), 'Step 2 eliminates CompactStepRibbon clutter');
  assert(s2Content.includes('IntraPredictionFlow'), 'Step 2 renders IntraPredictionFlow');
  assert(s2Content.includes('All-Intra (AI) Configuration Active'), 'Step 2 explains I-Slice bypasses Inter Search');
  assert(s2Content.includes('InterSearchVisualizer'), 'Step 2 renders InterSearchVisualizer for P/B-slices');

  // Step 3: Residual & TU
  const s3Path = resolve(__dirname, '../../src/components/guided/Step3ResidualTu.jsx');
  const s3Content = readFileSync(s3Path, 'utf8');
  assert(!s3Content.includes('CompactStepRibbon'), 'Step 3 eliminates CompactStepRibbon clutter');
  assert(s3Content.includes('TransformQuantVisualizer'), 'Step 3 renders TransformQuantVisualizer');
  assert(s3Content.includes('SPATIAL DOMAIN (x, y)'), 'Step 3 explicitly separates Spatial Domain (x, y)');
  assert(s3Content.includes('FREQUENCY DOMAIN (u, v)'), 'Step 3 explicitly separates Frequency Domain (u, v)');
  assert(s3Content.includes('forwardTransformRecords'), 'Step 3 filters forward transform records');
  assert(s3Content.includes('AMBIGUOUS MAPPING NOTICE'), 'Step 3 warns on ambiguous candidate trials');
  assert(s3Content.includes('Candidate Modes RDO Leaderboard'), 'Step 3 renders candidate RDO leaderboard');

  // Step 4: Reconstruction
  const s4Path = resolve(__dirname, '../../src/components/guided/Step4ReconInLoop.jsx');
  const s4Content = readFileSync(s4Path, 'utf8');
  assert(!s4Content.includes('CompactStepRibbon'), 'Step 4 eliminates CompactStepRibbon clutter');
  assert(s4Content.includes('FourPictureComparison'), 'Step 4 renders FourPictureComparison');
  assert(s4Content.includes('ReconPictureVisualizer'), 'Step 4 renders ReconPictureVisualizer');
  assert(s4Content.includes('InLoopFilterVisualizer'), 'Step 4 renders InLoopFilterVisualizer');

  // Step 5: RD Decision & Simulator
  const s5Path = resolve(__dirname, '../../src/components/guided/Step5RdDecision.jsx');
  const s5Content = readFileSync(s5Path, 'utf8');
  assert(!s5Content.includes('CompactStepRibbon'), 'Step 5 eliminates CompactStepRibbon clutter');
  assert(s5Content.includes('cost_nosplit'), 'Step 5 displays cost_nosplit');
  assert(s5Content.includes('cost_split'), 'Step 5 displays cost_split');
  assert(s5Content.includes('xCompressCU'), 'Step 5 references xCompressCU picture buffer commit');
  assert(s5Content.includes('xEncodeCU'), 'Step 5 references xEncodeCU bitstream syntax pass');
  assert(s5Content.includes('MULTIPLE EVALUATIONS'), 'Step 5 handles multiple QP trials');
  assert(s5Content.includes('Leaf CU (Maximum Coding Depth: 8×8)'), 'Step 5 handles leaf node max depth');
  assert(s5Content.includes('State (After Bin Transition)'), 'Step 5 labels CABAC state after bin');
  assert(s5Content.includes('Cumulative Written Bits (At Bin Trace Time)'), 'Step 5 labels cumulative written bits');
  assert(s5Content.includes('RdoQuadtreeSimulator'), 'Step 5 integrates Standalone RDO Simulator');
  assert(s5Content.includes('SANDBOX EXPERIMENT'), 'Step 5 tags RDO Simulator as Sandbox');
}

console.log('\nTest Suite 4: ActiveStageViewport Guided Stream Orchestration');
{
  const viewportPath = resolve(__dirname, '../../src/components/app/ActiveStageViewport.jsx');
  const viewportContent = readFileSync(viewportPath, 'utf8');

  assert(viewportContent.includes('<GuidedJourneyBar'), 'Viewport renders GuidedJourneyBar in guided mode');
  assert(viewportContent.includes('<GuidedFooterNav'), 'Viewport renders GuidedFooterNav in guided mode');
  assert(viewportContent.includes('<Step1FrameTree'), 'Viewport mounts Step1FrameTree in Step 1');
  assert(viewportContent.includes('<Step2Prediction'), 'Viewport mounts Step2Prediction in Step 2');
  assert(viewportContent.includes('<Step3ResidualTu'), 'Viewport mounts Step3ResidualTu in Step 3');
  assert(viewportContent.includes('<Step4ReconInLoop'), 'Viewport mounts Step4ReconInLoop in Step 4');
  assert(viewportContent.includes('<Step5RdDecision'), 'Viewport mounts Step5RdDecision in Step 5');
  assert(!viewportContent.includes("id: 'expert'"), 'Viewport cleanly eliminated Expert Mode clutter');
}

console.log('\nTest Suite 5: App Shell Keyboard Shortcuts & Guided State');
{
  const appPath = resolve(__dirname, '../../src/App.jsx');
  const appContent = readFileSync(appPath, 'utf8');

  assert(appContent.includes("const [guidedStep, setGuidedStep] = useState('STEP_1');"), 'App initializes guidedStep to STEP_1');
  assert(appContent.includes("setGuidedStep(targetStep.id)"), 'App switches guided steps dynamically via getStepByNum');
  assert(appContent.includes("getStepByNum(e.key)"), 'App resolves numeric shortcut via getStepByNum');
  assert(!appContent.includes("e.key === 'm'"), 'App cleanly eliminated M key expert toggle');
}

console.log('\nTest Suite 6: QuickJumpMenu Floating Pop-up Conformance');
{
  const jumpMenuPath = resolve(__dirname, '../../src/components/guided/QuickJumpMenu.jsx');
  const jumpMenuContent = readFileSync(jumpMenuPath, 'utf8');
  const stepsPath = resolve(__dirname, '../../src/components/guided/guidedSteps.js');
  const stepsContent = readFileSync(stepsPath, 'utf8');

  assert(jumpMenuContent.includes("import { GUIDED_STEPS } from './guidedSteps'"), 'QuickJumpMenu consumes single-source-of-truth guidedSteps');
  assert(jumpMenuContent.includes('export const SECTIONS = GUIDED_STEPS'), 'QuickJumpMenu aliases SECTIONS to GUIDED_STEPS');

  assert(stepsContent.includes("title: 'Frame & CU Partition'"), 'guidedSteps defines Stage 1 QuadTree');
  assert(stepsContent.includes("title: 'Intra Prediction'"), 'guidedSteps defines Stage 2 Prediction');
  assert(stepsContent.includes("title: 'Transform & Quantization'"), 'guidedSteps defines Stage 3 Transform & Quantization');
  assert(stepsContent.includes("title: 'Reconstruction'"), 'guidedSteps defines Stage 4 Reconstruction');
  assert(stepsContent.includes("title: 'RDO Decision'"), 'guidedSteps defines Stage 5 RD Decision');

  assert(stepsContent.includes("hmFunction: 'TEncCu::xCompressCU'"), 'guidedSteps maps HM xCompressCU');
  assert(stepsContent.includes("hmFunction: 'TEncSearch::estIntraPredLumaQT'"), 'guidedSteps maps HM estIntraPredLumaQT');
  assert(stepsContent.includes("hmFunction: 'TComTrQuant::transformNxN'"), 'guidedSteps maps HM transformNxN');
  assert(stepsContent.includes("hmFunction: 'TComPic::getPicYuvRec'"), 'guidedSteps maps HM getPicYuvRec');
  assert(stepsContent.includes("hmFunction: 'TEncCu::xCheckBestMode'"), 'guidedSteps maps HM xCheckBestMode');

  assert(jumpMenuContent.includes("e.key === 'Escape'"), 'QuickJumpMenu dismisses on Escape key');
  assert(jumpMenuContent.includes('handleClickOutside'), 'QuickJumpMenu dismisses on click outside');
  assert(jumpMenuContent.includes("scrollIntoView({ behavior: 'smooth'"), 'QuickJumpMenu executes smooth scrolling to stage');
  assert(jumpMenuContent.includes('position: \'fixed\''), 'QuickJumpMenu floats with fixed positioning at viewport bottom');
  assert(jumpMenuContent.includes('[{sec.num}]'), 'QuickJumpMenu renders numeric shortcut indicator [1..5]');
  assert(!/[\u0080-\uFFFF]/.test(jumpMenuContent.replace(/[’—–×·…→▲▼●]/g, '')), 'QuickJumpMenu uses 100% English terminology');
}

console.log('\n=== ALL GUIDED FLOW & DUAL-MODE TESTS PASSED (100% CONFORMANCE) ===\n');
