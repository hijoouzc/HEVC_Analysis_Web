import React from 'react';
import { getResidualColorAndTextColor, SELECTION_HIGHLIGHT_COLOR } from '../../utils/colorUtils';
import MacroMicroPixelViewer from '../common/MacroMicroPixelViewer';

/**
 * ResidualMatrix
 * Displays the signed residual error matrix (Org - Pred = Resi)
 * with synchronized heatmap color coding and RD Cost readout.
 *
 * For N >= 16: Uses MacroMicroPixelViewer (dual-stage macro canvas + 36px micro matrix).
 * For N <= 8: Uses direct matrix with fixed, large, legible cells (36-48px).
 * 100% Click-Only: zero hover tooltips.
 */
const ResidualMatrix = ({
  resiData,
  orgData: _orgData,
  predData: _predData,
  N,
  cost,
  channel,
  stageGridSize: _stageGridSize,
  resiCellSize = 36,
  showResiText: _showResiText,
  activeCoord,
  onCellClick,
  activeWindow = null,
  onSelectWindow = null,
  showValues = true
}) => {
  const cellSize = N === 4 ? 48 : Math.max(36, resiCellSize);

  return (
    <div className="live-matrix-card">
      <div className="live-matrix-header">
        <div className="live-matrix-header-info">
          <div className="live-matrix-title-wrap">
            <h3 className="live-matrix-title">RESIDUAL ({channel})</h3>
          </div>
        </div>
        <div
          style={{
            fontSize: '0.74rem',
            fontWeight: 700,
            fontFamily: 'JetBrains Mono',
            color: 'var(--apple-purple, #AF52DE)',
            padding: '0.2rem 0.55rem',
            background: 'rgba(175, 82, 222, 0.1)',
            border: '1px solid rgba(175, 82, 222, 0.25)',
            borderRadius: '4px',
            flexShrink: 0
          }}
        >
          COST: {cost !== undefined && cost !== null ? Number(cost).toFixed(1) : '0.0'}
        </div>
      </div>

      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--apple-canvas)',
          border: '1px solid var(--apple-hairline)',
          borderRadius: '6px',
          padding: '12px',
          boxSizing: 'border-box'
        }}
      >
        {N >= 16 ? (
          <MacroMicroPixelViewer
            data={resiData}
            N={N}
            channel={channel}
            type="residual"
            maxResidualScale={64}
            selectedPixel={activeCoord}
            onSelectPixel={onCellClick}
            activeWindow={activeWindow}
            onSelectWindow={onSelectWindow}
            macroCanvasSize={160}
            microCellSize={36}
            showValues={showValues}
          />
        ) : (
          /* N <= 8 Residual Matrix Grid with zero-overflow wrapper */
          <div
            style={{
              width: '100%',
              overflowX: 'auto',
              overflowY: 'hidden',
              display: 'flex',
              justifyContent: 'center',
              padding: '2px 0'
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${N}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${N}, ${cellSize}px)`,
                gap: '1px',
                background: 'var(--apple-hairline)',
                border: '1px solid var(--apple-hairline)',
                borderRadius: '4px',
                overflow: 'hidden',
                lineHeight: 1,
                width: 'fit-content',
                margin: '0 auto',
                flexShrink: 0
              }}
            >
              {resiData.map((val, idx) => {
                const x = idx % N;
                const y = Math.floor(idx / N);
                const isSelected = activeCoord && activeCoord.x === x && activeCoord.y === y;
                const { bg, color } = getResidualColorAndTextColor(val, 64);

                return (
                  <div
                    key={`resi-live-${idx}`}
                    className="cell"
                    onClick={() => onCellClick && onCellClick({ x, y, val })}
                    style={{
                      backgroundColor: bg,
                      color: color,
                      fontWeight: 700,
                      fontSize: cellSize >= 40 ? '0.78rem' : '0.68rem',
                      fontFamily: 'JetBrains Mono',
                      cursor: 'pointer',
                      userSelect: 'none',
                      border: isSelected ? `2.5px solid ${SELECTION_HIGHLIGHT_COLOR}` : 'none',
                      boxShadow: 'none',
                      zIndex: isSelected ? 12 : 1,
                      letterSpacing: '-0.5px',
                      lineHeight: 1,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxSizing: 'border-box'
                    }}
                  >
                    {showValues ? (val > 0 ? `+${val}` : val) : ''}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Residual Legend */}
        <div style={{ display: 'flex', gap: '0.85rem', marginTop: '10px', fontSize: '0.70rem', fontFamily: 'JetBrains Mono', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 9, height: 9, background: '#E11D48', display: 'inline-block' }} />
            <span>+ Under</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 9, height: 9, background: '#0284C7', display: 'inline-block' }} />
            <span>− Over</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 9, height: 9, background: 'var(--apple-canvas)', display: 'inline-block', border: '1px solid var(--apple-hairline)' }} />
            <span>0 Exact</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ResidualMatrix);
