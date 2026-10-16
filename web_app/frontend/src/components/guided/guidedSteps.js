export const GUIDED_STEPS = [
  {
    id: 'STEP_1',
    num: 1,
    title: 'Frame & CU Partition',
    subtitle: 'CTU & QuadTree Hierarchy',
    checkpoint: 'CP_00 + CP_01',
  },
  {
    id: 'STEP_2',
    num: 2,
    title: 'Intra Prediction',
    subtitle: '35 Modes, RMD & MPM',
    checkpoint: 'CP_02 + CP_03',
  },
  {
    id: 'STEP_3',
    num: 3,
    title: 'Transform & Quantization',
    subtitle: 'RQT, DCT/DST & Quant Coeffs',
    checkpoint: 'CP_04',
  },
  {
    id: 'STEP_4',
    num: 4,
    title: 'Reconstruction',
    subtitle: 'Picture Buffer & In-Loop Filters',
    checkpoint: 'CP_05 + CP_06',
  },
  {
    id: 'STEP_5',
    num: 5,
    title: 'RDO Decision',
    subtitle: 'Split vs No-Split & CABAC',
    checkpoint: 'CP_07 + RDO_SIM',
  },
];
