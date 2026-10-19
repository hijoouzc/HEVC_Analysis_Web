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
}) {
  const [selectedPuIdx, setSelectedPuIdx] = useState(0);

  const currentFrame = Array.isArray(frameGopData) && frameGopData.length > 0 ? frameGopData[0] : null;
  const isIntraSlice = currentFrame && currentFrame.slice_type === 'I';

  const hasData = Array.isArray(interSearchData) && interSearchData.length > 0;
  const activePu = hasData && selectedPuIdx < interSearchData.length ? interSearchData[selectedPuIdx] : (hasData ? interSearchData[0] : null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', boxSizing: 'border-box' }}>
      {/* Top Telemetry Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '10px',
          width: '100%',
        }}
      >
        <Card style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
            INTER ESTIMATION STATUS
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {hasData ? `${interSearchData.length} PUs Evaluated` : (isIntraSlice ? 'I-SLICE Anchor' : 'No Inter Records')}
            </span>
            <Badge variant={hasData ? 'blue' : 'gray'}>
              {hasData ? 'HM TEncSearch::predInterSearch' : 'Idle'}
            </Badge>
          </div>
        </Card>

        <Card style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
            ACTIVE PU MOTION VECTOR
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {activePu ? `(${activePu.mv_x}, ${activePu.mv_y})` : '(0, 0)'}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--apple-label-secondary)', fontFamily: 'var(--font-mono)' }}>
              1/4-pel precision
            </span>
          </div>
        </Card>

        <Card style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
            MOTION VECTOR DIFFERENCE (MVD)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {activePu ? `(${activePu.mvd_x}, ${activePu.mvd_y})` : '(0, 0)'}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--apple-label-secondary)', fontFamily: 'var(--font-mono)' }}>
              MVP Idx {activePu ? activePu.mvp_idx : 0}
            </span>
          </div>
        </Card>

        <Card style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
            CHOSEN REF PICTURE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {activePu ? `List ${activePu.ref_list} [Idx ${activePu.ref_idx}]` : 'None'}
            </span>
            {activePu && (
              <Badge variant="blue">
                Cost {Math.round(activePu.cost).toLocaleString()}
              </Badge>
            )}
          </div>
        </Card>
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
                  {interSearchData.map((pu, idx) => (
                    <TableRow
                      key={`pu-row-${idx}`}
                      selected={idx === selectedPuIdx}
                      onClick={() => setSelectedPuIdx(idx)}
                      style={{ cursor: 'pointer' }}
                    >
                      <TableCell style={{ fontFamily: 'var(--font-mono)' }}>PU #{pu.pu_idx}</TableCell>
                      <TableCell style={{ fontFamily: 'var(--font-mono)' }}>{pu.pu_w}×{pu.pu_h}</TableCell>
                      <TableCell style={{ fontFamily: 'var(--font-mono)' }}>L{pu.ref_list}[{pu.ref_idx}]</TableCell>
                      <TableCell style={{ fontFamily: 'var(--font-mono)' }}>({pu.mv_x}, {pu.mv_y})</TableCell>
                      <TableCell style={{ fontFamily: 'var(--font-mono)' }}>({pu.mvd_x}, {pu.mvd_y})</TableCell>
                      <TableCell style={{ fontFamily: 'var(--font-mono)' }}>#{pu.mvp_idx}</TableCell>
                      <TableCell align="right" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {Math.round(pu.cost).toLocaleString()}
                      </TableCell>
                      <TableCell align="right" style={{ fontFamily: 'var(--font-mono)' }}>{pu.bits}</TableCell>
                    </TableRow>
                  ))}
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
                  <span style={{ color: 'var(--apple-label-secondary)' }}>Motion Vector:</span>
                  <span style={{ fontWeight: 700, color: 'var(--apple-blue)' }}>({activePu.mv_x}, {activePu.mv_y})</span>
                </div>
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
