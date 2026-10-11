import React from 'react';
import {
  Card,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../apple';

/**
 * CandidateModesTable
 * Compact tabular comparison of evaluated Intra modes.
 * Displays SSD distortion, transform coefficient count, entropy bit estimate, and RDO cost J.
 * 100% compliant with Apple HIG macOS Tahoe table specifications.
 */
export default function CandidateModesTable({ size, evaluations }) {
  if (!evaluations || evaluations.length === 0) return null;

  return (
    <Card style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--apple-label)' }}>
          Candidate Modes ({size}×{size})
        </span>
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--apple-label-2)',
          }}
        >
          {evaluations.length} evaluated
        </span>
      </div>

      <Table striped>
        <TableHeader>
          <tr>
            <TableHead>Mode</TableHead>
            <TableHead align="right">SSD (D)</TableHead>
            <TableHead align="right">Coeffs</TableHead>
            <TableHead align="right">Rate (R)</TableHead>
            <TableHead align="right">Cost (J)</TableHead>
            <TableHead align="center">Rank</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {evaluations.map((ev, idx) => {
            const isWinner = idx === 0;
            return (
              <TableRow
                key={ev.mode}
                selected={isWinner}
                style={{
                  backgroundColor: isWinner ? 'rgba(52, 199, 89, 0.12)' : undefined,
                }}
              >
                <TableCell style={{ fontWeight: isWinner ? 700 : 500, color: 'var(--apple-label)' }}>
                  {ev.modeName}
                </TableCell>
                <TableCell align="right">{ev.ssd.toLocaleString()}</TableCell>
                <TableCell align="right">{ev.nonzeroCount}</TableCell>
                <TableCell align="right">{ev.bits}</TableCell>
                <TableCell
                  align="right"
                  style={{
                    fontWeight: 700,
                    color: isWinner ? 'var(--system-green)' : 'var(--apple-label)',
                  }}
                >
                  {Math.round(ev.cost).toLocaleString()}
                </TableCell>
                <TableCell align="center">
                  {isWinner ? (
                    <Badge variant="green" style={{ fontSize: '10px', padding: '1px 6px' }}>
                      Best
                    </Badge>
                  ) : (
                    <span style={{ color: 'var(--apple-label-3)', fontSize: '11px' }}>
                      #{idx + 1}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
