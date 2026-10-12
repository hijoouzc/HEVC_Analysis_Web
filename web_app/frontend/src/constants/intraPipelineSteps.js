/**
 * intraPipelineSteps.js
 * 5-Stage Execution Timeline definition for HEVC HM-16.0 Intra Search & RDO Flow
 */

export const PIPELINE_STEPS = [
  {
    id: 1,
    title: '1. Boundary & Filter',
    functionName: 'initIntraPatternChType()',
    subtext: '4N+1 Reference Samples & MDIS Filter',
    cppFile: 'TComPrediction.cpp',
    tag: 'Pre-Filter'
  },
  {
    id: 2,
    title: '2. RMD 35 Modes',
    functionName: 'FOR EACH 35 MODES: RMD',
    subtext: 'Hadamard SATD Fast Ranking',
    cppFile: 'TEncSearch.cpp',
    tag: 'Fast Funnel'
  },
  {
    id: 3,
    title: '3. Candidates & MPM',
    functionName: 'getIntraDirPredictor()',
    subtext: 'Top K Selection + 3 MPM Derivation',
    cppFile: 'TComDataCU.cpp',
    tag: 'Pruning'
  },
  {
    id: 4,
    title: '4. Full RDO & TU',
    functionName: 'xRecurIntraCodingLumaQT()',
    subtext: "DST/DCT, Quant & Reconstruction S'",
    cppFile: 'TComTrQuant.cpp',
    tag: 'Full RDO'
  },
  {
    id: 5,
    title: '5. Chroma & Winner',
    functionName: 'estIntraPredChromaQT()',
    subtext: '5 Chroma Modes & Winner Commitment',
    cppFile: 'TEncCu.cpp',
    tag: 'Decision'
  }
];
