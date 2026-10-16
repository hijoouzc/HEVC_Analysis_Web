import React from 'react';
import { Badge } from '../apple';

/**
 * PuPartitionGeometry
 * Minimalist, pixel-accurate PU Partition diagram adhering to HM-18.0 PartSize enum (TypeDef.h).
 * Supports:
 *   - Intra: SIZE_2Nx2N (single PU) vs SIZE_NxN (4 sub-PUs, Morton Z-order 0..3, min CU only)
 *   - Inter SMP: SIZE_2Nx2N, SIZE_2NxN, SIZE_Nx2N, SIZE_NxN
 *   - Inter AMP: SIZE_2NxnU, SIZE_2NxnD, SIZE_nLx2N, SIZE_nRx2N
 * Click-only interaction: zero hover listeners.
 */
export function PuPartitionGeometry({
  isInter = false,
  cuSize = 16,
  partSize = '2Nx2N',
  onSelectPartSize = null,
  activeSubPu = 0,
  onSelectSubPu = null,
  interData = null,
}) {
  const canSplitIntraNxN = cuSize <= 8; // In HEVC HM, intra NxN is only evaluated at smallest CU depth (typically 8x8)

  const smpModes = ['2Nx2N', '2NxN', 'Nx2N', 'NxN'];
  const ampModes = ['2NxnU', '2NxnD', 'nLx2N', 'nRx2N'];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '10px 12px',
        background: 'var(--fill-1)',
        border: '0.5px solid var(--separator)',
        borderRadius: '8px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--apple-label)' }}>
            PU Partition Geometry (PartSize)
          </span>
          <Badge variant="blue" style={{ fontSize: '9.5px', padding: '1px 5px' }}>
            {isInter ? 'Inter Partitions' : 'Intra Partitions'}
          </Badge>
          <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--apple-label-secondary)' }}>
            CU {cuSize}&times;{cuSize}
          </span>
        </div>

        {/* Partition Mode Selector */}
        {!isInter ? (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => onSelectPartSize && onSelectPartSize('2Nx2N')}
              style={{
                fontSize: '10.5px',
                fontFamily: 'var(--font-mono)',
                padding: '2px 8px',
                borderRadius: '4px',
                background: partSize === '2Nx2N' ? 'var(--system-blue)' : 'var(--fill-2)',
                color: partSize === '2Nx2N' ? '#FFFFFF' : 'var(--apple-label)',
                border: '0.5px solid var(--separator)',
                cursor: 'pointer',
              }}
            >
              2N&times;2N
            </button>
            <button
              type="button"
              disabled={!canSplitIntraNxN}
              onClick={() => onSelectPartSize && onSelectPartSize('NxN')}
              title={canSplitIntraNxN ? 'Intra NxN split (4 sub-PUs)' : 'Intra NxN is only allowed at minimum CU size (8x8)'}
              style={{
                fontSize: '10.5px',
                fontFamily: 'var(--font-mono)',
                padding: '2px 8px',
                borderRadius: '4px',
                background: partSize === 'NxN' ? 'var(--system-blue)' : 'var(--fill-2)',
                color: partSize === 'NxN' ? '#FFFFFF' : canSplitIntraNxN ? 'var(--apple-label)' : 'var(--apple-label-tertiary)',
                border: '0.5px solid var(--separator)',
                cursor: canSplitIntraNxN ? 'pointer' : 'not-allowed',
                opacity: canSplitIntraNxN ? 1 : 0.5,
              }}
            >
              N&times;N {canSplitIntraNxN ? '(4 PUs)' : '(Min CU only)'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
            {[...smpModes, ...ampModes].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onSelectPartSize && onSelectPartSize(m)}
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: partSize === m ? 'var(--system-blue)' : 'var(--fill-2)',
                  color: partSize === m ? '#FFFFFF' : 'var(--apple-label)',
                  border: '0.5px solid var(--separator)',
                  cursor: 'pointer',
                }}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Geometric SVG Box Rendering Partition */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          style={{
            width: '90px',
            height: '90px',
            background: 'var(--fill-2)',
            border: '1px solid var(--system-blue)',
            borderRadius: '4px',
            position: 'relative',
            boxSizing: 'border-box',
            flexShrink: 0,
          }}
        >
          {/* INTRA / INTER 2Nx2N */}
          {partSize === '2Nx2N' && (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--system-blue)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              <span>2N&times;2N</span>
              <span style={{ fontSize: '9px', color: 'var(--apple-label-tertiary)' }}>
                {cuSize}&times;{cuSize}
              </span>
            </div>
          )}

          {/* INTRA / INTER NxN: 4 quadrants in Morton Z-order 0, 1, 2, 3 */}
          {partSize === 'NxN' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: '1fr 1fr',
                width: '100%',
                height: '100%',
              }}
            >
              {[0, 1, 2, 3].map((idx) => {
                const isSelected = activeSubPu === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => onSelectSubPu && onSelectSubPu(idx)}
                    style={{
                      borderRight: (idx % 2 === 0) ? '0.5px solid var(--separator)' : 'none',
                      borderBottom: (idx < 2) ? '0.5px solid var(--separator)' : 'none',
                      background: isSelected ? 'rgba(0, 122, 255, 0.2)' : 'transparent',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      color: isSelected ? 'var(--system-blue)' : 'var(--apple-label)',
                      fontWeight: isSelected ? 700 : 500,
                    }}
                  >
                    <span>{idx}</span>
                    <span style={{ fontSize: '7.5px', color: 'var(--apple-label-tertiary)' }}>
                      {cuSize / 2}&times;{cuSize / 2}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* INTER 2NxN (Horizontal split 1:1) */}
          {partSize === '2NxN' && (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
              <div
                onClick={() => onSelectSubPu && onSelectSubPu(0)}
                style={{
                  flex: 1,
                  borderBottom: '0.5px solid var(--separator)',
                  background: activeSubPu === 0 ? 'rgba(0, 122, 255, 0.2)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  color: activeSubPu === 0 ? 'var(--system-blue)' : 'var(--apple-label)',
                }}
              >
                PU 0 ({cuSize}&times;{cuSize / 2})
              </div>
              <div
                onClick={() => onSelectSubPu && onSelectSubPu(1)}
                style={{
                  flex: 1,
                  background: activeSubPu === 1 ? 'rgba(0, 122, 255, 0.2)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  color: activeSubPu === 1 ? 'var(--system-blue)' : 'var(--apple-label)',
                }}
              >
                PU 1 ({cuSize}&times;{cuSize / 2})
              </div>
            </div>
          )}

          {/* INTER Nx2N (Vertical split 1:1) */}
          {partSize === 'Nx2N' && (
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
              <div
                onClick={() => onSelectSubPu && onSelectSubPu(0)}
                style={{
                  flex: 1,
                  borderRight: '0.5px solid var(--separator)',
                  background: activeSubPu === 0 ? 'rgba(0, 122, 255, 0.2)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  color: activeSubPu === 0 ? 'var(--system-blue)' : 'var(--apple-label)',
                }}
              >
                PU 0
              </div>
              <div
                onClick={() => onSelectSubPu && onSelectSubPu(1)}
                style={{
                  flex: 1,
                  background: activeSubPu === 1 ? 'rgba(0, 122, 255, 0.2)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  color: activeSubPu === 1 ? 'var(--system-blue)' : 'var(--apple-label)',
                }}
              >
                PU 1
              </div>
            </div>
          )}

          {/* INTER AMP: 2NxnU (Horizontal split 1:3) */}
          {partSize === '2NxnU' && (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
              <div style={{ height: '25%', borderBottom: '0.5px solid var(--separator)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontFamily: 'var(--font-mono)' }}>PU 0</div>
              <div style={{ height: '75%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontFamily: 'var(--font-mono)' }}>PU 1</div>
            </div>
          )}

          {/* INTER AMP: 2NxnD (Horizontal split 3:1) */}
          {partSize === '2NxnD' && (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
              <div style={{ height: '75%', borderBottom: '0.5px solid var(--separator)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontFamily: 'var(--font-mono)' }}>PU 0</div>
              <div style={{ height: '25%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontFamily: 'var(--font-mono)' }}>PU 1</div>
            </div>
          )}

          {/* INTER AMP: nLx2N (Vertical split 1:3) */}
          {partSize === 'nLx2N' && (
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
              <div style={{ width: '25%', borderRight: '0.5px solid var(--separator)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontFamily: 'var(--font-mono)' }}>PU 0</div>
              <div style={{ width: '75%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontFamily: 'var(--font-mono)' }}>PU 1</div>
            </div>
          )}

          {/* INTER AMP: nRx2N (Vertical split 3:1) */}
          {partSize === 'nRx2N' && (
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
              <div style={{ width: '75%', borderRight: '0.5px solid var(--separator)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontFamily: 'var(--font-mono)' }}>PU 0</div>
              <div style={{ width: '25%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontFamily: 'var(--font-mono)' }}>PU 1</div>
            </div>
          )}
        </div>

        {/* Informational Readout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
          <div style={{ color: 'var(--apple-label)', fontWeight: 600 }}>
            Active Partition: {partSize} {partSize === 'NxN' ? `(Sub-PU ${activeSubPu})` : ''}
          </div>
          <div style={{ color: 'var(--apple-label-secondary)', fontSize: '10px' }}>
            {!isInter ? (
              partSize === '2Nx2N'
                ? `Single PU covers full ${cuSize}×${cuSize} block.`
                : `4 Sub-PUs (${cuSize / 2}×${cuSize / 2}) in Morton Z-order.`
            ) : (
              interData
                ? `MV: (${interData.mv_x ?? 0}, ${interData.mv_y ?? 0}) • RefIdx: ${interData.ref_idx ?? 0}`
                : `HM-18.0 Motion Partition trial.`
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(PuPartitionGeometry);
