import React from 'react';
import { getIntraModeInfo } from '../../../../utils/colorUtils';
import Step1BoundaryInitView from '../pipeline/Step1BoundaryInitView';
import Step5ChromaWinnerView from '../pipeline/Step5ChromaWinnerView';
import { SegmentedControl, Badge, Card, Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../../apple';

/**
 * RdoDecisionDeck: Right column component in Intra Studio
 * Exposes RDO Candidates Table, Boundary MDIS Filter, and Chroma Intra Modes.
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
          value={deckTab}
          onChange={setDeckTab}
          size="small"
          items={[
            { id: 'candidates', label: 'RDO Candidates' },
            { id: 'boundary', label: 'Boundary MDIS' },
            { id: 'chroma', label: 'Chroma Modes' },
          ]}
        />
      </div>

      {/* TAB 1: RDO Candidates Table */}
      {deckTab === 'candidates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-secondary)', fontFamily: 'JetBrains Mono' }}>
            Click any candidate row to preview its prediction live:
          </div>
          <div style={{ overflowX: 'auto', width: '100%', minHeight: '330px' }}>
            <Table size="small" style={{ tableLayout: 'fixed', width: '100%' }}>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: '85px', minWidth: '85px' }}>Rank</TableHead>
                  <TableHead style={{ width: '50px', minWidth: '50px' }}>Mode</TableHead>
                  <TableHead style={{ width: '135px', minWidth: '135px' }}>Name</TableHead>
                  <TableHead style={{ width: '80px', minWidth: '80px', textAlign: 'right' }}>Cost (J)</TableHead>
                  <TableHead style={{ width: '75px', minWidth: '75px', textAlign: 'right' }}>Δ Cost</TableHead>
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
                        height: '36px',
                        background: isCurrent ? 'rgba(0, 122, 255, 0.08)' : (isWinner ? 'rgba(52, 199, 89, 0.06)' : 'transparent'),
                        borderLeft: isCurrent ? '3px solid var(--apple-blue)' : (isWinner ? '3px solid var(--system-green)' : '3px solid transparent'),
                        fontFamily: 'JetBrains Mono',
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: '11px'
                      }}
                    >
                      <TableCell style={{ fontWeight: 700, width: '85px', whiteSpace: 'nowrap' }}>
                        {isWinner ? <Badge variant="green" style={{ minWidth: '65px', justifyContent: 'center' }}>#1 Winner</Badge> : `#${idx + 1}`}
                      </TableCell>
                      <TableCell style={{ fontWeight: 700, color: 'var(--apple-blue)', width: '50px', whiteSpace: 'nowrap' }}>
                        M{cand.mode}
                      </TableCell>
                      <TableCell style={{ width: '135px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {info.name}
                      </TableCell>
                      <TableCell style={{ fontWeight: 600, width: '80px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {typeof cand.cost === 'number' ? cand.cost.toFixed(1) : cand.cost}
                      </TableCell>
                      <TableCell style={{ color: isWinner ? 'var(--system-green)' : 'var(--apple-label-secondary)', width: '75px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {delta}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* TAB 2: Boundary & MDIS Filter */}
      {deckTab === 'boundary' && (
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

      {/* TAB 3: Chroma Intra Modes */}
      {deckTab === 'chroma' && (
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
