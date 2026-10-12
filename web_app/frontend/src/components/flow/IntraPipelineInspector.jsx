import React from 'react';
import { Button } from '../apple';
import {
  HM_INTRA_PREDICTION_SNIPPET,
  HM_EST_INTRAPRED_LUMA_SNIPPET,
  HM_RECUR_INTRA_CODING_SNIPPET,
  HM_CHROMA_INTRA_SNIPPET
} from '../../constants/hmSourceSnippets';

/**
 * Metadata definition for each of the 5 pipeline stages
 */
const STAGE_INSPECTOR_CONFIG = {
  1: {
    stageName: 'Step 1: Reference Boundary Initialization & MDIS Filter',
    cppFunction: 'TComPrediction::initIntraPatternChType(tuRecurseWithPU, compID, bUseFilter)',
    cppFile: 'source/Lib/TLibCommon/TComPrediction.cpp',
    standardRef: 'ITU-T H.265 Section 8.4.4.2.2 & 8.4.4.2.3',
    mathFormula: 'MDIS 3-Tap Filter:  p\'[i] = (p[i-1] + 2·p[i] + p[i+1] + 2) >> 2',
    explanation: 'Extracts 2N+1 Top and 2N+1 Left boundary samples from reconstructed neighbor blocks. Evaluates Mode-Dependent Intra Smoothing (MDIS) threshold to decide whether to apply the 3-tap lowpass filter [1, 2, 1]/4.',
    snippet: HM_INTRA_PREDICTION_SNIPPET
  },
  2: {
    stageName: 'Step 2: Rough Mode Decision (RMD) 35-Mode Funnel',
    cppFunction: 'TEncSearch::estIntraPredLumaQT() — FOR EACH OF 35 MODES',
    cppFile: 'source/Lib/TLibEncoder/TEncSearch.cpp',
    standardRef: 'ITU-T H.265 Section 8.4.2 (RMD Fast Search)',
    mathFormula: 'RMD Cost:  J_RMD = SATD(Org, Pred) + λ_Had · R_mode',
    explanation: 'Iterates through all 35 HEVC Intra modes (Planar 0, DC 1, Angular 2–34). Computes directional predictions with 1/32 fractional sample precision and evaluates Hadamard transform SATD cost. Sorts modes ascendingly to prune down to Top K candidates.',
    snippet: HM_EST_INTRAPRED_LUMA_SNIPPET
  },
  3: {
    stageName: 'Step 3: Candidate Selection & Most Probable Modes (MPM)',
    cppFunction: 'TComDataCU::getIntraDirPredictor(partIdx, uiPreds, COMPONENT_Y, &iMode)',
    cppFile: 'source/Lib/TLibCommon/TComDataCU.cpp',
    standardRef: 'ITU-T H.265 Section 8.4.2 (MPM Derivation)',
    mathFormula: 'Candidate Pool:  Candidates = Top_K(RMD) ∪ { MPM_0, MPM_1, MPM_2 }',
    explanation: 'Prunes RMD modes to Top K (K=8 for 4×4/8×8; K=3 for 16×16/32×32). Derives exactly 3 Most Probable Modes (MPM) from Left and Above neighbor blocks. Merges MPMs into the candidate list to guarantee high probability modes are tested.',
    snippet: HM_EST_INTRAPRED_LUMA_SNIPPET
  },
  4: {
    stageName: 'Step 4: Full RDO Phase & QuadTree TU Recursion',
    cppFunction: 'TEncSearch::xRecurIntraCodingLumaQT(pcOrg, pcPred, pcResi, ...)',
    cppFile: 'source/Lib/TLibEncoder/TEncSearch.cpp & TComTrQuant.cpp',
    standardRef: 'ITU-T H.265 Section 8.4.4 / 8.7 (RDO & Transform)',
    mathFormula: 'True RD Cost:  J_RDO = D_SSE(Org, Reco) + λ_mode · R_CABAC   |   S\' = Clip3(0, 255, P + R\')',
    explanation: 'Executes full forward Transform (DST-VII for 4×4 Luma, DCT-II otherwise) and Quantization. Then computes Inverse Quantization & Inverse Transform to produce reconstructed residual R\'. Local reconstruction S\' is immediately updated into the reference perimeter for subsequent sub-TUs.',
    snippet: HM_RECUR_INTRA_CODING_SNIPPET
  },
  5: {
    stageName: 'Step 5: Chroma Intra Search & Winner Commitment',
    cppFunction: 'TEncSearch::estIntraPredChromaQT() & TEncCu::xCheckBestMode()',
    cppFile: 'source/Lib/TLibEncoder/TEncSearch.cpp & TEncCu.cpp',
    standardRef: 'ITU-T H.265 Section 8.4.3 (Chroma Prediction)',
    mathFormula: 'Chroma Candidates:  { Planar, Ver, Hor, DC, DM_CHROMA } \\ { BestLuma } ∪ { 34 }',
    explanation: 'Evaluates 5 Chroma candidate modes. If Best Luma Mode duplicates a base mode, HM substitutes Angular 34. Runs full RDO and commits the winning Luma and Chroma modes to the bitstream via xCheckBestMode.',
    snippet: HM_CHROMA_INTRA_SNIPPET
  }
};

/**
 * IntraPipelineInspector
 * Context HUD displaying exact HM-16.0 C++ signatures, mathematical formulas,
 * and live execution metrics for the active pipeline step.
 */
export default function IntraPipelineInspector({
  activeStep = 1,
  pipelineData = null,
  cuSize = 8,
  ctuX = 0,
  ctuY = 0,
  onOpenHmSnippet = null
}) {
  const config = STAGE_INSPECTOR_CONFIG[activeStep] || STAGE_INSPECTOR_CONFIG[1];

  const bestLuma = pipelineData?.best_luma_mode ?? 0;
  const winnerCost = pipelineData?.winner_cost ?? 0;
  const kThreshold = pipelineData?.step3_candidates?.k_threshold ?? (cuSize <= 8 ? 8 : 3);
  const mpmList = pipelineData?.step3_candidates?.mpm_modes ?? [0, 1, 26];

  return (
    <div className="apple-card" style={{
      padding: '0.85rem 1rem',
      marginBottom: '1rem',
      background: 'var(--apple-canvas)',
      border: '1px solid var(--apple-hairline)'
    }}>
      {/* Top Banner: Function Signature & Code Modal Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem',
        marginBottom: '0.65rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.80rem',
            fontWeight: 800,
            color: 'var(--apple-label)',
            fontFamily: 'JetBrains Mono'
          }}>
            {config.stageName}
          </span>
          <span style={{
            fontSize: '0.68rem',
            color: 'var(--apple-label-secondary)',
            fontFamily: 'JetBrains Mono'
          }}>
            [{config.standardRef}]
          </span>
        </div>

        <Button
          variant="gray"
          size="small"
          onClick={() => onOpenHmSnippet && onOpenHmSnippet(config.snippet)}
          title="Inspect bit-exact HM-16.0 C++ implementation"
        >
          &lt;&gt; Show HM C++ Code
        </Button>
      </div>

      {/* C++ Function Call Signature */}
      <div style={{
        background: 'var(--apple-surface, #F5F5F7)',
        padding: '0.45rem 0.75rem',
        borderRadius: '3px',
        border: '1px solid var(--apple-hairline)',
        fontFamily: 'JetBrains Mono',
        fontSize: '0.74rem',
        color: 'var(--apple-blue)',
        fontWeight: 600,
        marginBottom: '0.65rem',
        overflowX: 'auto',
        whiteSpace: 'nowrap'
      }}>
        <span>{config.cppFunction}</span>
        <span style={{ color: 'var(--apple-label-tertiary)', marginLeft: '0.75rem', fontSize: '0.68rem' }}>
          // {config.cppFile}
        </span>
      </div>

      {/* Mathematical Formula Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem',
        padding: '0.55rem 0.75rem',
        background: 'var(--apple-blue-subtle, rgba(0, 122, 255, 0.08))',
        border: '1px solid rgba(0, 122, 255, 0.2)',
        borderRadius: '3px',
        marginBottom: '0.65rem'
      }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.74rem', fontWeight: 700, color: 'var(--apple-label)' }}>
          {config.mathFormula}
        </div>
      </div>

      {/* Explanatory Context Text */}
      <div style={{
        fontSize: '0.72rem',
        color: 'var(--apple-label-secondary)',
        lineHeight: 1.45,
        marginBottom: '0.65rem'
      }}>
        {config.explanation}
      </div>

      {/* Step Metric Badges Strip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem',
        fontSize: '0.70rem',
        fontFamily: 'JetBrains Mono',
        paddingTop: '0.5rem',
        borderTop: '1px solid var(--apple-hairline)'
      }}>
        <span style={{ color: 'var(--apple-label-secondary)' }}>BLOCK:</span>
        <strong style={{ color: 'var(--apple-label)' }}>CTU ({ctuX}, {ctuY}) • {cuSize}×{cuSize}</strong>

        <span style={{ color: 'var(--apple-hairline)', margin: '0 0.2rem' }}>|</span>

        {activeStep === 1 && (
          <>
            <span style={{ color: 'var(--apple-label-secondary)' }}>REF SAMPLES:</span>
            <strong style={{ color: '#10B981' }}>2N + 1 = {2 * cuSize + 1} per axis</strong>
            <span style={{ color: 'var(--apple-hairline)', margin: '0 0.2rem' }}>|</span>
            <span style={{ color: 'var(--apple-label-secondary)' }}>MDIS FILTER:</span>
            <strong style={{ color: 'var(--apple-blue)' }}>[1, 2, 1]/4 Lowpass</strong>
          </>
        )}

        {activeStep === 2 && (
          <>
            <span style={{ color: 'var(--apple-label-secondary)' }}>MODES TESTED:</span>
            <strong style={{ color: 'var(--apple-blue)' }}>35 Modes (0..34)</strong>
            <span style={{ color: 'var(--apple-hairline)', margin: '0 0.2rem' }}>|</span>
            <span style={{ color: 'var(--apple-label-secondary)' }}>TOP K TARGET:</span>
            <strong style={{ color: 'var(--system-orange, #FF9500)' }}>Top {kThreshold} Candidates</strong>
          </>
        )}

        {activeStep === 3 && (
          <>
            <span style={{ color: 'var(--apple-label-secondary)' }}>3 MPM MODES:</span>
            <strong style={{ color: 'var(--system-purple, #AF52DE)' }}>[{mpmList.join(', ')}]</strong>
            <span style={{ color: 'var(--apple-hairline)', margin: '0 0.2rem' }}>|</span>
            <span style={{ color: 'var(--apple-label-secondary)' }}>TOTAL RDO POOL:</span>
            <strong style={{ color: 'var(--apple-label)' }}>
              {pipelineData?.step3_candidates?.candidate_modes?.length ?? kThreshold} modes
            </strong>
          </>
        )}

        {activeStep === 4 && (
          <>
            <span style={{ color: 'var(--apple-label-secondary)' }}>CORE TRANSFORM:</span>
            <strong style={{ color: 'var(--apple-blue)' }}>{cuSize === 4 ? 'DST-VII (4×4)' : 'DCT-II'}</strong>
            <span style={{ color: 'var(--apple-hairline)', margin: '0 0.2rem' }}>|</span>
            <span style={{ color: 'var(--apple-label-secondary)' }}>BEST LUMA:</span>
            <strong style={{ color: 'var(--system-green)' }}>Mode {bestLuma} (J = {winnerCost})</strong>
          </>
        )}

        {activeStep === 5 && (
          <>
            <span style={{ color: 'var(--apple-label-secondary)' }}>CHROMA CANDIDATES:</span>
            <strong style={{ color: 'var(--apple-label)' }}>5 Modes</strong>
            <span style={{ color: 'var(--apple-hairline)', margin: '0 0.2rem' }}>|</span>
            <span style={{ color: 'var(--apple-label-secondary)' }}>FINAL WINNER:</span>
            <strong style={{ color: 'var(--system-green)' }}>Mode {bestLuma}</strong>
          </>
        )}
      </div>
    </div>
  );
}
