import React, { useState, useMemo, useCallback } from 'react';
import { Badge, Button, SegmentedControl } from '../../../apple';
import BlockMatrixGrid from '../../../common/BlockMatrixGrid';
import { getIntraModeInfo, getSampleColorAndTextColor } from '../../../../utils/colorUtils';
import { calculateLagrangianLambda } from '../../../../utils/metricsUtils';

/**
 * Derives the 5 allowed Chroma Intra Prediction candidates according to:
 * - ITU-T H.265 Section 8.4.3 & Table 8-2
 * - HM-18.0 TComDataCU::getAllowedChromaDir
 */
function getAllowedChromaCandidates(lumaMode) {
  const baseModes = [0, 26, 10, 1]; // Planar, Vertical, Horizontal, DC
  const names = {
    0: 'Planar (0)',
    26: 'Vertical (26)',
    10: 'Horizontal (10)',
    1: 'DC (1)',
    34: 'Angular 34 (45° Top-Right)'
  };

  const modes = [...baseModes];
  let substituted = false;
  let subIndex = -1;

  for (let i = 0; i < modes.length; i++) {
    if (lumaMode === modes[i]) {
      modes[i] = 34; // Substitute duplicate base mode with Mode 34
      substituted = true;
      subIndex = i;
      break;
    }
  }

  const cands = modes.map((m, idx) => ({
    mode: m,
    name: names[m] || `Angular ${m}`,
    isDm: false,
    isSubstituted: idx === subIndex && substituted,
    rank: idx + 1
  }));

  // 5th Candidate: DM_CHROMA inherits Luma mode
  const lumaInfo = getIntraModeInfo(lumaMode);
  cands.push({
    mode: lumaMode,
    name: `DM_CHROMA (${lumaInfo.name})`,
    isDm: true,
    isSubstituted: false,
    rank: 5
  });

  return cands;
}

/**
 * Step5ChromaWinnerView
 * Visualizes HEVC Stage 5: Chroma Intra Search & Final RDO Winner Commitment.
 * Adheres to HM-18.0 TEncSearch::estIntraPredChromaQT and TEncCu::xCheckBestMode.
 * 100% Click-Only: zero hover flutter, zero hover listeners.
 */
export default function Step5ChromaWinnerView({
  pipelineData = null,
  modesData = [],
  modeData = null,
  bestLumaMode = 0,
  bestLumaCost = 0,
  N = 8,
  showValues = true,
  onSelectMode = null,
  qp = 32
}) {
  const [selectedPixel, setSelectedPixel] = useState({ x: 0, y: 0 });
  const [activeChromaTab, setActiveChromaTab] = useState('both'); // 'both', 'u_only', 'v_only'
  const [zoomLevel, setZoomLevel] = useState('fit');

  // Chroma dimensions (4:2:0 subsampling: Nc = N / 2)
  const Nc = Math.max(2, Math.floor(N / 2));
  const totalChromaPixels = Nc * Nc;

  // Luma winner from pipeline or props
  const effectiveBestLuma = pipelineData?.best_luma_mode ?? (modesData && modesData.length > 0 ? modesData[0].mode : bestLumaMode);
  const effectiveBestLumaCost = pipelineData?.winner_cost ?? (modesData && modesData.length > 0 ? modesData[0].cost : (modeData?.cost ?? bestLumaCost));

  // 5 Chroma candidates
  const chromaCandidates = useMemo(() => {
    return getAllowedChromaCandidates(effectiveBestLuma);
  }, [effectiveBestLuma]);

  // Selected inspected chroma candidate (default to DM_CHROMA or best_chroma_mode)
  const defaultChromaMode = pipelineData?.best_chroma_mode ?? effectiveBestLuma;
  const [inspectedChromaMode, setInspectedChromaMode] = useState(defaultChromaMode);

  // Chroma candidate chosen as winner
  const winnerChromaMode = pipelineData?.best_chroma_mode ?? effectiveBestLuma;

  // Pixel selection callback (100% Click-Only)
  const handleSelectPixel = useCallback((coord) => {
    setSelectedPixel(prev => (prev && prev.x === coord.x && prev.y === coord.y ? null : coord));
  }, []);

  // Safe Chroma buffers
  const Cb_org = useMemo(() => {
    if (modeData?.org_u && modeData.org_u.length >= totalChromaPixels) {
      return modeData.org_u.slice(0, totalChromaPixels);
    }
    return new Array(totalChromaPixels).fill(128);
  }, [modeData, totalChromaPixels]);

  const Cb_pred = useMemo(() => {
    if (modeData?.pred_u && modeData.pred_u.length >= totalChromaPixels) {
      return modeData.pred_u.slice(0, totalChromaPixels);
    }
    return new Array(totalChromaPixels).fill(128);
  }, [modeData, totalChromaPixels]);

  const Cb_resi = useMemo(() => {
    if (modeData?.resi_u && modeData.resi_u.length >= totalChromaPixels) {
      return modeData.resi_u.slice(0, totalChromaPixels);
    }
    return Cb_org.map((orgVal, idx) => orgVal - (Cb_pred[idx] ?? 128));
  }, [modeData, Cb_org, Cb_pred, totalChromaPixels]);

  const Cr_org = useMemo(() => {
    if (modeData?.org_v && modeData.org_v.length >= totalChromaPixels) {
      return modeData.org_v.slice(0, totalChromaPixels);
    }
    return new Array(totalChromaPixels).fill(128);
  }, [modeData, totalChromaPixels]);

  const Cr_pred = useMemo(() => {
    if (modeData?.pred_v && modeData.pred_v.length >= totalChromaPixels) {
      return modeData.pred_v.slice(0, totalChromaPixels);
    }
    return new Array(totalChromaPixels).fill(128);
  }, [modeData, totalChromaPixels]);

  const Cr_resi = useMemo(() => {
    if (modeData?.resi_v && modeData.resi_v.length >= totalChromaPixels) {
      return modeData.resi_v.slice(0, totalChromaPixels);
    }
    return Cr_org.map((orgVal, idx) => orgVal - (Cr_pred[idx] ?? 128));
  }, [modeData, Cr_org, Cr_pred, totalChromaPixels]);

  // Chroma Distortion and estimated RD Cost
  const sseCb = useMemo(() => Cb_resi.reduce((acc, r) => acc + r * r, 0), [Cb_resi]);
  const sseCr = useMemo(() => Cr_resi.reduce((acc, r) => acc + r * r, 0), [Cr_resi]);
  const sseChromaTotal = sseCb + sseCr;

  const lambda = calculateLagrangianLambda(qp);
  const chromaBits = inspectedChromaMode === effectiveBestLuma ? 1 : 3; // DM_CHROMA = 1 bit, others = 3 bits
  const estimatedChromaCost = (sseChromaTotal + lambda * chromaBits).toFixed(2);
  const totalCombinedCost = (Number(effectiveBestLumaCost) + Number(estimatedChromaCost)).toFixed(2);

  // Bitstream CABAC syntax elements
  const mpmList = pipelineData?.step3_candidates?.mpm_modes || [0, 1, 26];
  const isLumaMpm = mpmList.includes(effectiveBestLuma);
  const mpmIdx = isLumaMpm ? mpmList.indexOf(effectiveBestLuma) : null;
  const lumaSyntaxBits = isLumaMpm ? (mpmIdx === 0 ? 2 : 3) : 6;
  const totalSyntaxBits = lumaSyntaxBits + chromaBits + 1; // +1 for TU split flag

  // Selected pixel readout in Chroma domain
  const pxCoord = selectedPixel ? selectedPixel : { x: 0, y: 0 };
  const pxIdx = pxCoord.y * Nc + pxCoord.x;
  const cbOrgVal = Cb_org[pxIdx] ?? 128;
  const cbPredVal = Cb_pred[pxIdx] ?? 128;
  const cbResiVal = Cb_resi[pxIdx] ?? 0;
  const crOrgVal = Cr_org[pxIdx] ?? 128;
  const crPredVal = Cr_pred[pxIdx] ?? 128;
  const crResiVal = Cr_resi[pxIdx] ?? 0;

  // Max magnitudes for colormaps
  const maxCbResi = Cb_resi.reduce((max, r) => Math.max(max, Math.abs(r)), 1);
  const maxCrResi = Cr_resi.reduce((max, r) => Math.max(max, Math.abs(r)), 1);

  const getResiColor = (val, maxMag) => {
    if (val === 0) return { bg: 'var(--apple-canvas, #1C1C1E)', color: 'var(--apple-label-tertiary)' };
    const norm = Math.min(1, Math.abs(val) / (maxMag || 1));
    if (val > 0) {
      const alpha = 0.15 + norm * 0.75;
      return { bg: `rgba(239, 68, 68, ${alpha})`, color: norm > 0.5 ? '#FFFFFF' : 'var(--apple-label)' };
    } else {
      const alpha = 0.15 + norm * 0.75;
      return { bg: `rgba(59, 130, 246, ${alpha})`, color: norm > 0.5 ? '#FFFFFF' : 'var(--apple-label)' };
    }
  };

  const cellSize = zoomLevel === 'zoom' ? (Nc <= 4 ? 44 : 34) : (Nc <= 4 ? 32 : 24);

  // Top competitor modes for leaderboard comparison
  const topCompetitors = useMemo(() => {
    if (!modesData || modesData.length === 0) {
      return [{ mode: effectiveBestLuma, cost: effectiveBestLumaCost, rank: 1 }];
    }
    return [...modesData].slice(0, 3).map((m, idx) => ({
      mode: m.mode,
      name: getIntraModeInfo(m.mode).name,
      cost: m.cost,
      rank: idx + 1,
      delta: idx === 0 ? 'Best' : `+${(m.cost - modesData[0].cost).toFixed(2)}`
    }));
  }, [modesData, effectiveBestLuma, effectiveBestLumaCost]);

  const lumaInfo = getIntraModeInfo(effectiveBestLuma);
  const chromaInfo = getIntraModeInfo(winnerChromaMode);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {/* 1. Header Toolbar & Stage 5 Metadata */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        paddingBottom: '0.65rem',
        borderBottom: '1px solid var(--apple-hairline)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.80rem',
            fontWeight: 800,
            fontFamily: 'JetBrains Mono',
            color: 'var(--apple-label)'
          }}>
            STAGE 5: CHROMA INTRA SEARCH &amp; WINNER COMMITMENT
          </span>
          <Badge variant="blue">
            estIntraPredChromaQT
          </Badge>
          <Badge variant="purple">
            xCheckBestMode
          </Badge>
          <span style={{ fontSize: '0.70rem', color: 'var(--apple-label-secondary)', fontFamily: 'JetBrains Mono' }}>
            [Chroma Mode Mapping]
          </span>
        </div>

        {/* View Layout & Zoom Controls */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <SegmentedControl
            value={activeChromaTab}
            onChange={setActiveChromaTab}
            size="small"
            items={[
              { id: 'both', label: 'Both (Cb & Cr)' },
              { id: 'u_only', label: 'Cb (U)' },
              { id: 'v_only', label: 'Cr (V)' }
            ]}
          />

          <Button
            variant={zoomLevel === 'zoom' ? 'tinted' : 'gray'}
            size="small"
            onClick={() => setZoomLevel(prev => prev === 'zoom' ? 'fit' : 'zoom')}
            title="Toggle matrix cell size"
          >
            {zoomLevel === 'zoom' ? 'Zoom: 1.5×' : 'Fit'}
          </Button>
        </div>
      </div>

      {/* 2. Chroma 5-Candidate Evaluation Strip (H.265 Table 8-2) */}
      <div style={{
        background: 'var(--apple-surface, #F5F5F7)',
        border: '1px solid var(--apple-hairline)',
        borderRadius: '6px',
        padding: '0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div>
            <div style={{
              fontSize: '0.74rem',
              fontWeight: 800,
              fontFamily: 'JetBrains Mono',
              color: 'var(--apple-label)'
            }}>
              CHROMA CANDIDATE SET (5 ALLOWED MODES)
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--apple-label-secondary)', marginTop: '0.15rem' }}>
              Base modes [0, 26, 10, 1] + DM_CHROMA. If duplicate with Luma (Mode {effectiveBestLuma}), replaced by Mode 34.
            </div>
          </div>
          <span style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono', color: 'var(--system-purple, #AF52DE)' }}>
            Chroma Subsampling: 4:2:0 ({Nc}×{Nc})
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
          gap: '0.5rem',
          width: '100%'
        }}>
          {chromaCandidates.map((cand, idx) => {
            const isInspected = inspectedChromaMode === cand.mode;
            const isWinner = winnerChromaMode === cand.mode;

            return (
              <div
                key={`chroma-cand-${idx}`}
                onClick={() => setInspectedChromaMode(cand.mode)}
                style={{
                  background: isInspected ? 'rgba(0, 122, 255, 0.08)' : 'var(--apple-canvas)',
                  border: isWinner
                    ? '2px solid var(--system-green, #34C759)'
                    : isInspected
                      ? '2px solid var(--apple-blue)'
                      : '1px solid var(--apple-hairline)',
                  borderRadius: '5px',
                  padding: '0.5rem 0.65rem',
                  cursor: 'pointer',
                  userSelect: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  fontFamily: 'JetBrains Mono'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '0.60rem',
                    fontWeight: 800,
                    color: isWinner ? 'var(--system-green, #34C759)' : 'var(--apple-label-secondary)'
                  }}>
                    {isWinner ? '★ WINNER' : `Cand #${cand.rank}`}
                  </span>
                  {cand.isDm && (
                    <Badge variant="purple" style={{ fontSize: '0.55rem', padding: '1px 4px' }}>
                      DM
                    </Badge>
                  )}
                  {cand.isSubstituted && (
                    <Badge variant="orange" style={{ fontSize: '0.55rem', padding: '1px 4px' }}>
                      Sub 34
                    </Badge>
                  )}
                </div>

                <div style={{ fontSize: '0.80rem', fontWeight: 800, color: 'var(--apple-label)' }}>
                  Mode {cand.mode}
                </div>

                <div style={{
                  fontSize: '0.64rem',
                  color: 'var(--apple-label-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {cand.name}
                </div>

                <div style={{
                  fontSize: '0.60rem',
                  color: 'var(--apple-label-tertiary)',
                  marginTop: '0.15rem'
                }}>
                  Signal: {cand.isDm ? '1 bit (0)' : '3 bits'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Synchronized Chroma Pixel Inspector HUD */}
      <div style={{
        background: 'var(--apple-surface, #F5F5F7)',
        border: '1px solid var(--apple-hairline)',
        borderRadius: '6px',
        padding: '0.65rem 0.85rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        fontFamily: 'JetBrains Mono',
        fontSize: '0.72rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--apple-label-secondary)' }}>CHROMA PIXEL [{pxCoord.x}, {pxCoord.y}]:</span>
          <span style={{ color: 'var(--apple-blue)' }}>
            Cb (U): Org <strong>{cbOrgVal}</strong> ➔ Pred <strong>{cbPredVal}</strong> ➔ Resi <strong style={{ color: cbResiVal >= 0 ? '#EF4444' : '#3B82F6' }}>{cbResiVal > 0 ? `+${cbResiVal}` : cbResiVal}</strong>
          </span>
          <span style={{ color: 'var(--apple-label-tertiary)' }}>•</span>
          <span style={{ color: '#FF2D55' }}>
            Cr (V): Org <strong>{crOrgVal}</strong> ➔ Pred <strong>{crPredVal}</strong> ➔ Resi <strong style={{ color: crResiVal >= 0 ? '#EF4444' : '#3B82F6' }}>{crResiVal > 0 ? `+${crResiVal}` : crResiVal}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--apple-label-secondary)' }}>Chroma SSE (U+V):</span>
          <strong style={{ color: 'var(--apple-label)' }}>
            {sseChromaTotal}
          </strong>
        </div>
      </div>

      {/* 4. Dual Chroma Planar Matrices: Cb (U) & Cr (V) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: activeChromaTab === 'both' ? 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))' : '1fr',
        gap: '0.85rem',
        width: '100%',
        overflowX: 'auto'
      }}>
        {/* Cb Channel (U) */}
        {(activeChromaTab === 'both' || activeChromaTab === 'u_only') && (
          <div style={{
            background: 'var(--apple-surface, #F5F5F7)',
            border: '1px solid var(--apple-hairline)',
            borderRadius: '6px',
            padding: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, fontFamily: 'JetBrains Mono', color: 'var(--apple-blue)' }}>
                CB CHANNEL (U) — {Nc}×{Nc} SAMPLES
              </div>
              <span style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono', color: 'var(--apple-label-secondary)' }}>
                SSE_U = {sseCb}
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
              gap: '0.75rem',
              justifyContent: 'safe center'
            }}>
              {/* Cb Org */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.64rem', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--apple-label-secondary)' }}>
                  Original U
                </span>
                <BlockMatrixGrid
                  data={Cb_org}
                  width={Nc}
                  selectedCell={selectedPixel}
                  onSelectCell={handleSelectPixel}
                  getColor={val => getSampleColorAndTextColor(val, 'U')}
                  formatValue={v => v}
                  microCellSize={cellSize}
                  showValues={showValues}
                />
              </div>

              {/* Cb Pred */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.64rem', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--apple-label-secondary)' }}>
                  Pred P_U
                </span>
                <BlockMatrixGrid
                  data={Cb_pred}
                  width={Nc}
                  selectedCell={selectedPixel}
                  onSelectCell={handleSelectPixel}
                  getColor={val => getSampleColorAndTextColor(val, 'U')}
                  formatValue={v => v}
                  microCellSize={cellSize}
                  showValues={showValues}
                />
              </div>

              {/* Cb Resi */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.64rem', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--apple-label-secondary)' }}>
                  Resi R_U
                </span>
                <BlockMatrixGrid
                  data={Cb_resi}
                  width={Nc}
                  selectedCell={selectedPixel}
                  onSelectCell={handleSelectPixel}
                  getColor={val => getResiColor(val, maxCbResi)}
                  formatValue={v => v > 0 ? `+${v}` : v}
                  microCellSize={cellSize}
                  showValues={showValues}
                />
              </div>
            </div>
          </div>
        )}

        {/* Cr Channel (V) */}
        {(activeChromaTab === 'both' || activeChromaTab === 'v_only') && (
          <div style={{
            background: 'var(--apple-surface, #F5F5F7)',
            border: '1px solid var(--apple-hairline)',
            borderRadius: '6px',
            padding: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, fontFamily: 'JetBrains Mono', color: '#FF2D55' }}>
                CR CHANNEL (V) — {Nc}×{Nc} SAMPLES
              </div>
              <span style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono', color: 'var(--apple-label-secondary)' }}>
                SSE_V = {sseCr}
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
              gap: '0.75rem',
              justifyContent: 'safe center'
            }}>
              {/* Cr Org */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.64rem', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--apple-label-secondary)' }}>
                  Original V
                </span>
                <BlockMatrixGrid
                  data={Cr_org}
                  width={Nc}
                  selectedCell={selectedPixel}
                  onSelectCell={handleSelectPixel}
                  getColor={val => getSampleColorAndTextColor(val, 'V')}
                  formatValue={v => v}
                  microCellSize={cellSize}
                  showValues={showValues}
                />
              </div>

              {/* Cr Pred */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.64rem', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--apple-label-secondary)' }}>
                  Pred P_V
                </span>
                <BlockMatrixGrid
                  data={Cr_pred}
                  width={Nc}
                  selectedCell={selectedPixel}
                  onSelectCell={handleSelectPixel}
                  getColor={val => getSampleColorAndTextColor(val, 'V')}
                  formatValue={v => v}
                  microCellSize={cellSize}
                  showValues={showValues}
                />
              </div>

              {/* Cr Resi */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.64rem', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--apple-label-secondary)' }}>
                  Resi R_V
                </span>
                <BlockMatrixGrid
                  data={Cr_resi}
                  width={Nc}
                  selectedCell={selectedPixel}
                  onSelectCell={handleSelectPixel}
                  getColor={val => getResiColor(val, maxCrResi)}
                  formatValue={v => v > 0 ? `+${v}` : v}
                  microCellSize={cellSize}
                  showValues={showValues}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Bitstream Syntax Elements Card (CABAC Encoding Specification) */}
      <div style={{
        background: 'var(--apple-surface, #F5F5F7)',
        border: '1px solid var(--apple-hairline)',
        borderRadius: '6px',
        padding: '0.85rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '0.85rem',
        fontFamily: 'JetBrains Mono'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--apple-label)' }}>
            BITSTREAM SYNTAX ELEMENTS (CABAC)
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--apple-label-secondary)', lineHeight: 1.45 }}>
            Coding unit syntax elements emitted to bitstream:
          </div>

          <div style={{
            background: 'var(--apple-canvas)',
            border: '1px solid var(--apple-hairline)',
            borderRadius: '4px',
            padding: '0.5rem 0.65rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.3rem',
            fontSize: '0.70rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--apple-label-secondary)' }}>prev_intra_luma_pred_flag:</span>
              <strong style={{ color: isLumaMpm ? 'var(--system-green, #34C759)' : 'var(--apple-label)' }}>
                {isLumaMpm ? '1 (MPM Match)' : '0 (Non-MPM)'}
              </strong>
            </div>

            {isLumaMpm ? (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--apple-label-secondary)' }}>mpm_idx:</span>
                <strong style={{ color: 'var(--system-purple, #AF52DE)' }}>
                  {mpmIdx} (Mode {effectiveBestLuma})
                </strong>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--apple-label-secondary)' }}>rem_intra_luma_pred_mode:</span>
                <strong style={{ color: '#D97706' }}>
                  {effectiveBestLuma} (5 bits)
                </strong>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--apple-label-secondary)' }}>intra_chroma_pred_mode:</span>
              <strong style={{ color: 'var(--apple-blue)' }}>
                {inspectedChromaMode === effectiveBestLuma ? '4 (DM_CHROMA)' : `Mode ${inspectedChromaMode}`}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--apple-hairline)', paddingTop: '0.25rem', marginTop: '0.15rem' }}>
              <span style={{ color: 'var(--apple-label-secondary)' }}>Total Mode Syntax Bits:</span>
              <strong style={{ color: 'var(--apple-label)' }}>
                ≈ {totalSyntaxBits} bits
              </strong>
            </div>
          </div>
        </div>

        {/* 6. Final Decision & Winner Commitment (xCheckBestMode) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--apple-label)' }}>
            FINAL WINNER COMMITMENT (xCheckBestMode)
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--apple-label-secondary)', lineHeight: 1.45 }}>
            Combines Luma + Chroma costs into the optimal PU state and commits to CTU quadtree:
          </div>

          <div style={{
            background: 'var(--apple-canvas)',
            border: '1.5px solid var(--system-green, #34C759)',
            borderRadius: '4px',
            padding: '0.55rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--apple-label-secondary)' }}>Luma Winner:</span>
              <strong style={{ color: 'var(--system-green, #34C759)', fontSize: '0.80rem' }}>
                Mode {effectiveBestLuma} ({lumaInfo.name})
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--apple-label-secondary)' }}>Chroma Winner:</span>
              <strong style={{ color: 'var(--system-green, #34C759)', fontSize: '0.80rem' }}>
                Mode {winnerChromaMode} ({winnerChromaMode === effectiveBestLuma ? 'DM_CHROMA' : chromaInfo.name})
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--apple-hairline)', paddingTop: '0.3rem' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--apple-label-secondary)' }}>Combined Cost (J_PU):</span>
              <strong style={{ color: 'var(--apple-blue)', fontSize: '0.90rem' }}>
                {totalCombinedCost}
              </strong>
            </div>
          </div>

          {/* Leaderboard competitors comparison */}
          {topCompetitors.length > 1 && (
            <div style={{
              display: 'flex',
              gap: '0.4rem',
              alignItems: 'center',
              fontSize: '0.65rem',
              color: 'var(--apple-label-secondary)',
              marginTop: '0.2rem'
            }}>
              <span>Runner-up:</span>
              {topCompetitors.slice(1).map(c => (
                <span key={c.mode} style={{ background: 'var(--apple-canvas)', padding: '2px 5px', borderRadius: '3px', border: '1px solid var(--apple-hairline)' }}>
                  Mode {c.mode} ({c.delta})
                </span>
              ))}
            </div>
          )}

          {onSelectMode && (
            <div style={{ marginTop: '0.3rem' }}>
              <Button
                variant="filled"
                size="small"
                onClick={() => onSelectMode(effectiveBestLuma)}
                title="Apply winner mode to PU inspector"
                style={{ width: '100%', fontSize: '0.72rem' }}
              >
                Apply Mode {effectiveBestLuma} to PU Inspector
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
