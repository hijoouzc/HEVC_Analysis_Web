import React, { useState, useMemo } from 'react';
import { Badge, Button } from '../apple';
import { INTRA_PRED_ANGLES } from '../../utils/intraTraceUtils';
import { getIntraModeInfo } from '../../utils/colorUtils';

/**
 * Step2RmdFunnelView
 * Visualizes Rough Mode Decision (RMD) 35-Mode Funnel and Pruning Threshold.
 * Adheres to HM-18.0 TEncSearch::estIntraPredLumaQT and industrial analyzers (Elecard, Intel VPA).
 * 100% Click-Only: zero hover flutter, zero hover listeners.
 */
export default function Step2RmdFunnelView({
  rmdModes = [],
  kThreshold = 8,
  selectedMode = 0,
  onSelectMode = null,
  N = 8,
  mpmModes = [0, 1, 26]
}) {
  const [sortBy, setSortBy] = useState('cost'); // 'cost' (Rank #1 -> #35) | 'mode' (0 -> 34)
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'top_k'
  const [inspectedMode, setInspectedMode] = useState(selectedMode);

  // Normalize modes list into full 35-mode dataset
  const normalizedModes = useMemo(() => {
    let rawList = [];
    if (Array.isArray(rmdModes) && rmdModes.length > 0) {
      rawList = [...rmdModes];
    } else {
      // Synthesize fallback 35 modes if no backend trace is supplied
      rawList = Array.from({ length: 35 }, (_, m) => {
        const cost = 120 + Math.abs(m - selectedMode) * 16.5;
        return {
          mode: m,
          cost,
          satd_cost: cost,
          is_mpm: mpmModes.includes(m)
        };
      });
    }

    // Ensure all 35 modes exist
    const mapByMode = new Map();
    rawList.forEach(item => {
      if (item && item.mode !== undefined) {
        mapByMode.set(item.mode, item);
      }
    });

    for (let m = 0; m < 35; m++) {
      if (!mapByMode.has(m)) {
        const cost = 120 + Math.abs(m - selectedMode) * 16.5;
        mapByMode.set(m, {
          mode: m,
          cost,
          satd_cost: cost,
          is_mpm: mpmModes.includes(m)
        });
      }
    }

    const fullList = Array.from(mapByMode.values());

    // Sort by cost ascending to compute rank
    fullList.sort((a, b) => (a.cost ?? a.satd_cost ?? Infinity) - (b.cost ?? b.satd_cost ?? Infinity));

    return fullList.map((item, idx) => {
      const mode = item.mode;
      const info = getIntraModeInfo(mode);
      const cost = Number(item.cost ?? item.satd_cost ?? 0);
      const isTopK = idx < kThreshold;
      const isMpm = item.is_mpm ?? mpmModes.includes(mode);
      const angle = INTRA_PRED_ANGLES[mode] ?? 0;

      return {
        mode,
        name: info.name,
        type: info.type,
        cost,
        rank: idx + 1,
        isTopK,
        isMpm,
        angle
      };
    });
  }, [rmdModes, kThreshold, selectedMode, mpmModes]);

  // Sorted and filtered list for rendering
  const displayModes = useMemo(() => {
    let list = [...normalizedModes];
    if (sortBy === 'mode') {
      list.sort((a, b) => a.mode - b.mode);
    } else {
      list.sort((a, b) => a.rank - b.rank);
    }

    if (filterMode === 'top_k') {
      list = list.filter(m => m.isTopK);
    }
    return list;
  }, [normalizedModes, sortBy, filterMode]);

  // Max and min costs for bar scale
  const minCost = normalizedModes[0]?.cost ?? 100;
  const maxCost = normalizedModes[normalizedModes.length - 1]?.cost ?? 500;
  const costSpread = Math.max(1, maxCost - minCost);

  // Details for currently clicked inspected mode
  const currentDetail = useMemo(() => {
    const found = normalizedModes.find(m => m.mode === inspectedMode);
    return found || normalizedModes[0] || { mode: 0, name: 'Planar', rank: 1, cost: 100, isTopK: true, isMpm: true, angle: 0 };
  }, [normalizedModes, inspectedMode]);

  const pruneRate = (((35 - kThreshold) / 35) * 100).toFixed(1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {/* 1. Funnel Toolbar & Pruning Efficiency Metrics */}
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
            RMD 35-MODE FUNNEL ({N}×{N})
          </span>
          <Badge variant="blue">
            Top {kThreshold} of 35 Selected ({pruneRate}% Pruned)
          </Badge>
          <span style={{ fontSize: '0.70rem', color: 'var(--apple-label-secondary)', fontFamily: 'JetBrains Mono' }}>
            [Hadamard SATD + λ·R]
          </span>
        </div>

        {/* View Controls */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <Button
            variant={sortBy === 'cost' ? 'filled' : 'gray'}
            size="small"
            onClick={() => setSortBy('cost')}
            title="Sort by RMD Hadamard Cost (Ascending Rank #1 to #35)"
          >
            Sort by Rank (Funnel)
          </Button>
          <Button
            variant={sortBy === 'mode' ? 'filled' : 'gray'}
            size="small"
            onClick={() => setSortBy('mode')}
            title="Sort by Mode Number (0 to 34)"
          >
            Sort by Mode ID
          </Button>
          <Button
            variant={filterMode === 'top_k' ? 'tinted' : 'gray'}
            size="small"
            onClick={() => setFilterMode(prev => prev === 'top_k' ? 'all' : 'top_k')}
            title="Toggle between all 35 modes and Top K pruned list"
          >
            {filterMode === 'top_k' ? 'Top K Only' : 'All 35 Modes'}
          </Button>
        </div>
      </div>

      {/* 2. Funnel Visualizer Bar List (100% Click-Only) */}
      <div style={{
        background: 'var(--apple-surface, #F5F5F7)',
        border: '1px solid var(--apple-hairline)',
        borderRadius: '6px',
        padding: '0.85rem',
        height: '380px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        boxSizing: 'border-box'
      }}>
        {displayModes.map((item, idx) => {
          const isInspected = item.mode === inspectedMode;
          const isPassed = item.isTopK;
          const barPercent = Math.max(8, Math.min(100, Math.round(((item.cost - minCost) / costSpread) * 100)));

          // Show pruning threshold divider line when sorting by rank
          const showCutoffLine = sortBy === 'cost' && filterMode === 'all' && idx === kThreshold;

          return (
            <React.Fragment key={`rmd-mode-${item.mode}`}>
              {showCutoffLine && (
                <div style={{
                  margin: '0.45rem 0',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '4px',
                  background: 'rgba(255, 149, 0, 0.08)',
                  border: '1px solid rgba(255, 149, 0, 0.4)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.68rem',
                  fontFamily: 'JetBrains Mono',
                  color: 'var(--system-orange, #FF9500)',
                  fontWeight: 700
                }}>
                  <span>▼ TOP {kThreshold} PRUNING THRESHOLD CUTOFF</span>
                  <span>Modes below are BYPASSED from Full RDO to save 80%+ CPU cycles</span>
                </div>
              )}

              <div
                onClick={() => setInspectedMode(item.mode)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: isInspected
                    ? 'var(--apple-blue-subtle, rgba(0, 122, 255, 0.14))'
                    : isPassed
                    ? 'var(--apple-canvas)'
                    : 'rgba(0, 0, 0, 0.02)',
                  border: isInspected
                    ? '1.5px solid var(--apple-blue, #007AFF)'
                    : '1px solid var(--apple-hairline)',
                  opacity: isPassed || isInspected ? 1 : 0.65,
                  transition: 'none'
                }}
              >
                {/* Rank Badge */}
                <span style={{
                  fontSize: '0.66rem',
                  fontWeight: 800,
                  fontFamily: 'JetBrains Mono',
                  width: '28px',
                  color: isPassed ? 'var(--apple-blue)' : 'var(--apple-label-tertiary)'
                }}>
                  #{item.rank}
                </span>

                {/* Mode Identifier & MPM Tag */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  width: '120px',
                  fontFamily: 'JetBrains Mono',
                  fontSize: '0.72rem'
                }}>
                  <strong style={{ color: 'var(--apple-label)' }}>M{item.mode}</strong>
                  <span style={{
                    fontSize: '0.64rem',
                    color: 'var(--apple-label-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {item.name}
                  </span>
                  {item.isMpm && (
                    <span style={{
                      fontSize: '0.58rem',
                      fontWeight: 800,
                      padding: '1px 3px',
                      borderRadius: '2px',
                      background: 'rgba(175, 82, 222, 0.16)',
                      color: 'var(--system-purple, #AF52DE)'
                    }}>
                      MPM
                    </span>
                  )}
                </div>

                {/* Relative Cost Funnel Bar */}
                <div style={{
                  flex: 1,
                  height: '14px',
                  background: 'rgba(0, 0, 0, 0.05)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <div style={{
                    width: `${barPercent}%`,
                    height: '100%',
                    background: isInspected
                      ? 'var(--apple-blue, #007AFF)'
                      : isPassed
                      ? 'rgba(0, 122, 255, 0.7)'
                      : 'rgba(142, 142, 147, 0.5)',
                    borderRadius: '2px'
                  }} />
                </div>

                {/* Numerical SATD Cost */}
                <span style={{
                  width: '75px',
                  textAlign: 'right',
                  fontFamily: 'JetBrains Mono',
                  fontSize: '0.70rem',
                  fontWeight: 700,
                  color: isPassed ? 'var(--apple-label)' : 'var(--apple-label-tertiary)'
                }}>
                  {item.cost.toFixed(1)}
                </span>

                {/* Selection Status Tag */}
                <span style={{
                  fontSize: '0.62rem',
                  fontFamily: 'JetBrains Mono',
                  fontWeight: 700,
                  width: '65px',
                  textAlign: 'right',
                  color: isPassed ? 'var(--system-green, #34C759)' : 'var(--apple-label-tertiary)'
                }}>
                  {isPassed ? 'TOP K' : 'PRUNED'}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* 3. Inspected Mode Details Card & Angular Projection Preview */}
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
        {/* Left: Metadata details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.82rem',
              fontWeight: 800,
              fontFamily: 'JetBrains Mono',
              color: 'var(--apple-label)'
            }}>
              MODE {currentDetail.mode}: {currentDetail.name.toUpperCase()}
            </span>
            <Badge variant={currentDetail.isTopK ? 'green' : 'gray'}>
              {currentDetail.isTopK ? 'QUALIFIED (TOP K)' : 'PRUNED BY RMD'}
            </Badge>
            {currentDetail.isMpm && (
              <Badge variant="purple">MOST PROBABLE (MPM)</Badge>
            )}
          </div>

          <div style={{
            fontSize: '0.70rem',
            fontFamily: 'JetBrains Mono',
            color: 'var(--apple-label-secondary)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginTop: '0.2rem'
          }}>
            <span>Rank: <strong>#{currentDetail.rank} of 35</strong></span>
            <span>RMD Cost: <strong>{currentDetail.cost.toFixed(2)}</strong></span>
            <span>Angle (Δ): <strong>{currentDetail.angle}/32 pel</strong></span>
          </div>

          <div style={{ fontSize: '0.68rem', color: 'var(--apple-label-secondary)', marginTop: '0.2rem' }}>
            {currentDetail.type} • {currentDetail.isTopK
              ? 'Mode satisfies SATD threshold and advances to Full RDO transform stage.'
              : 'Mode cost exceeds Top K cutoff and is skipped during recursive QuadTree evaluation.'}
          </div>
        </div>

        {/* Right: Angular Direction Mini Projection Vector & Apply Button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '0.85rem',
          flexWrap: 'wrap'
        }}>
          {/* Mini directional projection visual */}
          <div style={{
            width: '64px',
            height: '64px',
            border: '1px solid var(--apple-hairline)',
            borderRadius: '4px',
            background: 'var(--apple-canvas)',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="60" height="60" viewBox="0 0 60 60">
              {/* Outer block square */}
              <rect x="8" y="8" width="44" height="44" fill="none" stroke="var(--apple-hairline)" strokeWidth="1" />
              {/* Direction arrow line */}
              {currentDetail.mode === 0 ? (
                // Planar indicator (Omnidirectional center)
                <circle cx="30" cy="30" r="10" fill="none" stroke="var(--apple-blue)" strokeWidth="1.5" strokeDasharray="3 2" />
              ) : currentDetail.mode === 1 ? (
                // DC indicator (Uniform flat)
                <text x="30" y="34" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fill="var(--apple-label)" fontWeight="700">DC</text>
              ) : (
                // Angular mode ray line
                (() => {
                  const rad = ((currentDetail.mode - 26) * 5.625 * Math.PI) / 180;
                  const x2 = 30 + 20 * Math.sin(rad);
                  const y2 = 30 - 20 * Math.cos(rad);
                  return (
                    <g>
                      <line x1="30" y1="30" x2={x2} y2={y2} stroke="var(--apple-blue)" strokeWidth="2" />
                      <circle cx={x2} cy={y2} r="2.5" fill="var(--apple-blue)" />
                      <circle cx="30" cy="30" r="2" fill="var(--apple-label)" />
                    </g>
                  );
                })()
              )}
            </svg>
          </div>

          {/* Action button */}
          {onSelectMode && (
            <Button
              variant="tinted"
              size="small"
              onClick={() => onSelectMode(currentDetail.mode)}
              title="Apply this mode as active candidate for PU pixel inspection"
            >
              Apply Mode {currentDetail.mode} →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
