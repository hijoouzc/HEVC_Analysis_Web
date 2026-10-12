import React, { useState, useMemo } from 'react';
import { Badge, Button } from '../apple';

/**
 * Step1BoundaryInitView
 * Visualizes HEVC Reference Boundary Initialization and MDIS 3-Tap Lowpass Filter.
 * Strictly adheres to ITU-T H.265 Section 8.4.4.2.2 & 8.4.4.2.3.
 * 100% Click-Only: zero hover flutter, zero hover listeners.
 */
export default function Step1BoundaryInitView({
  refTopRaw = [],
  refLeftRaw = [],
  refTopFilt = [],
  refLeftFilt = [],
  N = 8,
  channel = 'Y',
  isMDISSmoothed = false,
  showValues = true,
  getSampleColor = null
}) {
  const [activeAxis, setActiveAxis] = useState('top'); // 'top' | 'left'
  const [selectedIdx, setSelectedIdx] = useState(1); // 0 (Corner), 1..N (Primary), N+1..2N (Extended)

  const reqLen = 2 * N + 1;
  const rawTop = useMemo(() => (refTopRaw && refTopRaw.length >= reqLen) ? refTopRaw.slice(0, reqLen) : Array(reqLen).fill(128), [refTopRaw, reqLen]);
  const rawLeft = useMemo(() => (refLeftRaw && refLeftRaw.length >= reqLen) ? refLeftRaw.slice(0, reqLen) : Array(reqLen).fill(128), [refLeftRaw, reqLen]);
  const filtTop = useMemo(() => (refTopFilt && refTopFilt.length >= reqLen) ? refTopFilt.slice(0, reqLen) : rawTop, [refTopFilt, reqLen, rawTop]);
  const filtLeft = useMemo(() => (refLeftFilt && refLeftFilt.length >= reqLen) ? refLeftFilt.slice(0, reqLen) : rawLeft, [refLeftFilt, reqLen, rawLeft]);

  const activeRaw = activeAxis === 'top' ? rawTop : rawLeft;
  const activeFilt = activeAxis === 'top' ? filtTop : filtLeft;

  // Selected sample 3-tap formula computation breakdown
  const formulaDetails = useMemo(() => {
    const idx = Math.max(0, Math.min(reqLen - 1, selectedIdx));
    const rawVal = activeRaw[idx];
    const filtVal = activeFilt[idx];
    const delta = filtVal - rawVal;

    let pPrev, pCurr, pNext, note, formulaStr;

    if (idx === 0) {
      // Corner sample [-1, -1]
      pPrev = rawLeft[1]; // Left top sample p[-1, 0]
      pCurr = rawTop[0];  // Corner sample p[-1, -1]
      pNext = rawTop[1];  // Top left sample p[0, -1]
      note = 'Corner [-1, -1] filter combines adjacent Left[0] and Top[0] samples';
      formulaStr = `p'[-1,-1] = (Left[0] + 2·Corner + Top[0] + 2) >> 2`;
    } else if (idx === reqLen - 1) {
      // Far-end extended sample (replicated per H.265 Section 8.4.4.2.2)
      pPrev = activeRaw[idx - 1];
      pCurr = activeRaw[idx];
      pNext = activeRaw[idx];
      note = 'Boundary end sample replicates edge value: p[2N] = p[2N-1]';
      formulaStr = `p'[${idx - 1}] = (p[${idx - 2}] + 2·p[${idx - 1}] + p[${idx - 1}] + 2) >> 2`;
    } else {
      pPrev = activeRaw[idx - 1];
      pCurr = activeRaw[idx];
      pNext = activeRaw[idx + 1];
      const relIdx = idx - 1;
      note = `Standard 3-tap symmetrical filter: [1, 2, 1] / 4`;
      formulaStr = `p'[${relIdx}] = (p[${relIdx - 1}] + 2·p[${relIdx}] + p[${relIdx + 1}] + 2) >> 2`;
    }

    const calcVal = (pPrev + 2 * pCurr + pNext + 2) >> 2;

    return {
      idx,
      rawVal,
      filtVal,
      delta,
      pPrev,
      pCurr,
      pNext,
      calcVal,
      note,
      formulaStr
    };
  }, [selectedIdx, reqLen, activeRaw, activeFilt, rawTop, rawLeft]);

  // Statistics
  const stats = useMemo(() => {
    let maxDiff = 0;
    let sumDiff = 0;
    for (let i = 0; i < reqLen; i++) {
      const d = Math.abs(activeFilt[i] - activeRaw[i]);
      if (d > maxDiff) maxDiff = d;
      sumDiff += d;
    }
    const avgDiff = (sumDiff / reqLen).toFixed(2);
    return { maxDiff, avgDiff };
  }, [activeRaw, activeFilt, reqLen]);

  const defaultGetSampleColor = (val) => {
    const v = Math.max(0, Math.min(255, Math.round(val)));
    return {
      bg: `rgb(${v}, ${v}, ${v})`,
      color: v < 128 ? '#FFFFFF' : '#000000'
    };
  };

  const colorFn = getSampleColor || defaultGetSampleColor;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {/* 1. Header Toolbar & Axis Selector */}
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
            1D BOUNDARY ARRAYS ({activeAxis.toUpperCase()} AXIS)
          </span>
          <Badge variant={isMDISSmoothed ? 'green' : 'gray'}>
            {isMDISSmoothed ? 'MDIS FILTER ACTIVE [1, 2, 1]/4' : 'MDIS BYPASSED (RAW REFS)'}
          </Badge>
          <span style={{ fontSize: '0.70rem', color: 'var(--apple-label-secondary)', fontFamily: 'JetBrains Mono' }}>
            [2N+1 = {reqLen} Samples]
          </span>
        </div>

        {/* Axis Switcher (Top vs Left) */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <Button
            variant={activeAxis === 'top' ? 'filled' : 'gray'}
            size="small"
            onClick={() => setActiveAxis('top')}
            title="Inspect Top Boundary reference array"
          >
            Top Edge p[x, -1]
          </Button>
          <Button
            variant={activeAxis === 'left' ? 'filled' : 'gray'}
            size="small"
            onClick={() => setActiveAxis('left')}
            title="Inspect Left Boundary reference array"
          >
            Left Edge p[-1, y]
          </Button>
        </div>
      </div>

      {/* 2. Dual-Track Pixel Strip: Unfiltered vs Filtered vs Delta */}
      <div style={{
        background: 'var(--apple-surface, #F5F5F7)',
        border: '1px solid var(--apple-hairline)',
        borderRadius: '6px',
        padding: '0.85rem',
        overflowX: 'auto',
        width: '100%'
      }}>
        <div style={{
          fontSize: '0.70rem',
          fontWeight: 700,
          fontFamily: 'JetBrains Mono',
          color: 'var(--apple-label-secondary)',
          marginBottom: '0.65rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>SAMPLE COMPARISON STRIP (Click any sample cell to inspect 3-tap formula)</span>
          <span>Max |Δ|: {stats.maxDiff} • Avg |Δ|: {stats.avgDiff}</span>
        </div>

        {/* Strip Grid Table */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `80px repeat(${reqLen}, minmax(28px, 1fr))`,
          gap: '2px',
          alignItems: 'center',
          fontFamily: 'JetBrains Mono',
          fontSize: '0.68rem',
          userSelect: 'none'
        }}>
          {/* Header row: Index Labels */}
          <div style={{ color: 'var(--apple-label-secondary)', fontWeight: 800, padding: '2px' }}>
            INDEX:
          </div>
          {Array.from({ length: reqLen }, (_, i) => {
            const isCorner = i === 0;
            const isExtended = i > N;
            const isSelected = i === selectedIdx;
            const label = isCorner ? 'C(-1)' : `${i - 1}`;
            return (
              <div
                key={`hdr-${i}`}
                onClick={() => setSelectedIdx(i)}
                style={{
                  textAlign: 'center',
                  padding: '2px 0',
                  fontWeight: isSelected ? 800 : 600,
                  color: isSelected
                    ? 'var(--apple-blue)'
                    : isCorner
                    ? 'var(--system-purple, #AF52DE)'
                    : isExtended
                    ? 'var(--apple-label-tertiary)'
                    : 'var(--apple-label)',
                  cursor: 'pointer',
                  borderRadius: '2px',
                  background: isSelected ? 'rgba(0, 122, 255, 0.12)' : 'transparent'
                }}
              >
                {label}
              </div>
            );
          })}

          {/* Row 1: Raw Unfiltered Samples */}
          <div style={{ color: 'var(--apple-label-secondary)', fontWeight: 700, padding: '2px' }}>
            RAW p[i]:
          </div>
          {activeRaw.map((val, i) => {
            const { bg, color } = colorFn(val);
            const isSelected = i === selectedIdx;
            return (
              <div
                key={`raw-${i}`}
                onClick={() => setSelectedIdx(i)}
                style={{
                  height: '28px',
                  backgroundColor: bg,
                  color: color,
                  border: isSelected
                    ? '2px solid var(--apple-blue, #007AFF)'
                    : '1px solid rgba(0, 0, 0, 0.15)',
                  borderRadius: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.65rem',
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                {showValues ? val : ''}
              </div>
            );
          })}

          {/* Row 2: Filtered Samples */}
          <div style={{ color: 'var(--apple-blue)', fontWeight: 700, padding: '2px' }}>
            FILT p'[i]:
          </div>
          {activeFilt.map((val, i) => {
            const { bg, color } = colorFn(val);
            const isSelected = i === selectedIdx;
            return (
              <div
                key={`filt-${i}`}
                onClick={() => setSelectedIdx(i)}
                style={{
                  height: '28px',
                  backgroundColor: bg,
                  color: color,
                  border: isSelected
                    ? '2px solid var(--apple-blue, #007AFF)'
                    : '1px solid rgba(0, 0, 0, 0.15)',
                  borderRadius: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.65rem',
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                {showValues ? val : ''}
              </div>
            );
          })}

          {/* Row 3: Difference Delta (p' - p) */}
          <div style={{ color: 'var(--apple-label-tertiary)', fontWeight: 700, padding: '2px' }}>
            DIFF Δ:
          </div>
          {activeRaw.map((rawVal, i) => {
            const diff = activeFilt[i] - rawVal;
            const isSelected = i === selectedIdx;
            const diffColor = diff === 0
              ? 'var(--apple-label-tertiary)'
              : diff > 0
              ? 'var(--system-green, #34C759)'
              : 'var(--system-orange, #FF9500)';
            return (
              <div
                key={`diff-${i}`}
                onClick={() => setSelectedIdx(i)}
                style={{
                  textAlign: 'center',
                  fontSize: '0.62rem',
                  fontWeight: isSelected ? 800 : 600,
                  color: diffColor,
                  cursor: 'pointer',
                  padding: '2px 0',
                  borderRadius: '2px',
                  background: isSelected ? 'rgba(0, 122, 255, 0.12)' : 'transparent'
                }}
              >
                {diff > 0 ? `+${diff}` : `${diff}`}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Detailed 3-Tap Formula Inspection HUD */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '0.85rem'
      }}>
        {/* Card A: Selected Sample 3-Tap Calculation */}
        <div style={{
          background: 'var(--apple-surface, #F5F5F7)',
          border: '1px solid var(--apple-hairline)',
          borderRadius: '6px',
          padding: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.72rem',
            fontWeight: 800,
            fontFamily: 'JetBrains Mono',
            color: 'var(--apple-label)'
          }}>
            <span>
              SAMPLE INSPECTOR: {activeAxis.toUpperCase()}[{formulaDetails.idx === 0 ? 'Corner -1' : formulaDetails.idx - 1}]
            </span>
            <span style={{
              color: formulaDetails.delta === 0 ? 'var(--apple-label-secondary)' : 'var(--apple-blue)',
              fontWeight: 700
            }}>
              Δ = {formulaDetails.delta > 0 ? `+${formulaDetails.delta}` : formulaDetails.delta} LSB
            </span>
          </div>

          <div style={{
            background: 'var(--apple-canvas)',
            padding: '0.5rem 0.65rem',
            borderRadius: '4px',
            border: '1px solid var(--apple-hairline)',
            fontFamily: 'JetBrains Mono',
            fontSize: '0.72rem',
            lineHeight: 1.5,
            color: 'var(--apple-label)'
          }}>
            <div style={{ color: 'var(--apple-label-secondary)', fontSize: '0.66rem' }}>
              {formulaDetails.formulaStr}
            </div>
            <div style={{ marginTop: '0.25rem', fontWeight: 700, color: 'var(--apple-blue)' }}>
              ({formulaDetails.pPrev} + 2·{formulaDetails.pCurr} + {formulaDetails.pNext} + 2) &gt;&gt; 2 = {formulaDetails.calcVal}
            </div>
          </div>

          <div style={{ fontSize: '0.68rem', color: 'var(--apple-label-secondary)', lineHeight: 1.4 }}>
            {formulaDetails.note}
          </div>
        </div>

        {/* Card B: MDIS Decision Rules & HEVC Specifications */}
        <div style={{
          background: 'var(--apple-surface, #F5F5F7)',
          border: '1px solid var(--apple-hairline)',
          borderRadius: '6px',
          padding: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem'
        }}>
          <div style={{
            fontSize: '0.72rem',
            fontWeight: 800,
            fontFamily: 'JetBrains Mono',
            color: 'var(--apple-label)'
          }}>
            MDIS FILTER SPECIFICATION & RULES
          </div>

          <div style={{
            fontSize: '0.70rem',
            color: 'var(--apple-label-secondary)',
            lineHeight: 1.45,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem'
          }}>
            <div>
              • <strong>4×4 CU:</strong> MDIS smoothing is always BYPASSED per standard.
            </div>
            <div>
              • <strong>8×8 CU:</strong> Applied to diagonal modes (Modes 2, 18, 34) and Planar (0).
            </div>
            <div>
              • <strong>16×16 &amp; 32×32 CU:</strong> Applied to all modes except near-horizontal (9..11) and near-vertical (25..27).
            </div>
            <div>
              • <strong>Chroma (Cb/Cr):</strong> Strictly BYPASSED per H.265 Section 8.4.4.2.3.
            </div>
          </div>

          <div style={{
            fontSize: '0.68rem',
            fontFamily: 'JetBrains Mono',
            color: isMDISSmoothed ? 'var(--system-green, #34C759)' : 'var(--apple-label-secondary)',
            fontWeight: 700,
            marginTop: '0.2rem'
          }}>
            Current State: Block {N}×{N} ({channel}) ➔ {isMDISSmoothed ? 'FILTER APPLIED' : 'FILTER BYPASSED'}
          </div>
        </div>
      </div>
    </div>
  );
}
