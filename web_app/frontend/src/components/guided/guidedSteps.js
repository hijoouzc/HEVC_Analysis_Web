export const GUIDED_STEPS = [
  {
    id: 'STEP_1',
    num: 1,
    title: 'Frame & CU Partition',
    subtitle: 'CTU & QuadTree Hierarchy',
    badge: 'QuadTree',
    hmFunction: 'TEncCu::xCompressCU',
  },
  {
    id: 'STEP_2',
    num: 2,
    title: 'Intra Prediction',
    subtitle: '35 Modes, RMD & MPM',
    badge: 'Prediction',
    hmFunction: 'TEncSearch::estIntraPredLumaQT',
  },
  {
    id: 'STEP_3',
    num: 3,
    title: 'Transform & Quantization',
    subtitle: 'RQT, DCT/DST & Quant Coeffs',
    badge: 'Transform & Quant',
    hmFunction: 'TComTrQuant::transformNxN',
  },
  {
    id: 'STEP_4',
    num: 4,
    title: 'Reconstruction',
    subtitle: 'Picture Buffer & In-Loop Filters',
    badge: 'Picture Buffer',
    hmFunction: 'TComPic::getPicYuvRec',
  },
  {
    id: 'STEP_5',
    num: 5,
    title: 'RDO Decision',
    subtitle: 'Split vs No-Split & CABAC',
    badge: 'RDO Engine',
    hmFunction: 'TEncCu::xCheckBestMode',
  },
];

export function getStepByNum(num) {
  const n = Number(num);
  return GUIDED_STEPS.find((s) => s.num === n) || null;
}

export function getStepById(id) {
  return GUIDED_STEPS.find((s) => s.id === id) || null;
}
