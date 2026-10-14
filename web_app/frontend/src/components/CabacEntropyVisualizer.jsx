import React, { useState } from 'react';
import { Card, Badge, Table, TableHeader, TableHead, TableBody, TableRow, TableCell, Progress } from './apple';

/**
 * CabacEntropyVisualizer (CP_07_CABAC_ENTROPY)
 * Specializes in Bitstream Syntax Elements, Context Modeling (ctxIdx),
 * Finite State Machine probability transition (pStateIdx, valMPS), and Bitrate Allocation Breakdown.
 * Design standard: Apple Pro-Grade, 100% English, no emoji icons, zero overflow.
 */
export default function CabacEntropyVisualizer({
  cabacEntropyData,
  _ctuX,
  _ctuY,
}) {
  const [filterSyntax, setFilterSyntax] = useState('ALL');

  const bins = cabacEntropyData?.bins || [];
  const totalBins = cabacEntropyData?.total_bins || bins.length;
  const totalBits = cabacEntropyData?.total_bits || bins.reduce((sum, b) => sum + (b.bits || 1), 0);
  const breakdown = cabacEntropyData?.syntax_breakdown || {};

  const filteredBins = filterSyntax === 'ALL'
    ? bins
    : bins.filter((b) => b.syntax_element === filterSyntax);

  const syntaxElements = Object.keys(breakdown);

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
            TOTAL CABAC BINS
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {totalBins.toLocaleString()} Bins
            </span>
            <Badge variant="blue">HM TEncSbac</Badge>
          </div>
        </Card>

        <Card style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
            ENCODED BITSTREAM
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {totalBits.toLocaleString()} Bits
            </span>
            <span style={{ fontSize: '12px', color: 'var(--apple-label-secondary)', fontFamily: 'var(--font-mono)' }}>
              ({(totalBits / 8).toFixed(1)} Bytes)
            </span>
          </div>
        </Card>

        <Card style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
            SYNTAX ELEMENT DIVERSITY
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {syntaxElements.length} Types
            </span>
            <span style={{ fontSize: '12px', color: 'var(--apple-label-secondary)', fontFamily: 'var(--font-mono)' }}>
              in active window
            </span>
          </div>
        </Card>

        <Card style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
            CABAC FSM MODEL
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--apple-label-secondary)', fontFamily: 'var(--font-mono)' }}>
              63 States (0..62) &bull; MPS/LPS
            </span>
          </div>
        </Card>
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '12px', width: '100%' }}>
        {/* Left Column: Bins Stream Table */}
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
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Syntax Element Bin Transitions</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
                Filter:
              </span>
              <select
                value={filterSyntax}
                onChange={(e) => setFilterSyntax(e.target.value)}
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--fill-3)',
                  border: '0.5px solid var(--separator)',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  color: 'var(--apple-label-primary)',
                }}
              >
                <option value="ALL">All ({bins.length})</option>
                {syntaxElements.map((s) => (
                  <option key={`opt-${s}`} value={s}>
                    {s} ({breakdown[s]} bits)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
            <Table striped>
              <TableHeader>
                <TableHead>#</TableHead>
                <TableHead>Syntax Element</TableHead>
                <TableHead>Bin</TableHead>
                <TableHead>ctxIdx</TableHead>
                <TableHead>pStateIdx (0..62)</TableHead>
                <TableHead>valMPS</TableHead>
                <TableHead align="right">Bits</TableHead>
              </TableHeader>
              <TableBody>
                {filteredBins.map((b, idx) => (
                  <TableRow key={`bin-row-${idx}`}>
                    <TableCell style={{ fontFamily: 'var(--font-mono)', color: 'var(--apple-label-tertiary)' }}>
                      {idx + 1}
                    </TableCell>
                    <TableCell style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--apple-blue)' }}>
                      {b.syntax_element}
                    </TableCell>
                    <TableCell style={{ fontFamily: 'var(--font-mono)' }}>
                      <Badge variant={b.bin === 1 ? 'blue' : 'gray'}>
                        {b.bin}
                      </Badge>
                    </TableCell>
                    <TableCell style={{ fontFamily: 'var(--font-mono)' }}>{b.ctx_idx}</TableCell>
                    <TableCell style={{ fontFamily: 'var(--font-mono)' }}>{b.p_state_idx}</TableCell>
                    <TableCell style={{ fontFamily: 'var(--font-mono)' }}>{b.val_mps}</TableCell>
                    <TableCell align="right" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {b.bits}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Right Column: Bitrate Allocation Breakdown */}
        <Card style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, borderBottom: '0.5px solid var(--separator)', paddingBottom: '8px' }}>
            Bitrate Allocation Breakdown
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '400px' }}>
            {syntaxElements.map((elem) => {
              const bits = breakdown[elem];
              const pct = totalBits > 0 ? (bits / totalBits) * 100 : 0;
              return (
                <div key={`breakdown-${elem}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--apple-label-primary)' }}>{elem}</span>
                    <span style={{ color: 'var(--apple-label-secondary)' }}>
                      {bits} bits ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress value={pct} max={100} style={{ height: '4px' }} />
                </div>
              );
            })}

            {syntaxElements.length === 0 && (
              <div style={{ fontSize: '12px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '16px' }}>
                No syntax element breakdown available.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
