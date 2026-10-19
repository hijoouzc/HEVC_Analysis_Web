import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PIPELINE_STEPS } from '../../src/constants/intraPipelineSteps.js';
import {
  HM_INTRA_PREDICTION_SNIPPET,
  HM_EST_INTRAPRED_LUMA_SNIPPET,
  HM_RECUR_INTRA_CODING_SNIPPET,
  HM_CHROMA_INTRA_SNIPPET
} from '../../src/constants/hmSourceSnippets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== RUNNING PHASE 2: INTRA PIPELINE STEPPER & INSPECTOR TEST SUITE ===\n');

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

// -------------------------------------------------------------------
// TEST SUITE 1: Pipeline Steps Definition & HM-18.0 Call-Stack Mapping
// -------------------------------------------------------------------
console.log('Test Suite 1: Pipeline Steps & Call-Stack Mapping');

assert(Array.isArray(PIPELINE_STEPS), 'PIPELINE_STEPS is an exported array');
assert(PIPELINE_STEPS.length === 5, 'Exactly 5 pipeline steps defined for HM-18.0 Intra Search');

const expectedFunctions = [
  'initIntraPatternChType()',
  'FOR EACH 35 MODES: RMD',
  'getIntraDirPredictor()',
  'xRecurIntraCodingLumaQT()',
  'estIntraPredChromaQT()'
];

const expectedFiles = [
  'TComPrediction.cpp',
  'TEncSearch.cpp',
  'TComDataCU.cpp',
  'TComTrQuant.cpp',
  'TEncCu.cpp'
];

PIPELINE_STEPS.forEach((step, idx) => {
  assert(step.id === idx + 1, `Step ${idx + 1} has sequential ID ${idx + 1}`);
  assert(typeof step.title === 'string' && step.title.length > 0, `Step ${idx + 1} has valid title: "${step.title}"`);
  assert(step.functionName === expectedFunctions[idx], `Step ${idx + 1} maps to C++ function: ${step.functionName}`);
  assert(step.cppFile === expectedFiles[idx], `Step ${idx + 1} maps to C++ file: ${step.cppFile}`);
  assert(typeof step.tag === 'string' && step.tag.length > 0, `Step ${idx + 1} has stage tag: "${step.tag}"`);
});

// -------------------------------------------------------------------
// TEST SUITE 2: Official HM-18.0 C++ Source Code Snippets Conformance
// -------------------------------------------------------------------
console.log('\nTest Suite 2: HM-18.0 C++ Source Code Snippets Conformance');

assert(Boolean(HM_INTRA_PREDICTION_SNIPPET), 'HM_INTRA_PREDICTION_SNIPPET is defined');
assert(HM_INTRA_PREDICTION_SNIPPET.functionName.includes('predIntraLumaAng'), 'HM_INTRA_PREDICTION_SNIPPET references predIntraLumaAng');

assert(Boolean(HM_EST_INTRAPRED_LUMA_SNIPPET), 'HM_EST_INTRAPRED_LUMA_SNIPPET is defined');
assert(HM_EST_INTRAPRED_LUMA_SNIPPET.functionName.includes('estIntraPredLumaQT'), 'HM_EST_INTRAPRED_LUMA_SNIPPET references estIntraPredLumaQT');
assert(HM_EST_INTRAPRED_LUMA_SNIPPET.codeSnippet.includes('CandModeList'), 'RMD candidate list manipulation is included in code snippet');
assert(HM_EST_INTRAPRED_LUMA_SNIPPET.codeSnippet.includes('NUM_MOST_PROBABLE_MODES'), 'MPM derivation is referenced in code snippet');

assert(Boolean(HM_RECUR_INTRA_CODING_SNIPPET), 'HM_RECUR_INTRA_CODING_SNIPPET is defined');
assert(HM_RECUR_INTRA_CODING_SNIPPET.functionName.includes('xRecurIntraCodingLumaQT'), 'HM_RECUR_INTRA_CODING_SNIPPET references xRecurIntraCodingLumaQT');
assert(HM_RECUR_INTRA_CODING_SNIPPET.codeSnippet.includes('transformNxN'), 'Transform step is present in RDO recursion');
assert(HM_RECUR_INTRA_CODING_SNIPPET.codeSnippet.includes('invTransformNxN'), 'Inverse transform step is present');
assert(HM_RECUR_INTRA_CODING_SNIPPET.codeSnippet.includes('calcRdCost'), 'RD Cost calculation is present');

assert(Boolean(HM_CHROMA_INTRA_SNIPPET), 'HM_CHROMA_INTRA_SNIPPET is defined');
assert(HM_CHROMA_INTRA_SNIPPET.codeSnippet.includes('getAllowedChromaDir'), 'getAllowedChromaDir is present in Chroma snippet');
assert(HM_CHROMA_INTRA_SNIPPET.codeSnippet.includes('DM_CHROMA_IDX'), 'DM_CHROMA_IDX mode index is present in Chroma snippet');
assert(HM_CHROMA_INTRA_SNIPPET.codeSnippet.includes('34'), 'Mode 34 replacement rule is explicitly represented');

// -------------------------------------------------------------------
// TEST SUITE 3: Component Ergonomics & 100% Click-Only Integrity
// -------------------------------------------------------------------
console.log('\nTest Suite 3: Click-Only UI Ergonomics & Zero Hover Artifacts');

const stepperCode = fs.readFileSync(path.join(__dirname, '../../src/components/stages/cp02_intra_search/pipeline/IntraPipelineStepper.jsx'), 'utf-8');
const inspectorCode = fs.readFileSync(path.join(__dirname, '../../src/components/stages/cp02_intra_search/pipeline/IntraPipelineInspector.jsx'), 'utf-8');
const flowCode = fs.readFileSync(path.join(__dirname, '../../src/components/stages/cp02_intra_search/IntraPredictionFlow.jsx'), 'utf-8');

assert(!stepperCode.includes('onMouseEnter'), 'IntraPipelineStepper has zero onMouseEnter listeners');
assert(!stepperCode.includes('onMouseOver'), 'IntraPipelineStepper has zero onMouseOver listeners');
assert(!stepperCode.includes('scale-105') && !stepperCode.includes('scale-110'), 'IntraPipelineStepper has zero bouncy hover transform animations');
assert(stepperCode.includes('ArrowLeft') && stepperCode.includes('ArrowRight'), 'IntraPipelineStepper registers keyboard arrows (←/→) for step navigation');
assert(stepperCode.includes('disabled={activeStep <= 1}'), 'IntraPipelineStepper disables Prev button at Step 1');
assert(stepperCode.includes('disabled={activeStep >= PIPELINE_STEPS.length}'), 'IntraPipelineStepper disables Next button at Step 5');

assert(!inspectorCode.includes('onMouseEnter'), 'IntraPipelineInspector has zero onMouseEnter listeners');
assert(!inspectorCode.includes('onMouseOver'), 'IntraPipelineInspector has zero onMouseOver listeners');
assert(inspectorCode.includes('Show HM C++ Code'), 'IntraPipelineInspector provides direct trigger button for HM source inspection');
assert(inspectorCode.includes('STAGE_INSPECTOR_CONFIG'), 'IntraPipelineInspector defines context metadata for all 5 stages');

// -------------------------------------------------------------------
// TEST SUITE 4: Mathematical Formulas & Standard Normative References
// -------------------------------------------------------------------
console.log('\nTest Suite 4: Mathematical Formulas & Standard Specs');

assert(inspectorCode.includes('MDIS 3-Tap Filter'), 'Step 1 displays MDIS 3-tap filter mathematical formula');
assert(inspectorCode.includes('J_RMD = SATD(Org, Pred) + λ_Had · R_mode'), 'Step 2 displays Hadamard SATD RMD cost formula');
assert(inspectorCode.includes('Top_K(RMD) ∪ { MPM_0, MPM_1, MPM_2 }'), 'Step 3 displays candidate pool union formula');
assert(inspectorCode.includes('J_RDO = D_SSE(Org, Reco) + λ_mode · R_CABAC'), 'Step 4 displays true Rate-Distortion cost formula');
assert(inspectorCode.includes('Clip3(0, 255, P + R'), 'Step 4 displays local sample reconstruction formula');
assert(inspectorCode.includes('DM_CHROMA'), 'Step 5 displays Chroma candidate derivation rule');

assert(inspectorCode.includes('8.4.4.2.2'), 'Inspector cites H.265 Section 8.4.4.2.2 (Reference sample filtering)');
assert(inspectorCode.includes('8.4.2'), 'Inspector cites H.265 Section 8.4.2 (Rough mode decision & MPM derivation)');
assert(inspectorCode.includes('8.4.3'), 'Inspector cites H.265 Section 8.4.3 (Chroma prediction)');
assert(inspectorCode.includes('8.7'), 'Inspector cites H.265 Section 8.7 (Transform & scaling specification)');

// -------------------------------------------------------------------
// TEST SUITE 5: IntraPredictionFlow Integration & Fallback State
// -------------------------------------------------------------------
console.log('\nTest Suite 5: IntraPredictionFlow Integration & Data Synchronization');

assert(flowCode.includes("id: 'pipeline', label: 'RDO Pipeline Flow'"), 'IntraPredictionFlow provides RDO Pipeline Flow tab in SegmentedControl');
assert(flowCode.includes('<IntraPipelineStepper'), 'IntraPredictionFlow renders IntraPipelineStepper in pipeline tab');
assert(flowCode.includes('<IntraPipelineInspector'), 'IntraPredictionFlow renders IntraPipelineInspector in pipeline tab');
assert(flowCode.includes('effectivePipelineData'), 'IntraPredictionFlow manages effectivePipelineData with robust fallback');
assert(flowCode.includes('handleOpenHmSnippet'), 'IntraPredictionFlow connects snippet opener to HmSourceCodeModal');
assert(flowCode.includes('activePipelineStep'), 'IntraPredictionFlow synchronizes activePipelineStep');

// Verify ActiveStageViewport passes required properties
const viewportCode = fs.readFileSync(path.join(__dirname, '../../src/components/app/ActiveStageViewport.jsx'), 'utf-8');
assert(viewportCode.includes('jobId={jobId}'), 'ActiveStageViewport passes jobId to IntraPredictionFlow');
assert(viewportCode.includes('API_BASE_URL={API_BASE_URL}'), 'ActiveStageViewport passes API_BASE_URL to IntraPredictionFlow');

console.log(`\n=== PHASE 2 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED ===\n`);

if (failCount > 0) {
  process.exit(1);
}
