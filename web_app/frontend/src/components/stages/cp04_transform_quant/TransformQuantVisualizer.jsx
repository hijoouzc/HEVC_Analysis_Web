import React, { useState, useCallback, useMemo } from 'react';
import BlockMatrixGrid from '../../common/BlockMatrixGrid';
import TuTreeCallStack from './TuTreeCallStack';
import { Button, SegmentedControl } from '../../apple';
import { resolveCuCoordinates } from '../../../utils/cuCoordinates.js';

/**
 * TransformQuantVisualizer (CP_04_TRANSFORM_QUANT)
 * Displays:
 *  1. Residual QuadTree (RQT) Geometric Square Blocks Hierarchical Tree
 *  2. Spatial Residual Matrix R(x, y)
 *  3. 2D DCT/DST Frequency Spectrum & Energy Compaction Ratio
 *  4. Quantized Levels QCoeff & Sparsity Ratio Analysis
 */
function TransformQuantVisualizer({
  transformData = [],
  quantData = [],
  _ctuX = 0,
  _ctuY = 0,
  targetTuX = undefined,
  targetTuY = undefined,
  targetCuX = undefined,
  targetCuY = undefined,
  targetCuSize = undefined,
  _selectedCu = null,
  channel: propsChannel = undefined,
  onSelectChannel = null,
  showValues: propsShowValues = undefined,
  onToggleValues = null,
  initialViewLayout = 'dual',
  resiGain = 4,
}) {
  const [internalComp, setInternalComp] = useState('Y'); // 'Y', 'Cb', 'Cr'
  const activeComp = propsChannel !== undefined ? propsChannel : internalComp;
  const setActiveComp = onSelectChannel || setInternalComp;
  const [selectedCell, setSelectedCell] = useState(null); // { x, y }
  const [activeWindow, setActiveWindow] = useState({ wx: 0, wy: 0 });
  const [zoomLevel, setZoomLevel] = useState('fit'); // 'fit' or 'zoom'
  const [internalShowValues, setInternalShowValues] = useState(true);
  const showValues = propsShowValues !== undefined ? propsShowValues : internalShowValues;
  const setShowValues = onToggleValues || setInternalShowValues;
  const [viewLayout, setViewLayout] = useState(initialViewLayout); // 'dual' | 'tree' | 'matrix'

  const handleCellClick = useCallback((coord) => {
    setSelectedCell(prev => (prev && prev.x === coord.x && prev.y === coord.y ? null : coord));
  }, []);

  const cuCoords = useMemo(() => {
    return resolveCuCoordinates(_selectedCu, _ctuX, _ctuY, targetCuSize || 8);
  }, [_selectedCu, _ctuX, _ctuY, targetCuSize]);

  const tuSelectionContextKey = `${_ctuX}_${_ctuY}_${targetCuX ?? cuCoords.absX}_${targetCuY ?? cuCoords.absY}_${targetCuSize ?? cuCoords.size}_${activeComp}`;
  const [userTuSelectionState, setUserTuSelectionState] = useState(null);
  const userSelectedTuIdx = userTuSelectionState?.key === tuSelectionContextKey ? userTuSelectionState.idx : null;
  const setUserSelectedTuIdx = useCallback((idx) => {
    setUserTuSelectionState(idx === null ? null : { key: tuSelectionContextKey, idx });
  }, [tuSelectionContextKey]);

  // Filter events by selected component (supporting either transformData or quantData)
  const filteredEvents = useMemo(() => {
    const allEvents = (transformData && transformData.length > 0) ? transformData : (quantData || []);
    let events = allEvents.filter(e => e.component === activeComp);

    // If a specific CU is targeted, prioritize matching events
    const searchX = targetCuX != null ? targetCuX : cuCoords.absX;
    const searchY = targetCuY != null ? targetCuY : cuCoords.absY;
    const relSearchX = targetTuX != null ? targetTuX : cuCoords.relX;
    const relSearchY = targetTuY != null ? targetTuY : cuCoords.relY;

    const cuMatched = events.filter(e =>
      (e.cu_x === searchX || e.cu_x === relSearchX || e.tu_x === searchX || e.tu_x === relSearchX) &&
      (e.cu_y === searchY || e.cu_y === relSearchY || e.tu_y === searchY || e.tu_y === relSearchY)
    );
    if (cuMatched.length > 0) {
      events = cuMatched;
    }

    // If targetCuSize is specified, filter matching events
    if (targetCuSize != null) {
      const sizeMatched = events.filter(e => e.cu_width === targetCuSize || e.cu_size === targetCuSize);
      if (sizeMatched.length > 0) {
        events = sizeMatched;
      }
    }
    return events;
  }, [transformData, quantData, activeComp, targetCuX, targetCuY, targetTuX, targetTuY, cuCoords, targetCuSize]);

  // Sync with targetTuX and targetTuY if provided, or use user override
  const targetIdx = useMemo(() => {
    if (filteredEvents.length === 0) return -1;
    const searchX = targetTuX != null ? targetTuX : cuCoords.relX;
    const searchY = targetTuY != null ? targetTuY : cuCoords.relY;
    const absSearchX = cuCoords.absX;
    const absSearchY = cuCoords.absY;

    return filteredEvents.findIndex(e =>
      (e.tu_x === searchX || e.tu_x === absSearchX) &&
      (e.tu_y === searchY || e.tu_y === absSearchY)
    );
  }, [filteredEvents, targetTuX, targetTuY, cuCoords]);

  const selectedTuIdx = (userSelectedTuIdx !== null && userSelectedTuIdx < filteredEvents.length)
    ? userSelectedTuIdx
    : (targetIdx !== -1 ? targetIdx : 0);

  const activeEvent = filteredEvents[selectedTuIdx] || filteredEvents[0];

  const handleSelectTuFromTree = useCallback((tuRecord) => {
    if (!tuRecord) return;
    const targetRawX = tuRecord.rawTuX ?? tuRecord.tu_x ?? tuRecord.absX ?? tuRecord.x;
    const targetRawY = tuRecord.rawTuY ?? tuRecord.tu_y ?? tuRecord.absY ?? tuRecord.y;
    const targetSize = tuRecord.width ?? tuRecord.size;
    const targetRelX = tuRecord.relX;
    const targetRelY = tuRecord.relY;

    let matchIdx = filteredEvents.findIndex(e => {
      if (e === tuRecord || (tuRecord.rawEvent && e === tuRecord.rawEvent)) return true;
      if (e.id && tuRecord.id && e.id === tuRecord.id) return true;
      const sizeMatches = targetSize ? (e.width === targetSize || e.size === targetSize) : true;
      if (e.tu_x === targetRawX && e.tu_y === targetRawY && sizeMatches) return true;
      if (targetRelX !== undefined && targetRelY !== undefined) {
        const eRelX = (targetCuX != null && e.tu_x >= targetCuX) ? (e.tu_x - targetCuX) : e.tu_x;
        const eRelY = (targetCuY != null && e.tu_y >= targetCuY) ? (e.tu_y - targetCuY) : e.tu_y;
        if (eRelX === targetRelX && eRelY === targetRelY && sizeMatches) return true;
      }
      return false;
    });

    // Fallback: If split parent node clicked without direct transform record, select first child leaf event
    if (matchIdx === -1 && (tuRecord.isSplit || tuRecord.children?.length)) {
      const pRelX = tuRecord.relX ?? 0;
      const pRelY = tuRecord.relY ?? 0;
      const pSize = tuRecord.size || 32;
      matchIdx = filteredEvents.findIndex(e => {
        const eRelX = (targetCuX != null && e.tu_x >= targetCuX) ? (e.tu_x - targetCuX) : e.tu_x;
        const eRelY = (targetCuY != null && e.tu_y >= targetCuY) ? (e.tu_y - targetCuY) : e.tu_y;
        return eRelX >= pRelX && eRelX < pRelX + pSize &&
               eRelY >= pRelY && eRelY < pRelY + pSize;
      });
    }

    if (matchIdx !== -1) {
      setUserSelectedTuIdx(matchIdx);
      setSelectedCell(null);
      setActiveWindow({ wx: 0, wy: 0 });
    }
  }, [filteredEvents, targetCuX, targetCuY, setUserSelectedTuIdx]);

  if (!activeEvent) {
    return (
      <div className="apple-card" style={{ padding: '2rem', textAlign: 'center', background: 'var(--apple-canvas)' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>CP_04: Residual Transform &amp; RQT Hierarchy</h3>
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
    const norm = Math.min(1, (Math.abs(val) * (resiGain || 1)) / (maxResiMag || 1));
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

  const isZoom = zoomLevel === 'zoom';
  const microCellSize = isZoom ? 40 : 32;
  const macroCanvasSize = isZoom ? 180 : 140;

  return (
    <div className="transform-quant-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Component & TU Selector Bar */}
      <div className="apple-card" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '6px 10px',
      }}>
        {/* Component Tabs */}
        {propsChannel === undefined && (
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
                setActiveWindow({ wx: 0, wy: 0 });
              }}
              items={[
                { id: 'Y', label: 'Luma (Y)' },
                { id: 'Cb', label: 'Chroma (Cb)' },
                { id: 'Cr', label: 'Chroma (Cr)' },
              ]}
              size="small"
            />
          </div>
        )}

        {/* TU Block Selector & Controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* RQT View Layout Switcher */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--apple-label-secondary)' }}>
              Layout:
            </span>
            <SegmentedControl
              value={viewLayout}
              onChange={setViewLayout}
              size="small"
              items={[
                { id: 'dual', label: 'Dual View' },
                { id: 'tree', label: 'RQT Tree' },
                { id: 'matrix', label: 'Matrix' },
              ]}
            />
          </div>

          {/* Active Selected TU Indicator (Selected on Transform QuadTree) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 8px',
              borderRadius: '5px',
              background: 'var(--fill-2)',
              border: '0.5px solid var(--separator)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
            }}
            title={`Active TU at (${_tu_x}, ${_tu_y}) selected on Transform QuadTree`}
          >
            <span style={{ color: 'var(--apple-blue)', fontWeight: 700 }}>TU:</span>
            <span style={{ color: 'var(--apple-label)', fontWeight: 600 }}>
              {width}×{height}
            </span>
            <span style={{ color: 'var(--apple-label-secondary)', fontSize: '10px' }}>
              ({transformName})
            </span>
          </div>

          {/* Zoom Preset Toggle */}
          <SegmentedControl
            value={zoomLevel}
            onChange={setZoomLevel}
            size="small"
            items={[
              { id: 'fit', label: 'Fit' },
              { id: 'zoom', label: '1.5×' },
            ]}
          />

          {/* Values Overlay Toggle - Only render local button when UNCONTROLLED */}
          {propsShowValues === undefined && (
            <Button
              variant={showValues ? 'tinted' : 'gray'}
              size="small"
              onClick={() => setShowValues((prev) => !prev)}
              title="Toggle numerical values on transform matrices"
            >
              Values: {showValues ? 'ON' : 'OFF'}
            </Button>
          )}
        </div>
      </div>

      {/* RQT Geometric Square Tree View & Call Stack Stepper */}
      {(viewLayout === 'dual' || viewLayout === 'tree') && (
        <div className="rqt-tree-section" style={{ width: '100%' }}>
          <TuTreeCallStack
            tuEvents={filteredEvents}
            cuX={targetCuX ?? activeEvent.cu_x ?? 0}
            cuY={targetCuY ?? activeEvent.cu_y ?? 0}
            cuSize={targetCuSize ?? activeEvent.cu_width ?? activeEvent.cu_size ?? 32}
            component={activeComp}
            intraMode={activeEvent.intra_mode ?? null}
            selectedTu={activeEvent}
            onSelectTu={handleSelectTuFromTree}
          />
        </div>
      )}

      {/* Micro-HUD Strip: Core TComTrQuant Parameters & Live Telemetry */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '5px 12px',
        background: 'var(--fill-1)',
        border: '0.5px solid var(--separator)',
        borderRadius: '6px',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span>
            <strong style={{ color: 'var(--apple-label)' }}>TU:</strong> {width}×{height} ({activeComp})
          </span>
          <span style={{ color: 'var(--separator)' }}>&bull;</span>
          <span>
            <strong style={{ color: 'var(--apple-label-secondary)' }}>Core:</strong> {transformName}
          </span>
          <span style={{ color: 'var(--separator)' }}>&bull;</span>
          <span>
            <strong style={{ color: 'var(--apple-blue)' }}>Energy:</strong> {energyPercent}% (DC={dc_coeff})
          </span>
          <span style={{ color: 'var(--separator)' }}>&bull;</span>
          <span>
            <strong style={{ color: 'var(--apple-purple)' }}>Sparsity:</strong> {sparsityPercent}% ({zeroCoeffCount}/{width * height} zeros)
          </span>
          <span style={{ color: 'var(--separator)' }}>&bull;</span>
          <span>
            <strong style={{ color: '#10B981' }}>Sig Coeffs:</strong> {sig_coeff_count}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: '9.5px',
            fontWeight: 700,
            color: sig_coeff_count > 0 ? '#10B981' : '#8E8E93',
            background: sig_coeff_count > 0 ? 'rgba(16, 185, 129, 0.12)' : 'var(--fill-2)',
            border: sig_coeff_count > 0 ? '0.5px solid rgba(16, 185, 129, 0.3)' : '0.5px solid var(--separator)',
            borderRadius: '4px',
            padding: '1px 6px',
          }}>
            CBF_{activeComp} = {sig_coeff_count > 0 ? '1' : '0'}
          </span>
        </div>
      </div>

      {/* Tri-Matrix Pipeline Comparison View */}
      {(viewLayout === 'dual' || viewLayout === 'matrix') ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
          gap: '12px',
          alignItems: 'stretch',
          maxWidth: '100%',
          width: '100%',
          overflowX: 'auto',
          boxSizing: 'border-box'
        }}>
        {/* Matrix 1: Spatial Residual R(x, y) */}
        <div className="apple-card" style={{
          padding: '1rem',
          maxWidth: '100%',
          height: width <= 4 ? '270px' : width <= 8 ? '360px' : '475px',
          minHeight: width <= 4 ? '270px' : width <= 8 ? '360px' : '475px',
          maxHeight: width <= 4 ? '270px' : width <= 8 ? '360px' : '475px',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', height: '22px', flexShrink: 0 }}>
            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--apple-label)', margin: 0 }}>
              1. Spatial Residual R(x, y) [{resiGain}×]
            </h4>
            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--apple-blue)', background: 'rgba(0, 122, 255, 0.1)', padding: '1px 5px', borderRadius: '3px' }}>
              Spatial
            </span>
          </div>

          <div style={{ width: '100%', flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'safe center', flexShrink: 0 }}>
            <BlockMatrixGrid
              data={resi_matrix}
              width={width}
              selectedCell={selectedCell}
              onSelectCell={handleCellClick}
              activeWindow={activeWindow}
              onSelectWindow={setActiveWindow}
              getColor={(val) => getResiColor(val)}
              formatValue={(val) => (val > 0 ? `+${val}` : val)}
              microCellSize={microCellSize}
              macroCanvasSize={macroCanvasSize}
              showValues={showValues}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--apple-label-secondary)', marginTop: 'auto', flexShrink: 0 }}>
            <span>Negative (Blue)</span>
            <span>Zero (White)</span>
            <span>Positive (Red)</span>
          </div>
        </div>

        {/* Matrix 2: 2D DCT Frequency Spectrum */}
        <div className="apple-card" style={{
          padding: '1rem',
          maxWidth: '100%',
          height: width <= 4 ? '270px' : width <= 8 ? '360px' : '475px',
          minHeight: width <= 4 ? '270px' : width <= 8 ? '360px' : '475px',
          maxHeight: width <= 4 ? '270px' : width <= 8 ? '360px' : '475px',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', height: '22px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--apple-label)', margin: 0 }}>
                2. {transformName} Spectrum C(u, v)
              </h4>
              <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--system-purple)', background: 'rgba(175, 82, 222, 0.1)', padding: '1px 5px', borderRadius: '3px' }}>
                Frequency
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--apple-blue)', fontWeight: 700 }}>
              DC = {dc_coeff}
            </span>
          </div>

          <div style={{ width: '100%', flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'safe center', flexShrink: 0 }}>
            <BlockMatrixGrid
              data={dct_coeff}
              width={width}
              selectedCell={selectedCell}
              onSelectCell={handleCellClick}
              activeWindow={activeWindow}
              onSelectWindow={setActiveWindow}
              getColor={(val, isDC) => getDctColor(val, isDC)}
              formatValue={(val) => val}
              microCellSize={microCellSize}
              macroCanvasSize={macroCanvasSize}
              showValues={showValues}
            />
          </div>

          {/* Energy bar */}
          <div style={{ marginTop: 'auto', flexShrink: 0 }}>
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
          padding: '1rem',
          maxWidth: '100%',
          height: width <= 4 ? '270px' : width <= 8 ? '360px' : '475px',
          minHeight: width <= 4 ? '270px' : width <= 8 ? '360px' : '475px',
          maxHeight: width <= 4 ? '270px' : width <= 8 ? '360px' : '475px',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', height: '22px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--apple-label)', margin: 0 }}>
                3. Quantized QCoeff(u, v)
              </h4>
              <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--system-purple)', background: 'rgba(175, 82, 222, 0.1)', padding: '1px 5px', borderRadius: '3px' }}>
                Levels
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--apple-purple, #AF52DE)', fontWeight: 700 }}>
              QP = {qp}
            </span>
          </div>

          <div style={{ width: '100%', flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'safe center', flexShrink: 0 }}>
            <BlockMatrixGrid
              data={quant_coeff}
              width={width}
              selectedCell={selectedCell}
              onSelectCell={handleCellClick}
              activeWindow={activeWindow}
              onSelectWindow={setActiveWindow}
              getColor={(val) => {
                const res = getQuantColor(val);
                return { bg: res.bg, color: res.color, fontWeight: res.isZero ? 400 : 800 };
              }}
              formatValue={(val) => val}
              microCellSize={microCellSize}
              macroCanvasSize={macroCanvasSize}
              showValues={showValues}
            />
          </div>

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
      ) : (
        <div className="apple-card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--fill-1)' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--apple-label-secondary)', fontFamily: 'var(--font-mono)' }}>
            Selected Node: TU #{selectedTuIdx + 1} ({width}&times;{height}) at ({activeEvent.tu_x}, {activeEvent.tu_y}) &bull; {sig_coeff_count} sig coeffs &bull; Energy Compaction {energyPercent}%
          </span>
          <Button variant="tinted" size="small" onClick={() => setViewLayout('dual')}>
            Open Tri-Matrix in Dual View &rarr;
          </Button>
        </div>
      )}

      {/* Selected Sample Inspector Readout */}
      <div style={{
        background: selectedCell ? 'var(--apple-orange-subtle, rgba(255, 149, 0, 0.1))' : 'var(--apple-card-bg)',
        border: selectedCell ? '1px solid var(--system-orange, #FF9500)' : '1px solid var(--apple-hairline)',
        borderRadius: '4px',
        padding: '0.65rem 1rem',
        minHeight: '48px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.8rem',
        boxSizing: 'border-box'
      }}>
        {selectedCell ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <strong style={{ color: 'var(--system-orange, #FF9500)' }}>
                Sample ({selectedCell.x}, {selectedCell.y}):
              </strong>
              <span>Residual: <strong style={{ color: 'var(--apple-label-primary)' }}>{resi_matrix[selectedCell.y * width + selectedCell.x]}</strong></span>
              <span>{transformName}: <strong style={{ color: 'var(--apple-blue)' }}>{dct_coeff[selectedCell.y * width + selectedCell.x]}</strong></span>
              <span>Quantized: <strong style={{ color: 'var(--apple-purple)' }}>{quant_coeff[selectedCell.y * width + selectedCell.x]}</strong></span>
            </div>
            <Button
              variant="gray"
              size="small"
              onClick={() => setSelectedCell(null)}
            >
              Clear Selection
            </Button>
          </div>
        ) : (
          <div style={{ color: 'var(--apple-label-secondary)', fontSize: '0.76rem' }}>
            Click any sample to inspect synchronized values across Residual, Transform, and Quantization
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(TransformQuantVisualizer);
