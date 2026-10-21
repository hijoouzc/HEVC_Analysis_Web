import React, { useState, useMemo } from 'react';
import { Card, Badge, Table, TableHeader, TableHead, TableBody, TableRow, TableCell, Progress } from '../../../apple';

/**
 * SyntaxBreakdownTable
 * Displays filterable stream of CABAC bins and bitrate percentage allocation.
 */
const SyntaxBreakdownTable = ({ bins = [], breakdown = {}, totalBits = 0 }) => {
  const [filterSyntax, setFilterSyntax] = useState('ALL');

  const filteredBins = useMemo(() => {
    return filterSyntax === 'ALL'
      ? bins
      : bins.filter((b) => b.syntax_element === filterSyntax);
  }, [bins, filterSyntax]);

  const syntaxElements = useMemo(() => Object.keys(breakdown), [breakdown]);

  return (
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
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Syntax Element Bin Stream</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
              Filter:
            </span>
            <select
              value={filterSyntax}
              onChange={(e) => setFilterSyntax(e.target.value)}
              className="apple-select-control"
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                padding: '2px 6px',
                height: '24px',
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

        <div style={{ overflowX: 'auto', maxHeight: '440px' }}>
          <Table striped>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Syntax Element</TableHead>
                <TableHead>Bin</TableHead>
                <TableHead>ctxIdx</TableHead>
                <TableHead>pStateIdx</TableHead>
                <TableHead>valMPS</TableHead>
                <TableHead align="right">Bits</TableHead>
              </TableRow>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '420px' }}>
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
  );
};

export default React.memo(SyntaxBreakdownTable);
