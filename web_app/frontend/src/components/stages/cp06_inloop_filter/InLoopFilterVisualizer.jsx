import React, { useState } from 'react';
import { Card, Badge, Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../apple';

/**
 * InLoopFilterVisualizer (CP_06_INLOOP_FILTER)
 * Specializes in Deblocking Filter (DBF) edge profiles (bS, beta, tC, p/q)
 * and Sample Adaptive Offset (SAO) classification modes.
 * Design standard: Apple Pro-Grade, 100% English, no emoji icons, zero overflow.
 */
function InLoopFilterVisualizer({
  inloopFilterData,
  ctuX,
  ctuY,
}) {
  const [selectedEdgeIdx, setSelectedEdgeIdx] = useState(0);

  const edges = inloopFilterData?.edges || [];
  const sao = inloopFilterData?.sao;
  const hasEdges = edges.length > 0;
  const activeEdge = hasEdges && selectedEdgeIdx < edges.length ? edges[selectedEdgeIdx] : (hasEdges ? edges[0] : null);

  const getSaoModeName = (mode) => {
    switch (mode) {
      case 0: return 'None (Off)';
      case 1: return 'Band Offset (BO)';
      case 2: return 'Edge Offset 0° (EO_0)';
      case 3: return 'Edge Offset 90° (EO_90)';
      case 4: return 'Edge Offset 135° (EO_135)';
      case 5: return 'Edge Offset 45° (EO_45)';
      default: return `Mode ${mode}`;
    }
  };

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
        {/* Metric 1: DBF Edges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--apple-label-secondary)', fontWeight: 600 }}>DEBLOCKING FILTER (DBF):</span>
          <span style={{ fontWeight: 700, color: 'var(--apple-label)' }}>{edges.length} Edges</span>
          <Badge variant={inloopFilterData?.bs2_edges > 0 ? 'orange' : (edges.length > 0 ? 'blue' : 'gray')} style={{ fontSize: '9.5px', padding: '1px 5px' }}>
            {inloopFilterData?.bs2_edges > 0 ? `${inloopFilterData.bs2_edges} Strong (bS=2)` : (edges.length > 0 ? `${edges.length} Normal (bS=1)` : 'No 8×8 Edges')}
          </Badge>
        </div>

        <span style={{ color: 'var(--separator)' }}>|</span>

        {/* Metric 2: SAO CTU Decision */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--apple-label-secondary)', fontWeight: 600 }}>SAO CTU DECISION:</span>
          <span style={{ fontWeight: 700, color: 'var(--apple-label)' }}>{sao ? getSaoModeName(sao.sao_mode) : 'Off (Mode 0)'}</span>
          <Badge variant={sao && sao.sao_mode > 0 ? 'green' : 'gray'} style={{ fontSize: '9.5px', padding: '1px 5px' }}>
            {sao && sao.sao_mode > 0 ? 'Active' : 'Bypass'}
          </Badge>
        </div>

        <span style={{ color: 'var(--separator)' }}>|</span>

        {/* Metric 3: Active Edge bS & Thresholds */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--apple-label-secondary)', fontWeight: 600 }}>ACTIVE EDGE:</span>
          <span style={{ fontWeight: 700, color: 'var(--apple-label)' }}>bS={activeEdge ? activeEdge.bs : 0}</span>
          <span style={{ color: 'var(--apple-label-secondary)', fontSize: '10.5px' }}>
            (β={activeEdge ? activeEdge.beta : 0}, tC={activeEdge ? activeEdge.tc : 0})
          </span>
        </div>

        <span style={{ color: 'var(--separator)' }}>|</span>

        {/* Metric 4: SAO Sample Offsets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--apple-label-secondary)', fontWeight: 600 }}>OFFSETS:</span>
          <span style={{ color: 'var(--apple-label)', fontWeight: 600 }}>
            Y: [{sao?.offset_y?.join(', ') || '0, 0, 0, 0'}]
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '12px', width: '100%' }}>
        {/* Left Column: Edge List Table & Cross-Section Plot */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Boundary Cross-Section Plot */}
          <Card style={{ padding: '14px', minHeight: '190px', boxSizing: 'border-box' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              Boundary Sample Cross-Section (p3..p0 | q0..q3)
            </div>

            {activeEdge && activeEdge.p_before && activeEdge.q_before ? (
              <BoundaryPlot
                pBefore={activeEdge.p_before}
                qBefore={activeEdge.q_before}
                pAfter={activeEdge.p_after}
                qAfter={activeEdge.q_after}
              />
            ) : (
              <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                No active 8×8 deblocking edge selected in current CTU.
              </div>
            )}
          </Card>

          {/* Table of Deblocking Edges */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--separator)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>8×8 Boundary Filter Records</span>
              <span style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
                CTU ({ctuX}, {ctuY})
              </span>
            </div>

            {hasEdges ? (
              <div style={{ overflowX: 'auto', maxHeight: '240px' }}>
                <Table striped>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Edge Origin</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Strength (bS)</TableHead>
                      <TableHead>Threshold β</TableHead>
                      <TableHead>Threshold tC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {edges.map((edge, idx) => (
                      <TableRow
                        key={`edge-${idx}`}
                        selected={idx === selectedEdgeIdx}
                        onClick={() => setSelectedEdgeIdx(idx)}
                        style={{ cursor: 'pointer' }}
                      >
                        <TableCell style={{ fontFamily: 'var(--font-mono)' }}>({edge.edge_x}, {edge.edge_y})</TableCell>
                        <TableCell style={{ fontFamily: 'var(--font-mono)' }}>
                          {edge.dir === 0 ? 'Vertical' : 'Horizontal'}
                        </TableCell>
                        <TableCell style={{ fontFamily: 'var(--font-mono)' }}>
                          <Badge variant={edge.bs === 2 ? 'orange' : 'blue'}>
                            bS = {edge.bs}
                          </Badge>
                        </TableCell>
                        <TableCell style={{ fontFamily: 'var(--font-mono)' }}>{edge.beta}</TableCell>
                        <TableCell style={{ fontFamily: 'var(--font-mono)' }}>{edge.tc}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--apple-label-secondary)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                No 8×8 boundary edges found in CTU ({ctuX}, {ctuY}). Deblocking operates on edges of split sub-CUs.
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: SAO Analysis Card */}
        <Card style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, borderBottom: '0.5px solid var(--separator)', paddingBottom: '8px' }}>
            Sample Adaptive Offset (SAO) Details
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--apple-label-secondary)' }}>Selected SAO Mode:</span>
              <span style={{ fontWeight: 600 }}>{sao ? getSaoModeName(sao.sao_mode) : 'Mode 0 (Off)'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--apple-label-secondary)' }}>Luma (Y) Offsets:</span>
              <span>[{sao?.offset_y?.join(', ') || '0, 0, 0, 0'}]</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--apple-label-secondary)' }}>Chroma (Cb) Offsets:</span>
              <span>[{sao?.offset_u?.join(', ') || '0, 0, 0, 0'}]</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--apple-label-secondary)' }}>Chroma (Cr) Offsets:</span>
              <span>[{sao?.offset_v?.join(', ') || '0, 0, 0, 0'}]</span>
            </div>

            <div
              style={{
                marginTop: '12px',
                padding: '10px',
                background: 'var(--fill-4)',
                borderRadius: '6px',
                border: '0.5px solid var(--separator)',
                fontSize: '11px',
                color: 'var(--apple-label-tertiary)',
                lineHeight: 1.4,
              }}
            >
              In-Loop Filters:
              <br />&bull; DBF: Deblocking Filter (bS)
              <br />&bull; SAO: Sample Adaptive Offset
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

const BoundaryPlot = React.memo(function BoundaryPlot({ pBefore, qBefore, pAfter, qAfter }) {
  // Combine 4 samples from p (reversed: p3, p2, p1, p0) and 4 samples from q (q0, q1, q2, q3)
  const pre = [...pBefore.slice().reverse(), ...qBefore];
  const post = [...pAfter.slice().reverse(), ...qAfter];

  const minVal = Math.min(...pre, ...post, 0);
  const maxVal = Math.max(...pre, ...post, 255);
  const range = Math.max(1, maxVal - minVal);

  const W = 460;
  const H = 140;
  const pad = 30;

  const getX = (idx) => pad + (idx / 7) * (W - 2 * pad);
  const getY = (val) => H - pad - ((val - minVal) / range) * (H - 2 * pad);

  const prePoints = pre.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');
  const postPoints = post.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');

  const labels = ['p3', 'p2', 'p1', 'p0', 'q0', 'q1', 'q2', 'q3'];

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg width={W} height={H} style={{ display: 'block', margin: '0 auto', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
        {/* Boundary Center Line */}
        <line
          x1={(getX(3) + getX(4)) / 2}
          y1={pad - 10}
          x2={(getX(3) + getX(4)) / 2}
          y2={H - pad + 10}
          stroke="var(--separator)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        {/* Pre-filter Polyline (Gray dashed) */}
        <polyline
          fill="none"
          stroke="var(--apple-label-tertiary)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          points={prePoints}
        />

        {/* Post-filter Polyline (Blue solid) */}
        <polyline
          fill="none"
          stroke="var(--apple-blue)"
          strokeWidth="2"
          points={postPoints}
        />

        {/* Sample Point Circles & Labels */}
        {labels.map((lbl, i) => (
          <g key={`lbl-${i}`}>
            <circle cx={getX(i)} cy={getY(post[i])} r="3" fill="var(--apple-blue)" />
            <text x={getX(i)} y={H - 8} textAnchor="middle" fill="var(--apple-label-secondary)">
              {lbl}
            </text>
            <text x={getX(i)} y={getY(post[i]) - 6} textAnchor="middle" fill="var(--apple-label-primary)" fontWeight="600">
              {post[i]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
});

export default React.memo(InLoopFilterVisualizer);
