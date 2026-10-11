import React, { useState, useCallback } from 'react';
import HmSourceCodeModal from './common/HmSourceCodeModal';
import BlockMatrixGrid from './common/BlockMatrixGrid';
import { HM_TRANSFORM_QUANT_SNIPPET } from '../constants/hmSourceSnippets';
import { Button, SegmentedControl } from './apple';

/**
 * TransformQuantVisualizer (CP_06_TRANSFORM & CP_07_QUANT)
 * Displays:
 *  1. Spatial Residual Matrix R(x, y)
 *  2. 2D DCT/DST Frequency Spectrum & Energy Compaction Ratio
 *  3. Quantized Levels QCoeff & Sparsity Ratio Analysis
 */
export default function TransformQuantVisualizer({
  transformData = [],
  quantData = [],
  _ctuX = 0,
  _ctuY = 0,
  targetTuX = undefined,
  targetTuY = undefined
}) {
  const [activeComp, setActiveComp] = useState('Y'); // 'Y', 'Cb', 'Cr'
  const [userSelectedTuIdx, setUserSelectedTuIdx] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null); // { x, y }
  const [showHmModal, setShowHmModal] = useState(false);

  const handleCellClick = useCallback((coord) => {
    setSelectedCell(prev => (prev && prev.x === coord.x && prev.y === coord.y ? null : coord));
  }, []);

  // Filter events by selected component (supporting either transformData or quantData)
  const allEvents = (transformData && transformData.length > 0) ? transformData : (quantData || []);
  const filteredEvents = allEvents.filter(e => e.component === activeComp);

  // Sync with targetTuX and targetTuY if provided, or use user override
  const targetIdx = (targetTuX != null && targetTuY != null && filteredEvents.length > 0)
    ? filteredEvents.findIndex(e => e.tu_x === targetTuX && e.tu_y === targetTuY)
    : -1;

  const selectedTuIdx = (userSelectedTuIdx !== null && userSelectedTuIdx < filteredEvents.length)
    ? userSelectedTuIdx
    : (targetIdx !== -1 ? targetIdx : 0);

  const activeEvent = filteredEvents[selectedTuIdx] || filteredEvents[0];

  if (!activeEvent) {
    return (
      <div className="apple-card" style={{ padding: '2rem', textAlign: 'center', background: 'var(--apple-canvas)' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>CP_06 & CP_07: Transform & Quantization</h3>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
          No Transform or Quantization trace events found for component {activeComp}.
        </p>
      </div>
    );
  }

  const {
    width = 8,
    height = 8,
    qp = 32,
    tu_x: _tu_x = 0,
    tu_y: _tu_y = 0,
    resi_matrix = [],
    dct_coeff = [],
    quant_coeff = [],
    sig_coeff_count = 0,
    dc_coeff = 0,
    energy_compaction_ratio = 0,
    sparsity_ratio = 0
  } = activeEvent;

  // H.265 Section 8.7.2: 4x4 Luma Intra uses Discrete Sine Transform (DST-VII); all other sizes use DCT-II
  const isDst = (width === 4 && height === 4 && activeComp === 'Y');
  const transformName = isDst ? '2D DST-VII' : '2D DCT-II';

  // Max magnitude for DCT/DST spectrum coloring
  const maxDctMag = dct_coeff.reduce((max, c) => Math.max(max, Math.abs(c)), 1);
  const maxResiMag = resi_matrix.reduce((max, r) => Math.max(max, Math.abs(r)), 1);

  // Helper color functions
  const getResiColor = (val) => {
    if (val === 0) return { bg: 'var(--apple-canvas, #FAFAFA)', color: 'var(--apple-label-tertiary, #8E8E93)' };
    const norm = Math.min(1, Math.abs(val) / (maxResiMag || 1));
    if (val > 0) {
      // Positive: Soft Red/Orange
      const alpha = 0.15 + norm * 0.75;
      return { bg: `rgba(239, 68, 68, ${alpha})`, color: norm > 0.5 ? '#FFFFFF' : 'var(--apple-label)' };
    } else {
      // Negative: Soft Blue
      const alpha = 0.15 + norm * 0.75;
      return { bg: `rgba(59, 130, 246, ${alpha})`, color: norm > 0.5 ? '#FFFFFF' : 'var(--apple-label)' };
    }
  };

  const getDctColor = (val, isDC) => {
    if (isDC) {
      return { bg: 'var(--apple-blue, #007AFF)', color: '#FFFFFF', fontWeight: 800 };
    }
    if (val === 0) {
      return { bg: 'var(--apple-canvas, #FAFAFA)', color: 'var(--apple-label-tertiary, #8E8E93)', fontWeight: 400 };
    }
    const norm = Math.min(1, Math.abs(val) / (maxDctMag || 1));
    const alpha = 0.12 + norm * 0.75;
    return { bg: `rgba(141, 198, 63, ${alpha})`, color: norm > 0.6 ? '#FFFFFF' : 'var(--apple-label)', fontWeight: 700 };
  };

  const getQuantColor = (val) => {
    if (val === 0) {
      return { bg: 'var(--apple-canvas, #FAFAFA)', color: 'var(--apple-label-tertiary, #8E8E93)', isZero: true };
    }
    const isMajor = Math.abs(val) > 2;
    return {
      bg: isMajor ? 'var(--apple-purple, #AF52DE)' : 'rgba(175, 82, 222, 0.15)',
      color: isMajor ? '#FFFFFF' : 'var(--apple-purple, #AF52DE)',
      isZero: false
    };
  };

  const zeroCoeffCount = (width * height) - (sig_coeff_count ?? 0);
  const sparsityPercent = typeof sparsity_ratio === 'number' ? (sparsity_ratio * 100).toFixed(1) : '—';
  const energyPercent = typeof energy_compaction_ratio === 'number' ? (energy_compaction_ratio * 100).toFixed(1) : '—';

  return (
    <div className="transform-quant-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Component & TU Selector Bar */}
      <div className="apple-card" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        padding: '0.65rem 1rem',
      }}>
        {/* Component Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--apple-label-secondary)' }}>
            Component:
          </span>
          <SegmentedControl
            value={activeComp}
            onChange={(comp) => {
              setActiveComp(comp);
              setUserSelectedTuIdx(0);
              setSelectedCell(null);
            }}
            items={[
              { id: 'Y', label: 'Luma (Y)' },
              { id: 'Cb', label: 'Chroma (Cb)' },
              { id: 'Cr', label: 'Chroma (Cr)' },
            ]}
            size="small"
          />
        </div>

        {/* TU Block Selector & Code Trigger */}
        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--apple-label-secondary)' }}>
              TU Instance:
            </span>
            <select
              value={selectedTuIdx}
              onChange={(e) => setUserSelectedTuIdx(Number(e.target.value))}
              className="apple-select-control"
              style={{ height: '24px', fontSize: '11px', padding: '0 8px' }}
            >
              {filteredEvents.map((ev, idx) => (
                <option key={idx} value={idx}>
                  TU #{idx + 1} @ ({ev.tu_x}, {ev.tu_y}) — {ev.width}×{ev.height} px
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="gray"
            size="small"
            onClick={() => setShowHmModal(true)}
            title="Inspect HM-16.0 C++ Source Code for transformNxN & quant"
          >
            &lt;&gt; Show HM Code
          </Button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="apple-card" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        padding: '0.85rem 1.25rem',
      }}>
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--apple-label-secondary)', fontWeight: 600 }}>Transform Unit</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--apple-label-primary)' }}>{width} × {height} ({activeComp})</div>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'JetBrains Mono' }}>QP {qp}</div>
        </div>

        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--apple-label-secondary)', fontWeight: 600 }}>Energy Compaction</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--apple-blue)' }}>{energyPercent}%</div>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'JetBrains Mono' }}>DC = {dc_coeff}</div>
        </div>

        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--apple-label-secondary)', fontWeight: 600 }}>Quantization Sparsity</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--apple-purple)' }}>{sparsityPercent}%</div>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'JetBrains Mono' }}>{zeroCoeffCount} / {width * height} zeros</div>
        </div>

        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--apple-label-secondary)', fontWeight: 600 }}>Non-Zero Levels</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#15803D' }}>{sig_coeff_count} coeffs</div>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'JetBrains Mono' }}>Magnitude non-zero count</div>
        </div>
      </div>

      {/* Tri-Matrix Pipeline Comparison View */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
        alignItems: 'flex-start'
      }}>
        {/* Matrix 1: Spatial Residual R(x, y) */}
        <div className="apple-card" style={{
          padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--apple-label)' }}>
              1. Spatial Residual R(x, y)
            </h4>
          </div>

          <BlockMatrixGrid
            data={resi_matrix}
            width={width}
            selectedCell={selectedCell}
            onSelectCell={handleCellClick}
            getColor={(val) => getResiColor(val)}
            formatValue={(val) => (val > 0 ? `+${val}` : val)}
            getTooltip={(val, x, y) => `Residual (${x}, ${y}): ${val}`}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--apple-label-secondary)', marginTop: '0.5rem' }}>
            <span>Negative (Blue)</span>
            <span>Zero (White)</span>
            <span>Positive (Red)</span>
          </div>
        </div>

        {/* Matrix 2: 2D DCT Frequency Spectrum */}
        <div className="apple-card" style={{
          padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--apple-label)' }}>
              2. {transformName} Spectrum C(u, v)
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--apple-blue)', fontWeight: 700 }}>
              DC = {dc_coeff}
            </span>
          </div>

          <BlockMatrixGrid
            data={dct_coeff}
            width={width}
            selectedCell={selectedCell}
            onSelectCell={handleCellClick}
            getColor={(val, isDC) => getDctColor(val, isDC)}
            formatValue={(val) => val}
            getTooltip={(val, x, y, isDC) => `${isDst ? 'DST' : 'DCT'} (${x}, ${y}) [${isDC ? 'DC' : 'AC'}]: ${val}`}
          />

          {/* Energy bar */}
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.2rem', color: 'var(--apple-label)' }}>
              <span>DC Harmonic Energy Compaction</span>
              <span style={{ color: 'var(--apple-blue)' }}>{energyPercent}%</span>
            </div>
            <div style={{ height: '6px', background: 'var(--apple-canvas)', border: '1px solid var(--apple-hairline)', borderRadius: 0, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, Math.max(0, energy_compaction_ratio * 100))}%`, height: '100%', background: 'var(--apple-blue)' }} />
            </div>
          </div>
        </div>

        {/* Matrix 3: Quantized Coefficients QCoeff */}
        <div className="apple-card" style={{
          padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--apple-label)' }}>
              3. Quantized QCoeff(u, v)
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--apple-purple, #AF52DE)', fontWeight: 700 }}>
              QP = {qp}
            </span>
          </div>

          <BlockMatrixGrid
            data={quant_coeff}
            width={width}
            selectedCell={selectedCell}
            onSelectCell={handleCellClick}
            getColor={(val) => {
              const res = getQuantColor(val);
              return { bg: res.bg, color: res.color, fontWeight: res.isZero ? 400 : 800 };
            }}
            formatValue={(val) => val}
            getTooltip={(val, x, y) => `QCoeff (${x}, ${y}): ${val}`}
          />

          {/* Sparsity bar */}
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.2rem', color: 'var(--apple-label)' }}>
              <span>High-Frequency Zero Sparsity Ratio</span>
              <span style={{ color: 'var(--apple-purple, #AF52DE)' }}>{sparsityPercent}%</span>
            </div>
            <div style={{ height: '6px', background: 'var(--apple-canvas)', border: '1px solid var(--apple-hairline)', borderRadius: 0, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, Math.max(0, sparsity_ratio * 100))}%`, height: '100%', background: 'var(--apple-purple, #AF52DE)' }} />
            </div>
          </div>

          {/* CBF = 0 Indicator */}
          {sig_coeff_count === 0 && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.4rem 0.75rem',
              background: 'rgba(52, 199, 89, 0.08)',
              border: '1px solid rgba(52, 199, 89, 0.3)',
              borderRadius: 0,
              textAlign: 'center'
            }}>
              <span style={{ color: 'var(--apple-green, #34C759)', fontWeight: 700, fontSize: '0.75rem' }}>
                CBF_{activeComp} = 0 • All coefficients zero
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Selected Pixel Inspector Readout */}
      {selectedCell && (
        <div style={{
          background: 'var(--apple-card-bg)',
          border: '1px solid var(--apple-hairline)',
          borderRadius: 0,
          padding: '0.65rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.8rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            <strong style={{ color: 'var(--apple-label-primary)' }}>
              Sample ({selectedCell.x}, {selectedCell.y}):
            </strong>
            <span style={{ color: 'var(--apple-label-secondary)' }}>Residual: <strong style={{ color: 'var(--apple-label-primary)' }}>{resi_matrix[selectedCell.y * width + selectedCell.x]}</strong></span>
            <span style={{ color: 'var(--apple-label-secondary)' }}>{transformName}: <strong style={{ color: 'var(--apple-blue)' }}>{dct_coeff[selectedCell.y * width + selectedCell.x]}</strong></span>
            <span style={{ color: 'var(--apple-label-secondary)' }}>Quantized: <strong style={{ color: 'var(--apple-purple)' }}>{quant_coeff[selectedCell.y * width + selectedCell.x]}</strong></span>
          </div>
        </div>
      )}

      {/* HM-16.0 Source Code Inspector Modal for TU Transform & Quantization */}
      <HmSourceCodeModal
        isOpen={showHmModal}
        onClose={() => setShowHmModal(false)}
        title={HM_TRANSFORM_QUANT_SNIPPET.title}
        sourceFile={HM_TRANSFORM_QUANT_SNIPPET.sourceFile}
        functionName={HM_TRANSFORM_QUANT_SNIPPET.functionName}
        standardRef={HM_TRANSFORM_QUANT_SNIPPET.standardRef}
        description={HM_TRANSFORM_QUANT_SNIPPET.description}
        variables={[
          { name: 'Color Component', value: `${activeComp} (${activeComp === 'Y' ? 'Luma' : activeComp === 'Cb' ? 'Chroma Cb' : 'Chroma Cr'})`, highlight: true },
          { name: 'Core Transform', value: transformName, highlight: true },
          { name: 'TU Dimension', value: `${width}×${height} samples` },
          { name: 'Quantization Parameter (QP)', value: qp },
          { name: 'Significant Coefficients', value: `${sig_coeff_count} / ${width * height}` },
          { name: 'Sparsity Ratio', value: `${sparsityPercent}%` },
          { name: 'Energy Compaction Ratio', value: `${energyPercent}%` },
        ]}
        codeSnippet={HM_TRANSFORM_QUANT_SNIPPET.codeSnippet}
      />
    </div>
  );
}
