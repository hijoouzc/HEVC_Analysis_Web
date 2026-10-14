import React from 'react';
import { Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../apple';
import { getIntraModeInfo } from '../../utils/colorUtils';

/**
 * StageDetailSection
 * Comprehensive mathematical drilldown for Stages 01 to 04 of the HEVC Intra Pipeline:
 *  - Stage 01: Boundary Sample Preparation & Availability / Padding
 *  - Stage 02: Mode-Dependent Intra Smoothing (MDIS 3-tap [1, 2, 1]/4)
 *  - Stage 03: Angular / Planar / DC Fractional Projection Mathematics
 *  - Stage 04: Full 35-Mode RDO Competition Leaderboard
 */
const StageDetailSection = ({
  activeTab,
  channel,
  selectedMode,
  modeInfo,
  N,
  ctuX,
  ctuY,
  refTopRaw = [],
  refLeftRaw = [],
  refTopFilt = [],
  refLeftFilt = [],
  refTopActive = [],
  isMDISSmoothed = false,
  hasEdgeFilter = false,
  angle = 0,
  modesData = [],
  onSelectModeIndex = null,
  getSampleColor,
}) => {
  if (activeTab === 'all') return null;

  // ---------------------------------------------------------------------------
  // STAGE 01: Reference Sample Preparation & Availability / Padding
  // ---------------------------------------------------------------------------
  if (activeTab === 'step1') {
    const totalRefSamples = 4 * N + 1;
    const isBoundaryCTU = ctuX === 0 || ctuY === 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Card style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--apple-blue)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Stage 01: Reference Samples
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '2px 0 0 0', color: 'var(--apple-label)' }}>
                Boundary Sample Fetching & Substitution ({channel === 'Y' ? 'Luma' : channel === 'U' ? 'Cb' : 'Cr'})
              </h3>
            </div>
            <Badge variant="blue" style={{ fontFamily: 'var(--font-mono)' }}>
              {totalRefSamples} Samples (4N + 1)
            </Badge>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--apple-label-secondary)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
            Per <strong>ITU-T H.265 Section 8.4.4.2.2</strong>, HEVC collects <strong>4N + 1</strong> reconstructed reference samples framing the {N}×{N} block:
            1 Top-Left corner, 2N ({2 * N}) Top samples, and 2N ({2 * N}) Left samples.
            If any boundary samples are unavailable (e.g. at picture borders), HM applies padding substitution from the nearest available neighbor.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {/* Top Reference Row */}
            <div style={{ background: 'var(--apple-canvas)', padding: '14px', borderRadius: '8px', border: '1px solid var(--apple-hairline)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--apple-label)' }}>
                  Top Reference Row ({2 * N + 1} Samples)
                </span>
                <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--apple-label-secondary)' }}>
                  p[x, -1], x ∈ [-1, {2 * N - 1}]
                </span>
              </div>

              <div style={{ display: 'flex', gap: '2px', overflowX: 'auto', paddingBottom: '6px' }}>
                {refTopRaw.slice(0, 2 * N + 1).map((val, idx) => {
                  const { bg, color, border } = getSampleColor(val);
                  const isCorner = idx === 0;
                  const isExtended = idx > N;
                  return (
                    <div
                      key={`top-samp-${idx}`}
                      style={{
                        minWidth: '24px',
                        height: '32px',
                        background: bg,
                        color: color,
                        border: border || (isCorner ? '1.5px solid var(--apple-label)' : '1px solid #64748B'),
                        borderRadius: '3px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        fontWeight: 700,
                        boxSizing: 'border-box'
                      }}
                      title={`Top Sample x=${idx - 1} = ${val} (${isCorner ? 'Corner' : isExtended ? 'Extended Top-Right' : 'Direct Top'})`}
                    >
                      <span>{val}</span>
                      <span style={{ fontSize: '7.5px', opacity: 0.65 }}>{idx === 0 ? 'TL' : idx - 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Left Reference Column */}
            <div style={{ background: 'var(--apple-canvas)', padding: '14px', borderRadius: '8px', border: '1px solid var(--apple-hairline)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--apple-label)' }}>
                  Left Reference Column ({2 * N + 1} Samples)
                </span>
                <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--apple-label-secondary)' }}>
                  p[-1, y], y ∈ [-1, {2 * N - 1}]
                </span>
              </div>

              <div style={{ display: 'flex', gap: '2px', overflowX: 'auto', paddingBottom: '6px' }}>
                {refLeftRaw.slice(0, 2 * N + 1).map((val, idx) => {
                  const { bg, color, border } = getSampleColor(val);
                  const isCorner = idx === 0;
                  const isExtended = idx > N;
                  return (
                    <div
                      key={`left-samp-${idx}`}
                      style={{
                        minWidth: '24px',
                        height: '32px',
                        background: bg,
                        color: color,
                        border: border || (isCorner ? '1.5px solid var(--apple-label)' : '1px solid #64748B'),
                        borderRadius: '3px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        fontWeight: 700,
                        boxSizing: 'border-box'
                      }}
                      title={`Left Sample y=${idx - 1} = ${val} (${isCorner ? 'Corner' : isExtended ? 'Extended Below-Left' : 'Direct Left'})`}
                    >
                      <span>{val}</span>
                      <span style={{ fontSize: '7.5px', opacity: 0.65 }}>{idx === 0 ? 'TL' : idx - 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px', padding: '10px 14px', background: 'var(--fill-4)', borderRadius: '6px', border: '0.5px solid var(--apple-hairline)', fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--apple-label)' }}>
            <strong>CTU Coordinates:</strong> ({ctuX}, {ctuY}) &nbsp;•&nbsp; 
            <strong>Boundary State:</strong> {isBoundaryCTU ? 'Picture Boundary (Padding substitution applied for missing edge samples)' : 'Interior (Reconstructed samples available from neighboring CUs)'}
          </div>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STAGE 02: Mode-Dependent Intra Smoothing (MDIS Filter)
  // ---------------------------------------------------------------------------
  if (activeTab === 'step2') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Card style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--apple-blue)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Stage 02: Reference Smoothing
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '2px 0 0 0', color: 'var(--apple-label)' }}>
                Mode-Dependent Intra Smoothing (MDIS 3-Tap Filter)
              </h3>
            </div>
            <Badge variant={isMDISSmoothed ? "green" : "gray"} style={{ fontFamily: 'var(--font-mono)' }}>
              {isMDISSmoothed ? 'MDIS: Active (Filtered)' : 'MDIS: Bypassed (Unfiltered)'}
            </Badge>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--apple-label-secondary)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
            In HEVC HM (<code>TComPrediction::filteringIntraReferenceSamples</code>), diagonal modes on blocks ≥ 8×8 apply a 3-tap smoothing filter:
            <br />
            <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--apple-label)' }}>
              p'[x] = (p[x-1] + 2·p[x] + p[x+1] + 2) &gt;&gt; 2 &nbsp; (Kernel [1, 2, 1] / 4)
            </code>
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {/* Top Reference Row Comparison */}
            <div style={{ background: 'var(--apple-canvas)', padding: '14px', borderRadius: '8px', border: '1px solid var(--apple-hairline)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--apple-label)' }}>
                  Top Reference Row: Raw vs 3-Tap Smoothed
                </span>
                <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: isMDISSmoothed ? 'var(--system-green)' : 'var(--apple-label-secondary)' }}>
                  {isMDISSmoothed ? 'MDIS Filter Active' : 'Pass-through'}
                </span>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--apple-label-secondary)', marginBottom: '4px' }}>Unfiltered p[x, -1]:</div>
              <div style={{ display: 'flex', gap: '2px', overflowX: 'auto', paddingBottom: '6px' }}>
                {refTopRaw.slice(0, 2 * N + 1).map((val, idx) => {
                  const { bg, color, border } = getSampleColor(val);
                  return (
                    <div
                      key={`unfilt-top-${idx}`}
                      style={{
                        minWidth: '24px',
                        height: '32px',
                        background: bg,
                        color: color,
                        border: border || '1px solid #64748B',
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        fontWeight: 700
                      }}
                    >
                      {val}
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--apple-label-secondary)', margin: '8px 0 4px 0' }}>Smoothed p'[x, -1]:</div>
              <div style={{ display: 'flex', gap: '2px', overflowX: 'auto', paddingBottom: '6px' }}>
                {(refTopFilt.length >= 2 * N + 1 ? refTopFilt : refTopActive).slice(0, 2 * N + 1).map((val, idx) => {
                  const { bg, color, border } = getSampleColor(val);
                  return (
                    <div
                      key={`filt-top-${idx}`}
                      style={{
                        minWidth: '24px',
                        height: '32px',
                        background: bg,
                        color: color,
                        border: border || '1px solid #64748B',
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        fontWeight: 700
                      }}
                    >
                      {val}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Left Reference Column Comparison */}
            <div style={{ background: 'var(--apple-canvas)', padding: '14px', borderRadius: '8px', border: '1px solid var(--apple-hairline)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--apple-label)' }}>
                  Left Reference Column: Raw vs 3-Tap Smoothed
                </span>
                <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: isMDISSmoothed ? 'var(--system-green)' : 'var(--apple-label-secondary)' }}>
                  {isMDISSmoothed ? 'MDIS Filter Active' : 'Pass-through'}
                </span>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--apple-label-secondary)', marginBottom: '4px' }}>Unfiltered p[-1, y]:</div>
              <div style={{ display: 'flex', gap: '2px', overflowX: 'auto', paddingBottom: '6px' }}>
                {refLeftRaw.slice(0, 2 * N + 1).map((val, idx) => {
                  const { bg, color, border } = getSampleColor(val);
                  return (
                    <div
                      key={`unfilt-left-${idx}`}
                      style={{
                        minWidth: '24px',
                        height: '32px',
                        background: bg,
                        color: color,
                        border: border || '1px solid #64748B',
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        fontWeight: 700
                      }}
                    >
                      {val}
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--apple-label-secondary)', margin: '8px 0 4px 0' }}>Smoothed p'[-1, y]:</div>
              <div style={{ display: 'flex', gap: '2px', overflowX: 'auto', paddingBottom: '6px' }}>
                {(refLeftFilt.length >= 2 * N + 1 ? refLeftFilt : refLeftRaw).slice(0, 2 * N + 1).map((val, idx) => {
                  const { bg, color, border } = getSampleColor(val);
                  return (
                    <div
                      key={`filt-left-${idx}`}
                      style={{
                        minWidth: '24px',
                        height: '32px',
                        background: bg,
                        color: color,
                        border: border || '1px solid #64748B',
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        fontWeight: 700
                      }}
                    >
                      {val}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STAGE 03: Angular Projection & Fractional Interpolation Mathematics
  // ---------------------------------------------------------------------------
  if (activeTab === 'step3') {
    const isPlanar = selectedMode === 0;
    const isDC = selectedMode === 1;
    const isVer = selectedMode >= 18;
    const isHor = selectedMode >= 2 && selectedMode <= 17;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Card style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--apple-blue)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Stage 03: Prediction Mathematics
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '2px 0 0 0', color: 'var(--apple-label)' }}>
                Sample Prediction: Mode {selectedMode} ({modeInfo.name})
              </h3>
            </div>
            <Badge variant="blue" style={{ fontFamily: 'var(--font-mono)' }}>
              {modeInfo.type}
            </Badge>
          </div>

          <div style={{ background: 'var(--apple-canvas)', padding: '14px', borderRadius: '8px', border: '1px solid var(--apple-hairline)', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--apple-label-secondary)', marginBottom: '8px' }}>
              ITU-T H.265 / HM-18.0 Mathematical Formula
            </div>

            {isPlanar && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', lineHeight: 1.6, color: 'var(--apple-label)' }}>
                <div><strong>Planar Interpolation (4-Corner Bilinear):</strong></div>
                <div>p_h = ({N} - 1 - x)·p[-1, y] + (x + 1)·p[{N}, -1]</div>
                <div>p_v = ({N} - 1 - y)·p[x, -1] + (y + 1)·p[-1, {N}]</div>
                <div style={{ color: 'var(--apple-blue)', fontWeight: 700 }}>
                  P[x, y] = (p_h + p_v + {N}) &gt;&gt; ({Math.round(Math.log2(N)) + 1})
                </div>
              </div>
            )}

            {isDC && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', lineHeight: 1.6, color: 'var(--apple-label)' }}>
                <div><strong>DC Mean Average:</strong></div>
                <div>dcVal = (∑ p[x, -1] + ∑ p[-1, y] + {N}) &gt;&gt; ({Math.round(Math.log2(N)) + 1})</div>
                <div style={{ color: 'var(--apple-blue)', fontWeight: 700 }}>
                  P[x, y] = dcVal &nbsp; (Interior pixels)
                </div>
                {hasEdgeFilter && (
                  <div style={{ marginTop: '6px', color: 'var(--system-orange)', fontSize: '10.5px' }}>
                    + DC Edge Filter applied to row 0, col 0, and corner [0, 0] for blocks ≤ 16×16
                  </div>
                )}
              </div>
            )}

            {!isPlanar && !isDC && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', lineHeight: 1.6, color: 'var(--apple-label)' }}>
                <div><strong>Angular Directional Projection ({isVer ? 'Vertical' : isHor ? 'Horizontal' : 'Angular'}):</strong></div>
                <div>IntraPredAngle (Δ) = {angle} / 32 pel displacement</div>
                <div>deltaPos = ({isVer ? 'y + 1' : 'x + 1'}) · {angle}</div>
                <div>deltaInt = deltaPos &gt;&gt; 5 &nbsp;•&nbsp; deltaFract (fact) = deltaPos &amp; 31</div>
                <div style={{ color: 'var(--apple-blue)', fontWeight: 700, marginTop: '4px' }}>
                  P[x, y] = ((32 - fact)·ref[idx] + fact·ref[idx + 1] + 16) &gt;&gt; 5
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STAGE 04: Full 35-Mode RDO Competition Leaderboard
  // ---------------------------------------------------------------------------
  if (activeTab === 'step4') {
    const sortedModes = [...modesData].sort((a, b) => a.cost - b.cost);
    const bestCost = sortedModes[0]?.cost ?? 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Card style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--apple-blue)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Stage 04: RDO Decision
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '2px 0 0 0', color: 'var(--apple-label)' }}>
                All 35 Intra Modes Competition Leaderboard ({N}×{N})
              </h3>
            </div>
            <Badge variant="green" style={{ fontFamily: 'var(--font-mono)' }}>
              Winner: Mode {sortedModes[0]?.mode} (J = {sortedModes[0]?.cost?.toFixed(1)})
            </Badge>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--apple-label-secondary)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
            HM-18.0 evaluates all candidate intra modes through Rate-Distortion Optimization (RDO) minimizing the Lagrangian cost:
            <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--apple-label)' }}> J = D + λ·R</code>.
            Click any row to inspect that mode.
          </p>

          <Table striped>
            <TableHeader>
              <tr>
                <TableHead align="center" style={{ width: '45px' }}>Rank</TableHead>
                <TableHead style={{ width: '60px' }}>Mode</TableHead>
                <TableHead>Direction Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead align="right">Angle Δ</TableHead>
                <TableHead align="right">Cost (J)</TableHead>
                <TableHead align="right">Δ Cost</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {sortedModes.map((item, idx) => {
                const info = getIntraModeInfo(item.mode);
                const isWinner = idx === 0;
                const isSelected = item.mode === selectedMode;
                const deltaCost = item.cost - bestCost;

                return (
                  <TableRow
                    key={item.mode}
                    selected={isSelected}
                    onClick={() => {
                      const foundIdx = modesData.findIndex(m => m.mode === item.mode);
                      if (foundIdx !== -1 && onSelectModeIndex) onSelectModeIndex(foundIdx);
                    }}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: isWinner ? 'rgba(52, 199, 89, 0.10)' : isSelected ? 'rgba(0, 122, 255, 0.10)' : undefined
                    }}
                  >
                    <TableCell align="center">
                      {isWinner ? (
                        <Badge variant="green" style={{ fontSize: '9.5px', padding: '1px 5px' }}>#1</Badge>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--apple-label-secondary)', fontFamily: 'var(--font-mono)' }}>#{idx + 1}</span>
                      )}
                    </TableCell>
                    <TableCell style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      M{item.mode}
                    </TableCell>
                    <TableCell style={{ fontWeight: isWinner ? 700 : 500 }}>
                      {info.name}
                    </TableCell>
                    <TableCell style={{ fontSize: '11px', color: 'var(--apple-label-secondary)' }}>
                      {info.type}
                    </TableCell>
                    <TableCell align="right" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      {item.angle_offset !== undefined ? item.angle_offset : (angle ?? 0)}
                    </TableCell>
                    <TableCell align="right" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: isWinner ? 'var(--system-green)' : 'var(--apple-label)' }}>
                      {typeof item.cost === 'number' ? item.cost.toFixed(1) : item.cost}
                    </TableCell>
                    <TableCell align="right" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: isWinner ? 'var(--system-green)' : 'var(--apple-label-secondary)' }}>
                      {isWinner ? 'Best' : `+${deltaCost.toFixed(1)}`}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    );
  }

  return null;
};

export default React.memo(StageDetailSection);
