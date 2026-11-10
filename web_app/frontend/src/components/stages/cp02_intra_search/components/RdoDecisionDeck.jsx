import React from 'react';
import { getIntraModeInfo } from '../../../../utils/colorUtils';
import Step1BoundaryInitView from '../pipeline/Step1BoundaryInitView';
import Step2RmdFunnelView from '../pipeline/Step2RmdFunnelView';
import Step5ChromaWinnerView from '../pipeline/Step5ChromaWinnerView';
import { SegmentedControl, Badge, Card, Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../../apple';

/**
 * RdoDecisionDeck: Right column component in Intra Studio
 * Exposes RDO Candidates Table, RMD Funnel, Boundary MDIS Filter, and Chroma Intra Modes.
 * Aligned strictly with HM-18.0 TEncSearch 4-phase intra prediction pipeline.
 */
const RdoDecisionDeck = ({
  deckTab,
  setDeckTab,
  sortedCandidates = [],
  modesData = [],
  modeData = null,
  selectedMode = 0,
  onSelectModeIndex,
  refTopRaw,
  refLeftRaw,
  refTopFilt,
  refLeftFilt,
  N = 8,
  channel = 'Y',
  isMDISSmoothed = false,
  showValues = true,
  getSampleColor,
  effectivePipelineData = null,
  transformEvent = null,
}) => {
  const mpmModes = effectivePipelineData?.step3_candidates?.mpm_modes || [0, 1, 26];

  const availableTabs = React.useMemo(() => {
    const tabs = [
      { id: 'candidates', label: 'Candidates' },
      { id: 'rmd', label: 'RMD Funnel' },
      { id: 'boundary', label: 'Boundary MDIS' },
    ];
    if (channel !== 'Y') {
      tabs.push({ id: 'chroma', label: 'Chroma Modes' });
    }
    return tabs;
  }, [channel]);

  const activeDeckTab = (deckTab === 'chroma' && channel === 'Y') ? 'candidates' : deckTab;

  return (
    <Card
      style={{
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        minWidth: 0,
        minHeight: '420px',
        boxSizing: 'border-box'
      }}
    >
      {/* Deck Header & Sub-Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
          RDO Decision Deck
        </span>
        <SegmentedControl
          value={activeDeckTab}
          onChange={setDeckTab}
          size="small"
          items={availableTabs}
        />
      </div>

      {/* TAB 1: RDO Candidates Table */}
      {activeDeckTab === 'candidates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-secondary)', fontFamily: 'JetBrains Mono' }}>
            Click any candidate row to preview its prediction live:
          </div>
          <div style={{ overflowX: 'auto', width: '100%', minHeight: '330px' }}>
            <Table size="small" style={{ tableLayout: 'fixed', width: '100%' }}>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: '18%', minWidth: '55px', padding: '4px 6px' }}>Rank</TableHead>
                  <TableHead style={{ width: '18%', minWidth: '55px', padding: '4px 6px' }}>Mode</TableHead>
                  <TableHead style={{ width: '28%', minWidth: '65px', padding: '4px 6px' }}>Name</TableHead>
                  <TableHead style={{ width: '20%', minWidth: '55px', textAlign: 'right', padding: '4px 6px' }}>Cost (J)</TableHead>
                  <TableHead style={{ width: '16%', minWidth: '45px', textAlign: 'right', padding: '4px 6px' }}>Δ Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sortedCandidates.length > 0 ? sortedCandidates : (modesData && modesData.length > 0 ? modesData : [
                  { mode: selectedMode, cost: modeData?.cost ?? 0 }
                ])).slice(0, 8).map((cand, idx) => {
                  const info = getIntraModeInfo(cand.mode);
                  const isWinner = idx === 0;
                  const isCurrent = cand.mode === selectedMode;
                  const bestCost = sortedCandidates.length > 0 ? sortedCandidates[0]?.cost : (modesData[0]?.cost ?? 0);
                  const delta = isWinner ? 'Best' : (cand.cost !== undefined && bestCost !== undefined ? `+${(cand.cost - bestCost).toFixed(1)}` : '—');
                  const isMpm = mpmModes.includes(cand.mode);

                  return (
                    <TableRow
                      key={`cand-row-${cand.mode}`}
                      onClick={() => {
                        if (modesData && onSelectModeIndex) {
                          const targetIdx = modesData.findIndex(d => d.mode === cand.mode);
                          if (targetIdx !== -1) onSelectModeIndex(targetIdx);
                        }
                      }}
                      style={{
                        cursor: 'pointer',
                        height: '28px',
                        background: isCurrent ? 'rgba(0, 122, 255, 0.08)' : (isWinner ? 'rgba(52, 199, 89, 0.06)' : 'transparent'),
                        borderLeft: isCurrent ? '3px solid var(--apple-blue)' : (isWinner ? '3px solid var(--system-green)' : '3px solid transparent'),
                        fontFamily: 'JetBrains Mono',
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: '11px'
                      }}
                    >
                      <TableCell style={{ fontWeight: 700, padding: '2px 6px', whiteSpace: 'nowrap' }}>
                        {isWinner ? <Badge variant="green" style={{ fontSize: '9.5px', padding: '1px 5px', justifyContent: 'center' }}>#1 Best</Badge> : `#${idx + 1}`}
                      </TableCell>
                      <TableCell style={{ fontWeight: 700, color: 'var(--apple-blue)', padding: '2px 6px', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          M{cand.mode}
                          {isMpm && (
                            <span
                              style={{
                                fontSize: '8.5px',
                                padding: '0 3px',
                                borderRadius: '3px',
                                background: 'rgba(0, 122, 255, 0.15)',
                                color: 'var(--apple-blue)',
                                fontWeight: 600,
                              }}
                              title="Most Probable Mode (MPM) from neighbor CUs"
                            >
                              MPM
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell style={{ padding: '2px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={info.name}>
                        {info.name}
                      </TableCell>
                      <TableCell style={{ fontWeight: 600, textAlign: 'right', padding: '2px 6px', whiteSpace: 'nowrap' }}>
                        {typeof cand.cost === 'number' ? cand.cost.toFixed(1) : cand.cost}
                      </TableCell>
                      <TableCell style={{ color: isWinner ? 'var(--system-green)' : 'var(--apple-label-secondary)', textAlign: 'right', padding: '2px 6px', whiteSpace: 'nowrap' }}>
                        {delta}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--apple-label-tertiary)', borderTop: '0.5px solid var(--separator)', paddingTop: '6px' }}>
            HM TEncSearch: Pool = Top-K(SATD) ∪ MPMs evaluated with SSE + CABAC.
          </div>
        </div>
      )}

      {/* TAB 2: RMD Funnel (35 Modes Screening) */}
      {activeDeckTab === 'rmd' && (
        <div style={{ minWidth: 0, overflowX: 'auto', width: '100%' }}>
          <Step2RmdFunnelView
            rmdModes={effectivePipelineData?.step2_rmd || modesData}
            kThreshold={effectivePipelineData?.step3_candidates?.k_threshold ?? (N <= 8 ? 8 : 3)}
            selectedMode={selectedMode}
            onSelectMode={(targetMode) => {
              if (modesData && onSelectModeIndex) {
                const targetIdx = modesData.findIndex(d => d.mode === targetMode);
                if (targetIdx !== -1) onSelectModeIndex(targetIdx);
              }
            }}
            N={N}
            mpmModes={mpmModes}
          />
        </div>
      )}

      {/* TAB 3: Boundary & MDIS Filter */}
      {activeDeckTab === 'boundary' && (
        <div style={{ minWidth: 0, overflowX: 'auto', width: '100%' }}>
          <Step1BoundaryInitView
            refTopRaw={refTopRaw}
            refLeftRaw={refLeftRaw}
            refTopFilt={refTopFilt}
            refLeftFilt={refLeftFilt}
            N={N}
            channel={channel}
            isMDISSmoothed={isMDISSmoothed}
            showValues={showValues}
            getSampleColor={getSampleColor}
          />
        </div>
      )}

      {/* TAB 4: Chroma Intra Modes */}
      {activeDeckTab === 'chroma' && (
        <div style={{ minWidth: 0, overflowX: 'auto', width: '100%' }}>
          <Step5ChromaWinnerView
            pipelineData={effectivePipelineData}
            modesData={modesData}
            modeData={modeData}
            bestLumaMode={effectivePipelineData?.best_luma_mode ?? selectedMode}
            bestLumaCost={effectivePipelineData?.winner_cost ?? (modeData?.cost ?? 0)}
            N={N}
            showValues={showValues}
            onSelectMode={(targetMode) => {
              if (modesData && onSelectModeIndex) {
                const targetIdx = modesData.findIndex(d => d.mode === targetMode);
                if (targetIdx !== -1) onSelectModeIndex(targetIdx);
              }
            }}
            qp={modeData?.qp ?? transformEvent?.qp ?? 32}
          />
        </div>
      )}
    </Card>
  );
};

export default React.memo(RdoDecisionDeck);
