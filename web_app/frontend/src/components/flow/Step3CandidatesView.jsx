import React, { useState, useMemo } from 'react';
import { Badge, Button } from '../apple';
import { INTRA_PRED_ANGLES } from '../../utils/intraTraceUtils';
import { getIntraModeInfo } from '../../utils/colorUtils';

/**
 * Step3CandidatesView
 * Visualizes HEVC MPM (Most Probable Modes) Derivation and Candidate Pool Pruning.
 * Adheres strictly to ITU-T H.265 Section 8.4.2 & HM TComDataCU::getIntraDirPredictor.
 * 100% Click-Only: zero hover flutter, zero hover listeners.
 */
export default function Step3CandidatesView({
  candidatesData = null,
  kThreshold = 8,
  selectedMode = 0,
  onSelectMode = null,
  N = 8
}) {
  const [inspectedCandidate, setInspectedCandidate] = useState(selectedMode);

  // Extract neighbor modes and derivation info
  const leftModeA = candidatesData?.left_mode_a ?? candidatesData?.derivation?.left_mode ?? 1;
  const aboveModeB = candidatesData?.above_mode_b ?? candidatesData?.derivation?.above_mode ?? 26;
  const mpmList = useMemo(() => {
    if (candidatesData?.mpm_modes && candidatesData.mpm_modes.length === 3) {
      return candidatesData.mpm_modes;
    }
    // Fallback H.265 Section 8.4.2 derivation
    const A = leftModeA;
    const B = aboveModeB;
    if (A === B) {
      if (A > 1) {
        return [A, ((A + 29) % 32) + 2, ((A - 1) % 32) + 2];
      }
      return [0, 1, 26];
    }
    const cand = [A, B, 0];
    if (A !== 0 && B !== 0) {
      cand[2] = 0;
    } else {
      cand[2] = (A + B < 2) ? 26 : 1;
    }
    return cand;
  }, [candidatesData, leftModeA, aboveModeB]);

  // Derivation case explanation
  const derivationRuleExplanation = useMemo(() => {
    if (leftModeA === aboveModeB) {
      if (leftModeA > 1) {
        return `Case A == B (Angular ${leftModeA}): MPM = [${leftModeA}, ((A+29)%32)+2, ((A-1)%32)+2] ➔ Mode ${leftModeA} and adjacent directions ±1.`;
      }
      return `Case A == B (Non-Angular): MPM defaults to [Planar (0), DC (1), Vertical (26)].`;
    }
    if (leftModeA !== 0 && aboveModeB !== 0) {
      return `Case A != B (Both non-zero): MPM = [${leftModeA}, ${aboveModeB}, Planar (0)].`;
    }
    const third = (leftModeA + aboveModeB < 2) ? 26 : 1;
    return `Case A != B (One is Planar): MPM = [${leftModeA}, ${aboveModeB}, Mode ${third}].`;
  }, [leftModeA, aboveModeB]);

  // Unified candidate pool
  const candidatePool = useMemo(() => {
    let topK = candidatesData?.top_k_modes || [];
    if (!topK || topK.length === 0) {
      topK = [0, 1, 26, 10, 2, 18, 34, 25].slice(0, kThreshold);
    }

    const unifiedSet = new Set([...topK, ...mpmList]);
    const unifiedArray = Array.from(unifiedSet);

    return unifiedArray.map((m, idx) => {
      const isTopK = topK.includes(m);
      const isMpm = mpmList.includes(m);
      const mpmIndex = mpmList.indexOf(m);
      const info = getIntraModeInfo(m);
      const angle = INTRA_PRED_ANGLES[m] ?? 0;

      let sourceTag = 'Top K (RMD)';
      if (isTopK && isMpm) sourceTag = 'Top K + MPM';
      else if (!isTopK && isMpm) sourceTag = 'MPM Addition';

      return {
        mode: m,
        rank: idx + 1,
        name: info.name,
        type: info.type,
        isTopK,
        isMpm,
        mpmIndex,
        sourceTag,
        angle
      };
    });
  }, [candidatesData, kThreshold, mpmList]);

  // Active inspected candidate
  const currentDetail = useMemo(() => {
    const found = candidatePool.find(c => c.mode === inspectedCandidate);
    return found || candidatePool[0] || { mode: 0, name: 'Planar', rank: 1, isTopK: true, isMpm: true, angle: 0 };
  }, [candidatePool, inspectedCandidate]);

  const leftInfo = getIntraModeInfo(leftModeA);
  const aboveInfo = getIntraModeInfo(aboveModeB);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {/* 1. Header Toolbar & Candidate Summary */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        paddingBottom: '0.65rem',
        borderBottom: '1px solid var(--apple-hairline)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.80rem',
            fontWeight: 800,
            fontFamily: 'JetBrains Mono',
            color: 'var(--apple-label)'
          }}>
            CANDIDATE SELECTION &amp; MPM POOL ({N}×{N})
          </span>
          <Badge variant="purple">
            Top {kThreshold} (RMD) ∪ 3 MPMs = {candidatePool.length} Candidates
          </Badge>
          <span style={{ fontSize: '0.70rem', color: 'var(--apple-label-secondary)', fontFamily: 'JetBrains Mono' }}>
            [H.265 Section 8.4.2]
          </span>
        </div>

        <div style={{ fontSize: '0.70rem', color: 'var(--apple-label-secondary)', fontFamily: 'JetBrains Mono' }}>
          CABAC Coding: <strong>mpm_flag=1</strong> (1-2 bits) vs <strong>mpm_flag=0</strong> (5 bits)
        </div>
      </div>

      {/* 2. Spatial Neighbors & MPM Derivation Architecture Diagram */}
      <div style={{
        background: 'var(--apple-surface, #F5F5F7)',
        border: '1px solid var(--apple-hairline)',
        borderRadius: '6px',
        padding: '0.85rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '0.85rem',
        alignItems: 'center'
      }}>
        {/* Left Sub-block: Spatial Neighbor Context */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div style={{
            fontSize: '0.72rem',
            fontWeight: 800,
            fontFamily: 'JetBrains Mono',
            color: 'var(--apple-label)'
          }}>
            SPATIAL NEIGHBOR CONTEXT (CU BOUNDARY)
          </div>

          {/* Mini Spatial Layout Box */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '80px 100px',
            gridTemplateRows: '50px 50px',
            gap: '4px',
            fontFamily: 'JetBrains Mono',
            fontSize: '0.68rem',
            marginTop: '0.2rem'
          }}>
            {/* Top-Left Empty Corner */}
            <div style={{
              background: 'transparent',
              border: '1px dashed var(--apple-hairline)',
              borderRadius: '3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--apple-label-tertiary)',
              fontSize: '0.60rem'
            }}>
              [Corner]
            </div>

            {/* Above Neighbor B */}
            <div style={{
              background: 'rgba(0, 122, 255, 0.08)',
              border: '1.5px solid var(--apple-blue)',
              borderRadius: '3px',
              padding: '4px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '0.60rem', fontWeight: 800, color: 'var(--apple-blue)' }}>
                ABOVE (B)
              </span>
              <strong style={{ color: 'var(--apple-label)', fontSize: '0.70rem' }}>
                Mode {aboveModeB}
              </strong>
              <span style={{ fontSize: '0.58rem', color: 'var(--apple-label-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {aboveInfo.name}
              </span>
            </div>

            {/* Left Neighbor A */}
            <div style={{
              background: 'rgba(0, 122, 255, 0.08)',
              border: '1.5px solid var(--apple-blue)',
              borderRadius: '3px',
              padding: '4px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '0.60rem', fontWeight: 800, color: 'var(--apple-blue)' }}>
                LEFT (A)
              </span>
              <strong style={{ color: 'var(--apple-label)', fontSize: '0.70rem' }}>
                Mode {leftModeA}
              </strong>
              <span style={{ fontSize: '0.58rem', color: 'var(--apple-label-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {leftInfo.name}
              </span>
            </div>

            {/* Target Coding Unit */}
            <div style={{
              background: 'var(--apple-canvas)',
              border: '2px solid var(--apple-label)',
              borderRadius: '3px',
              padding: '4px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '0.60rem', fontWeight: 800, color: 'var(--apple-label-secondary)' }}>
                TARGET CU
              </span>
              <strong style={{ color: 'var(--apple-label)', fontSize: '0.72rem' }}>
                {N}×{N} Block
              </strong>
            </div>
          </div>
        </div>

        {/* Right Sub-block: 3 Derived MPMs & Rule Explanation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div style={{
            fontSize: '0.72rem',
            fontWeight: 800,
            fontFamily: 'JetBrains Mono',
            color: 'var(--apple-label)'
          }}>
            3 MOST PROBABLE MODES (MPM ARRAY)
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {mpmList.map((m, idx) => {
              const info = getIntraModeInfo(m);
              return (
                <div
                  key={`mpm-${idx}`}
                  onClick={() => setInspectedCandidate(m)}
                  style={{
                    flex: '1 1 80px',
                    background: 'var(--apple-canvas)',
                    border: '1.5px solid var(--system-purple, #AF52DE)',
                    borderRadius: '4px',
                    padding: '0.45rem 0.6rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}
                >
                  <span style={{
                    fontSize: '0.60rem',
                    fontWeight: 800,
                    fontFamily: 'JetBrains Mono',
                    color: 'var(--system-purple, #AF52DE)'
                  }}>
                    MPM [{idx}]
                  </span>
                  <strong style={{ fontSize: '0.82rem', fontFamily: 'JetBrains Mono', color: 'var(--apple-label)' }}>
                    Mode {m}
                  </strong>
                  <span style={{ fontSize: '0.64rem', color: 'var(--apple-label-secondary)' }}>
                    {info.name}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{
            fontSize: '0.68rem',
            fontFamily: 'JetBrains Mono',
            color: 'var(--apple-label-secondary)',
            background: 'var(--apple-canvas)',
            padding: '0.45rem 0.65rem',
            borderRadius: '4px',
            border: '1px solid var(--apple-hairline)',
            lineHeight: 1.45,
            marginTop: '0.2rem'
          }}>
            <strong style={{ color: 'var(--system-purple, #AF52DE)' }}>Normative Derivation Rule: </strong>
            {derivationRuleExplanation}
          </div>
        </div>
      </div>

      {/* 3. Candidate Pool Unified Table */}
      <div style={{
        background: 'var(--apple-surface, #F5F5F7)',
        border: '1px solid var(--apple-hairline)',
        borderRadius: '6px',
        padding: '0.85rem',
        overflowX: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        <div style={{
          fontSize: '0.72rem',
          fontWeight: 800,
          fontFamily: 'JetBrains Mono',
          color: 'var(--apple-label)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>UNIFIED CANDIDATE POOL FOR FULL RDO (Click row to inspect)</span>
          <span style={{ color: 'var(--apple-label-secondary)', fontSize: '0.68rem' }}>
            Total: {candidatePool.length} Modes
          </span>
        </div>

        {/* Table Rows */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 80px 140px 120px 80px 1fr',
          gap: '4px',
          fontFamily: 'JetBrains Mono',
          fontSize: '0.70rem',
          alignItems: 'center',
          userSelect: 'none'
        }}>
          {/* Table Header */}
          <div style={{ color: 'var(--apple-label-tertiary)', fontWeight: 800 }}>#</div>
          <div style={{ color: 'var(--apple-label-tertiary)', fontWeight: 800 }}>MODE</div>
          <div style={{ color: 'var(--apple-label-tertiary)', fontWeight: 800 }}>NAME</div>
          <div style={{ color: 'var(--apple-label-tertiary)', fontWeight: 800 }}>SOURCE</div>
          <div style={{ color: 'var(--apple-label-tertiary)', fontWeight: 800 }}>ANGLE (Δ)</div>
          <div style={{ color: 'var(--apple-label-tertiary)', fontWeight: 800 }}>RDO EVALUATION ACTION</div>

          {/* Table Rows */}
          {candidatePool.map((cand) => {
            const isInspected = cand.mode === inspectedCandidate;
            return (
              <React.Fragment key={`cand-row-${cand.mode}`}>
                <div
                  onClick={() => setInspectedCandidate(cand.mode)}
                  style={{
                    gridColumn: '1 / -1',
                    display: 'grid',
                    gridTemplateColumns: '40px 80px 140px 120px 80px 1fr',
                    gap: '4px',
                    alignItems: 'center',
                    padding: '0.35rem 0.5rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: isInspected
                      ? 'var(--apple-blue-subtle, rgba(0, 122, 255, 0.12))'
                      : 'var(--apple-canvas)',
                    border: isInspected
                      ? '1.5px solid var(--apple-blue, #007AFF)'
                      : '1px solid var(--apple-hairline)'
                  }}
                >
                  <span style={{ fontWeight: 800, color: 'var(--apple-label-secondary)' }}>
                    {cand.rank}
                  </span>
                  <strong style={{ color: 'var(--apple-label)' }}>
                    Mode {cand.mode}
                  </strong>
                  <span style={{ color: 'var(--apple-label-secondary)' }}>
                    {cand.name}
                  </span>
                  <div>
                    <span style={{
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: '2px',
                      background: cand.sourceTag === 'MPM Addition'
                        ? 'rgba(175, 82, 222, 0.15)'
                        : cand.sourceTag === 'Top K + MPM'
                        ? 'rgba(0, 122, 255, 0.15)'
                        : 'rgba(0, 0, 0, 0.06)',
                      color: cand.sourceTag === 'MPM Addition'
                        ? 'var(--system-purple, #AF52DE)'
                        : cand.sourceTag === 'Top K + MPM'
                        ? 'var(--apple-blue)'
                        : 'var(--apple-label)'
                    }}>
                      {cand.sourceTag}
                    </span>
                  </div>
                  <span style={{ color: 'var(--apple-label-secondary)' }}>
                    {cand.angle}/32
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.66rem', color: 'var(--apple-label-secondary)' }}>
                      {cand.sourceTag === 'MPM Addition'
                        ? 'Rescued by MPM derivation for Full RDO test'
                        : 'Fast-filtered by RMD Hadamard ranking'}
                    </span>
                    {onSelectMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMode(cand.mode);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--apple-blue)',
                          fontSize: '0.68rem',
                          fontFamily: 'JetBrains Mono',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '2px 6px'
                        }}
                      >
                        Inspect Mode →
                      </button>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 4. Active Selected Candidate Summary Strip */}
      <div style={{
        background: 'var(--apple-surface, #F5F5F7)',
        border: '1px solid var(--apple-hairline)',
        borderRadius: '6px',
        padding: '0.75rem 0.85rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem',
        fontFamily: 'JetBrains Mono',
        fontSize: '0.72rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ color: 'var(--apple-label-secondary)' }}>SELECTED CANDIDATE:</span>
          <strong style={{ color: 'var(--apple-label)' }}>
            Mode {currentDetail.mode} ({currentDetail.name})
          </strong>
          <span style={{ color: 'var(--apple-hairline)' }}>|</span>
          <span style={{ color: 'var(--apple-blue)' }}>
            Source: {currentDetail.sourceTag}
          </span>
          <span style={{ color: 'var(--apple-hairline)' }}>|</span>
          <span style={{ color: 'var(--apple-label-secondary)' }}>
            Intra Angle: {currentDetail.angle}/32 pel
          </span>
        </div>

        {onSelectMode && (
          <Button
            variant="filled"
            size="small"
            onClick={() => onSelectMode(currentDetail.mode)}
            title="Inspect this candidate in Step 4 Full RDO block transformations"
          >
            Advance with Mode {currentDetail.mode} to Step 4 →
          </Button>
        )}
      </div>
    </div>
  );
}
