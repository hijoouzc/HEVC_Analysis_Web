import React, { useMemo, useState } from 'react';
import { TransformQuantVisualizer } from '../stages/cp04_transform_quant';
import { Badge, SegmentedControl } from '../apple';

/**
 * Step3ResidualTu (Guided Flow Step 3)
 * Spatial Residual R(x,y) + Transform RQT Hierarchy & Frequency Domain C(u,v), Q(u,v).
 * Enforces mathematically correct separation of Spatial vs Frequency domains.
 */
export function Step3ResidualTu({
  transformData,
  quantData,
  ctuX,
  ctuY,
  selectedCu,
  currentMode,
  data,
  _onProceedToRecon = null,
  _onProceedToRdo = null,
  channel: propsChannel = undefined,
  onSelectChannel = null,
  showValues = undefined,
}) {
  const [activeDomainView, setActiveDomainView] = useState('full'); // 'full' | 'spatial' | 'frequency'
  const [internalChannel, setInternalChannel] = useState('Y'); // 'Y' | 'Cb' | 'Cr'
  const channel = propsChannel !== undefined ? propsChannel : internalChannel;
  const setChannel = onSelectChannel || setInternalChannel;

  // Filter Forward Transform records (records with populated residual array)
  const forwardTransformRecords = useMemo(() => {
    if (!transformData || !Array.isArray(transformData)) return [];
    return transformData.filter(
      (t) => (t.residual && t.residual.length > 0) || (t.resi_matrix && t.resi_matrix.length > 0)
    );
  }, [transformData]);

  // Check if mapping is unique or ambiguous
  const targetMode = currentMode?.mode ?? selectedCu?.intra_dir;
  const isAmbiguous = useMemo(() => {
    if (!selectedCu || !forwardTransformRecords.length || targetMode === undefined || targetMode === null) return false;
    const matches = forwardTransformRecords.filter((t) => t.intra_mode === targetMode);
    return matches.length > 4;
  }, [selectedCu, forwardTransformRecords, targetMode]);

  const activeRecords = forwardTransformRecords.length > 0 ? forwardTransformRecords : transformData;
  const primaryRecord = activeRecords?.[0] || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Controls: Chroma Channel Switcher & Domain Mode Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {primaryRecord && (
            <Badge variant="blue" style={{ fontSize: '10px' }} title={`Quantization Step: Qstep = 2^((QP-4)/6)`}>
              QP {primaryRecord.qp} (Qstep: {Math.pow(2, (primaryRecord.qp - 4) / 6).toFixed(2)})
            </Badge>
          )}

          {/* Chroma Channel Switcher [ Y | Cb | Cr ] - Only render when uncontrolled */}
          {!onSelectChannel && (
            <div style={{ display: 'flex', gap: '3px' }}>
              {['Y', 'Cb', 'Cr'].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannel(ch)}
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: channel === ch ? 'var(--system-blue)' : 'var(--fill-2)',
                    color: channel === ch ? '#FFFFFF' : 'var(--apple-label)',
                    border: '0.5px solid var(--separator)',
                    cursor: 'pointer',
                    fontWeight: channel === ch ? 700 : 500,
                  }}
                >
                  {ch}
                </button>
              ))}
            </div>
          )}
        </div>

        <SegmentedControl
          value={activeDomainView}
          onChange={setActiveDomainView}
          size="small"
          items={[
            { id: 'full', label: 'Unified RQT Explorer' },
            { id: 'tree', label: 'RQT Geometric Tree' },
            { id: 'spatial', label: 'Spatial Domain: S - P = R' },
            { id: 'frequency', label: 'Frequency Domain: C & Q' },
          ]}
        />
      </div>

      {/* Ambiguous Mapping Notification Banner */}
      {isAmbiguous && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Badge variant="yellow" style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
            [AMBIGUOUS MAPPING NOTICE]: Mode {targetMode} has multiple trials. Displaying primary forward transform record.
          </Badge>
        </div>
      )}

      {/* Domain Separation Quick Badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ padding: '3px 8px', borderRadius: '4px', background: 'var(--fill-1)', border: '0.5px solid var(--separator)', fontSize: '10.5px', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--apple-blue)', fontWeight: 700 }}>SPATIAL DOMAIN (x, y): </span>
          <span style={{ color: 'var(--apple-label-secondary)' }}>Matrices S, P, R</span>
        </div>
        <div style={{ padding: '3px 8px', borderRadius: '4px', background: 'var(--fill-1)', border: '0.5px solid var(--separator)', fontSize: '10.5px', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--system-purple)', fontWeight: 700 }}>FREQUENCY DOMAIN (u, v): </span>
          <span style={{ color: 'var(--apple-label-secondary)' }}>DCT/DST &amp; Quantized Levels</span>
        </div>
      </div>

      {/* Main Transform Visualizer */}
      <div className="stage-section-card">
        <TransformQuantVisualizer
          transformData={activeRecords}
          quantData={quantData}
          ctuX={ctuX}
          ctuY={ctuY}
          targetTuX={selectedCu?.x ?? null}
          targetTuY={selectedCu?.y ?? null}
          targetCuX={selectedCu?.abs_x ?? selectedCu?.x ?? null}
          targetCuY={selectedCu?.abs_y ?? selectedCu?.y ?? null}
          targetCuSize={selectedCu?.width ?? null}
          selectedCu={selectedCu}
          initialViewLayout={activeDomainView === 'tree' ? 'tree' : 'dual'}
          channel={channel}
          onSelectChannel={setChannel}
          showValues={showValues}
        />
      </div>

      {/* Candidate Modes RDO Leaderboard */}
      {data && data.length > 0 && (
        <div className="stage-section-card" style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--apple-label)' }}>
              Candidate Modes RDO Leaderboard &bull; Evaluated via xRecurIntraCodingLumaQT
            </span>
            <Badge variant="green" style={{ fontSize: '9px' }}>
              HM TRACE: Ranked by Min Cost
            </Badge>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '6px',
            }}
          >
            {data.slice(0, 8).map((m, idx) => {
              const isSelected = (currentMode?.mode === m.mode);
              const isWinner = idx === 0;
              return (
                <div
                  key={m.mode}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '5px',
                    border: isSelected ? '1px solid var(--system-blue)' : '0.5px solid var(--separator)',
                    background: isSelected ? 'var(--fill-2)' : 'var(--fill-1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--apple-label)' }}>
                      Mode {m.mode}
                    </span>
                    {isWinner && (
                      <Badge variant="green" style={{ fontSize: '8.5px', padding: '0 4px' }}>
                        Winner
                      </Badge>
                    )}
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    Cost: {Number(m.cost).toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(Step3ResidualTu);
