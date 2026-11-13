import React, { useState } from 'react';
import { Card, Badge, Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../apple';

/**
 * InterSearchVisualizer (CP_03_INTER_SEARCH)
 * Specializes in Inter Prediction, Motion Vector Field (MV, MVD), and AMVP candidate selection.
 * Design standard: Apple Pro-Grade, 100% English, no emoji icons, zero overflow.
 */
function InterSearchVisualizer({
  interSearchData = [],
  ctuX,
  ctuY,
  _selectedCu = null,
  frameGopData = [],
  selectedPoc = 0,
  onSelectPoc = null,
}) {
  const [selectedPuIdx, setSelectedPuIdx] = useState(0);

  const currentFrame = (Array.isArray(frameGopData) && frameGopData.length > 0)
    ? (frameGopData.find(f => f.poc === selectedPoc) || frameGopData[0])
    : null;
  const isIntraSlice = currentFrame && currentFrame.slice_type === 'I';

  const hasData = Array.isArray(interSearchData) && interSearchData.length > 0;
  const activePu = hasData && selectedPuIdx < interSearchData.length ? interSearchData[selectedPuIdx] : (hasData ? interSearchData[0] : null);
  const hasBiPredL1 = (pu) => Boolean(
    pu &&
    pu.ref_idx_l1 !== null &&
    pu.ref_idx_l1 !== undefined &&
    pu.ref_idx_l1 >= 0 &&
    pu.mv_x_l1 !== null &&
    pu.mv_x_l1 !== undefined &&
    pu.mv_y_l1 !== null &&
    pu.mv_y_l1 !== undefined
  );
  const activeHasL1 = hasBiPredL1(activePu);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', boxSizing: 'border-box' }}>
      {/* Compact Telemetry Ribbon (1-Line HUD, 34px) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px 12px',
          padding: '6px 12px',
          background: 'var(--fill-1)',
          border: '0.5px solid var(--separator)',
          borderRadius: '8px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          boxSizing: 'border-box',
        }}
      >
        {/* Metric 1: Inter Estimation Status + POC Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--apple-label-secondary)', fontWeight: 600 }}>INTER ESTIMATION STATUS:</span>
          {Array.isArray(frameGopData) && frameGopData.length > 1 && onSelectPoc && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              {frameGopData.map((frm) => {
                const isSelected = (currentFrame ? currentFrame.poc : 0) === frm.poc;
                return (
                  <button
                    key={`inter-poc-${frm.poc}`}
                    type="button"
                    onClick={() => onSelectPoc(frm.poc)}
                    style={{
                      height: '22px',
                      padding: '0 6px',
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: isSelected ? 700 : 500,
                      borderRadius: '4px',
                      border: '0.5px solid var(--separator)',
                      background: isSelected ? 'var(--system-blue)' : 'var(--fill-2)',
                      color: isSelected ? '#FFFFFF' : 'var(--apple-label)',
                      cursor: 'pointer',
                    }}
                  >
                    POC {frm.poc} ({frm.slice_type})
                  </button>
                );
              })}
            </div>
          )}
          <span style={{ fontWeight: 700, color: 'var(--apple-label)' }}>
            {hasData ? `${interSearchData.length} PUs Evaluated` : (isIntraSlice ? 'I-SLICE Anchor' : 'No Inter Records')}
          </span>
          <Badge variant={hasData ? 'blue' : 'gray'} style={{ fontSize: '9.5px', padding: '1px 5px' }}>
            {hasData ? (activeHasL1 ? 'Bi-Pred ME' : 'HM TEncSearch::predInterSearch') : 'Idle'}
          </Badge>
        </div>

        <span style={{ color: 'var(--separator)' }}>|</span>

        {/* Metric 2: Active PU Motion Vector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--apple-label-secondary)', fontWeight: 600 }}>ACTIVE PU MOTION VECTOR:</span>
          <span style={{ fontWeight: 700, color: 'var(--apple-label)' }}>
            {activePu
              ? (activeHasL1
                  ? `L0(${activePu.mv_x}, ${activePu.mv_y}) · L1(${activePu.mv_x_l1}, ${activePu.mv_y_l1})`
                  : `(${activePu.mv_x}, ${activePu.mv_y})`)
              : '(0, 0)'}
          </span>
          <span style={{ color: 'var(--apple-label-secondary)', fontSize: '10.5px' }}>
            1/4-pel precision
          </span>
        </div>

        <span style={{ color: 'var(--separator)' }}>|</span>

        {/* Metric 3: Motion Vector Difference (MVD) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--apple-label-secondary)', fontWeight: 600 }}>MVD:</span>
          <span style={{ fontWeight: 700, color: 'var(--apple-label)' }}>
            {activePu ? `(${activePu.mvd_x}, ${activePu.mvd_y})` : '(0, 0)'}
          </span>
          <span style={{ color: 'var(--apple-label-secondary)', fontSize: '10.5px' }}>
            MVP Idx {activePu ? activePu.mvp_idx : 0}
          </span>
        </div>

        <span style={{ color: 'var(--separator)' }}>|</span>

        {/* Metric 4: Chosen Ref Picture */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--apple-label-secondary)', fontWeight: 600 }}>REF:</span>
          <span style={{ fontWeight: 700, color: 'var(--apple-label)' }}>
            {activePu ? `List ${activePu.ref_list} [Idx ${activePu.ref_idx}]` : 'None'}
          </span>
          {activePu && (
            <Badge variant="blue" style={{ fontSize: '9.5px', padding: '1px 5px' }}>
              Cost {Math.round(activePu.cost).toLocaleString()}
            </Badge>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {!hasData ? (
        <Card style={{ padding: '28px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--apple-label-primary)' }}>
            Inter Prediction is Inactive for Frame POC {currentFrame ? currentFrame.poc : 0}
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--apple-label-secondary)',
              marginTop: '6px',
              maxWidth: '560px',
              margin: '6px auto 0',
              lineHeight: 1.5,
              fontFamily: 'var(--font-mono)',
            }}
          >
            The current picture is encoded as an I-SLICE where all coding units use Intra spatial prediction.
            Inter prediction (TZSearch, Fractional Pel 8-tap interpolation, and AMVP) executes on P-slices and B-slices (POC 1+).
          </div>
          <div
            style={{
              marginTop: '16px',
              display: 'inline-flex',
              padding: '8px 16px',
              background: 'var(--fill-4)',
              borderRadius: '6px',
              border: '0.5px solid var(--separator)',
              fontSize: '11.5px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--apple-label-tertiary)',
            }}
          >
            Standard Hook: TEncSearch::predInterSearch() &bull; Inter Prediction
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '12px', width: '100%' }}>
          {/* Table of Evaluated PUs */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '0.5px solid var(--separator)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Evaluated Prediction Units (PUs)</span>
              <span style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
                Target CTU ({ctuX}, {ctuY})
              </span>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '380px' }}>
              <Table striped>
                <TableHeader>
                  <TableRow>
                    <TableHead>PU Index</TableHead>
                    <TableHead>PU Size (samples)</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead>MV (x, y)</TableHead>
                    <TableHead>MVD (x, y)</TableHead>
                    <TableHead>MVP</TableHead>
                    <TableHead align="right">Cost</TableHead>
                    <TableHead align="right">Bits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {interSearchData.map((pu, idx) => {
                    const rowHasL1 = hasBiPredL1(pu);
                    return (
                      <TableRow
                        key={`pu-row-${idx}`}
                        selected={idx === selectedPuIdx}
                        onClick={() => setSelectedPuIdx(idx)}
                        style={{ cursor: 'pointer' }}
                      >
                        <TableCell style={{ fontFamily: 'var(--font-mono)' }}>PU #{pu.pu_idx}</TableCell>
                        <TableCell style={{ fontFamily: 'var(--font-mono)' }}>{pu.pu_w}×{pu.pu_h}</TableCell>
                        <TableCell style={{ fontFamily: 'var(--font-mono)' }}>
                          L{pu.ref_list}[{pu.ref_idx}]{rowHasL1 ? ` + L1[${pu.ref_idx_l1}]` : ''}
                        </TableCell>
                        <TableCell style={{ fontFamily: 'var(--font-mono)' }}>
                          {rowHasL1 ? `(${pu.mv_x},${pu.mv_y}) / (${pu.mv_x_l1},${pu.mv_y_l1})` : `(${pu.mv_x}, ${pu.mv_y})`}
                        </TableCell>
                        <TableCell style={{ fontFamily: 'var(--font-mono)' }}>({pu.mvd_x}, {pu.mvd_y})</TableCell>
                        <TableCell style={{ fontFamily: 'var(--font-mono)' }}>#{pu.mvp_idx}</TableCell>
                        <TableCell align="right" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {Math.round(pu.cost).toLocaleString()}
                        </TableCell>
                        <TableCell align="right" style={{ fontFamily: 'var(--font-mono)' }}>{pu.bits}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Active PU Details Card */}
          <Card style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, borderBottom: '0.5px solid var(--separator)', paddingBottom: '8px' }}>
              PU Motion Vector Inspector
            </div>

            {activePu ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--apple-label-secondary)' }}>Partition Offset:</span>
                  <span>({activePu.pu_x}, {activePu.pu_y})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--apple-label-secondary)' }}>PU Dimensions:</span>
                  <span>{activePu.pu_w}×{activePu.pu_h} samples</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--apple-label-secondary)' }}>Reference List:</span>
                  <span>REF_PIC_LIST_{activePu.ref_list}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--apple-label-secondary)' }}>Ref Picture Index:</span>
                  <span>{activePu.ref_idx}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--apple-label-secondary)' }}>MVP Candidate:</span>
                  <span>Candidate #{activePu.mvp_idx}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--apple-label-secondary)' }}>Motion Vector (L0):</span>
                  <span style={{ fontWeight: 700, color: 'var(--apple-blue)' }}>({activePu.mv_x}, {activePu.mv_y})</span>
                </div>
                {activeHasL1 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--apple-label-secondary)' }}>Motion Vector (L1):</span>
                      <span style={{ fontWeight: 700, color: 'var(--system-green)' }}>({activePu.mv_x_l1}, {activePu.mv_y_l1})</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--apple-label-secondary)' }}>Ref Picture Index (L1):</span>
                      <span>REF_PIC_LIST_1 [{activePu.ref_idx_l1}]</span>
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--apple-label-secondary)' }}>Delta MV (MVD):</span>
                  <span>({activePu.mvd_x}, {activePu.mvd_y})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--apple-label-secondary)' }}>Lagrange Cost:</span>
                  <span style={{ color: 'var(--system-green)', fontWeight: 600 }}>{Math.round(activePu.cost).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--apple-label-secondary)' }}>MVD Cabac Bits:</span>
                  <span>{activePu.bits} bits</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
                Select a PU from the table to inspect.
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

export default React.memo(InterSearchVisualizer);
