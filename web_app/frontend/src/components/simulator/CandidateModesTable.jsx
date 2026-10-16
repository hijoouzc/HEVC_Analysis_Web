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
  const hasData = Boolean(evaluations && evaluations.length > 0);

  return (
    <Card style={{
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      height: '210px',
      minHeight: '210px',
      maxHeight: '210px',
      boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--apple-label)' }}>
          Candidate Modes ({size}×{size})
        </span>
        {hasData ? (
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--apple-label-2)',
            }}
          >
            {evaluations.length} evaluated
          </span>
        ) : (
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--apple-label-3)',
            }}
          >
            Split CU (Evaluated)
          </span>
        )}
      </div>

      {hasData ? (
        <div style={{ height: '150px', minHeight: '150px', maxHeight: '150px', overflowY: 'auto' }}>
          <Table striped>
            <TableHeader>
              <tr>
                <TableHead>Mode</TableHead>
                <TableHead align="right">Distortion (D)</TableHead>
                <TableHead align="right">Coeffs</TableHead>
                <TableHead align="right" title="HM RDO Rate Estimate: (J - D) / λ">Rate Est (R)</TableHead>
                <TableHead align="right">Cost (J)</TableHead>
                <TableHead align="center">Rank</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {evaluations.map((ev, idx) => {
                const isWinner = ev.is_winner ?? (idx === 0);
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
                    <TableCell align="right">{ev.bits !== undefined ? `${ev.bits} b` : '---'}</TableCell>
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
        </div>
      ) : (
        <div style={{
          height: '150px',
          minHeight: '150px',
          maxHeight: '150px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          border: '0.5px dashed var(--separator)',
          borderRadius: '6px',
          background: 'var(--fill-4)',
          color: 'var(--apple-label-secondary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '11.5px',
          textAlign: 'center',
          padding: '12px',
          boxSizing: 'border-box'
        }}>
          <span style={{ fontWeight: 600, color: 'var(--apple-label)' }}>RDO Candidate Evaluation Inactive</span>
          <span style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', maxWidth: '380px' }}>
            Current execution node is evaluating QuadTree partitioning (Non-Split vs Split sub-CUs). Mode trials occur inside leaf CUs.
          </span>
        </div>
      )}
    </Card>
  );
}
