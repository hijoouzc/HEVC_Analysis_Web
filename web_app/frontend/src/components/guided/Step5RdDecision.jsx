import React, { useState } from 'react';
import { CabacEntropyVisualizer } from '../stages/cp07_cabac_entropy';
import RdoQuadtreeSimulator from '../RdoQuadtreeSimulator';
import { Badge, SegmentedControl } from '../apple';

/**
 * Step5RdDecision (Guided Flow Step 5)
 * RDO Decision Comparison (HM xCheckBestMode), CABAC Telemetry & Standalone Simulator.
 * Strictly separates Picture Buffer commitment (in xCompressCU) from Bitstream writing (in xEncodeCU).
 */
export function Step5RdDecision({
  rdoDecisions = [],
  cabacEntropyData,
  selectedCu,
  ctuX,
  ctuY,
  imageSrc,
  imageDims,
  partitionData,
  onNavigateToStage,
  showValues = undefined,
}) {
  const [subTab, setSubTab] = useState('decision'); // 'decision' | 'cabac' | 'simulator'

  // Find RDO decision for selected CU
  const matchingDecisions = (rdoDecisions || []).filter((d) => {
    if (!selectedCu) return false;
    const cuX = selectedCu.x ?? selectedCu.abs_x;
    const cuY = selectedCu.y ?? selectedCu.abs_y;
    return d.cu_x === cuX && d.cu_y === cuY;
  });

  const activeDecision = matchingDecisions.length === 1 ? matchingDecisions[0] : (matchingDecisions[0] || null);
  const hasMultipleQp = matchingDecisions.length > 1;

  // Determine reason if no split evaluation occurred
  const isLeafCu = selectedCu && (selectedCu.width <= 8 || selectedCu.depth >= 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Sub-Tab Switcher */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
        <SegmentedControl
          value={subTab}
          onChange={setSubTab}
          size="small"
          items={[
            { id: 'decision', label: 'Split Decision (RDO)' },
            { id: 'cabac', label: 'CABAC Entropy Syntax' },
            { id: 'simulator', label: 'RDO Simulator' },
          ]}
        />
      </div>

      {/* CTU Actual Bits & Multiple QP Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
        {partitionData?.ctu_actual_bits != null ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Badge variant="green" style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', padding: '3px 8px' }}>
              Actual bits — CTU: {partitionData.ctu_actual_bits.toLocaleString()} b
            </Badge>
            <span style={{ fontSize: '10px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
              (TEncSlice::encodeCtu bitstream output)
            </span>
          </div>
        ) : <div />}

        {hasMultipleQp && subTab === 'decision' && (
          <Badge variant="yellow" style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
            [MULTIPLE EVALUATIONS]: {matchingDecisions.length} RDO evaluations recorded
          </Badge>
        )}
      </div>

      {/* Sub-Tab 1: Decision Comparison Workspace */}
      {subTab === 'decision' && (
        <div className="stage-section-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {activeDecision ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '12px',
                }}
              >
                {/* Cost No-Split Card */}
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    background: 'var(--fill-1)',
                    border: !activeDecision.split_decision ? '1px solid var(--system-green)' : '0.5px solid var(--separator)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--apple-label)' }}>
                      Best No-Split Cost (J_nosplit)
                    </span>
                    {!activeDecision.split_decision && (
                      <Badge variant="green">WINNER</Badge>
                    )}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--apple-label)', marginBottom: '4px' }}>
                    {Number(activeDecision.nosplit?.cost ?? activeDecision.cost_nosplit).toFixed(2)}
                  </div>
                  {activeDecision.nosplit && (
                    <div style={{ fontSize: '10.5px', color: 'var(--apple-label-secondary)', fontFamily: 'var(--font-mono)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span>Dist: {activeDecision.nosplit.dist.toLocaleString()} &bull; Rate: {activeDecision.nosplit.bits} b</span>
                      <span>QP: {activeDecision.nosplit.qp >= 0 ? activeDecision.nosplit.qp : '—'} {activeDecision.nosplit.mode != null && activeDecision.nosplit.mode >= 0 ? `&bull; Mode ${activeDecision.nosplit.mode}` : ''}</span>
                    </div>
                  )}
                </div>

                {/* Cost Split Card */}
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    background: 'var(--fill-1)',
                    border: activeDecision.split_decision ? '1px solid var(--system-green)' : '0.5px solid var(--separator)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--apple-label)' }}>
                      Best Split Cost (J_split)
                    </span>
                    {activeDecision.split_decision && (
                      <Badge variant="green">WINNER</Badge>
                    )}
                    {activeDecision.split_evaluated === false && (
                      <Badge variant="gray">NOT EVALUATED</Badge>
                    )}
                  </div>
                  {activeDecision.split_evaluated === false ? (
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)', padding: '6px 0' }}>
                      — (Depth limit / Slice boundary)
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--apple-label)', marginBottom: '4px' }}>
                        {Number(activeDecision.split?.cost ?? activeDecision.cost_split).toFixed(2)}
                      </div>
                      {activeDecision.split && (
                        <div style={{ fontSize: '10.5px', color: 'var(--apple-label-secondary)', fontFamily: 'var(--font-mono)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span>Dist: {activeDecision.split.dist.toLocaleString()} &bull; Rate: {activeDecision.split.bits} b</span>
                          <span>QP: {activeDecision.split.qp >= 0 ? activeDecision.split.qp : '—'}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Decision Outcome & Pipeline Commitment Note */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  background: 'var(--fill-2)',
                  border: '0.5px solid var(--separator)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--apple-label)', fontSize: '12px' }}>
                  Decision: {activeDecision.split_decision ? 'SPLIT (Sub-CU Recursion Preferred)' : 'DO NOT SPLIT (Current CU Size Preserved)'}
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <Badge variant="blue" style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)' }}>
                    Buffer: xCompressCU
                  </Badge>
                  <Badge variant="gray" style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)' }}>
                    Bitstream: xEncodeCU
                  </Badge>
                </div>
              </div>
            </div>
          ) : (
            /* No Decision Event Case */
            <div
              style={{
                padding: '20px 16px',
                textAlign: 'center',
                background: 'var(--fill-1)',
                borderRadius: '8px',
                border: '0.5px solid var(--separator)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--apple-label)' }}>
                {isLeafCu ? 'Leaf CU (Maximum Coding Depth: 8×8)' : 'Split Branch Not Evaluated in Trace'}
              </div>
              <Badge variant="gray">
                {isLeafCu ? 'Status: Leaf Node (No Split Allowed)' : 'Status: Split Not Evaluated'}
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 2: CABAC Telemetry Workspace */}
      {subTab === 'cabac' && (
        <div className="stage-section-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div
            style={{
              padding: '6px 10px',
              background: 'var(--fill-4)',
              border: '0.5px solid var(--separator)',
              borderRadius: '6px',
              fontSize: '11px',
              color: 'var(--apple-label-secondary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            [NOTE]: Context state values represent <code>State (After Bin Transition)</code>. Bit counts represent <code>Cumulative Written Bits (At Bin Trace Time)</code>.
          </div>
          <CabacEntropyVisualizer
            cabacEntropyData={cabacEntropyData}
            ctuX={ctuX}
            ctuY={ctuY}
          />
        </div>
      )}

      {/* Sub-Tab 3: Standalone Simulator Sandbox */}
      {subTab === 'simulator' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              padding: '6px 10px',
              background: 'var(--fill-1)',
              border: '0.5px solid var(--separator)',
              borderRadius: '6px',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ color: 'var(--apple-label-secondary)' }}>
              Interactive RD Decision Sandbox &bull; Real-time recursive QuadTree cost simulator
            </span>
            <Badge variant="purple">SANDBOX EXPERIMENT</Badge>
          </div>
          <RdoQuadtreeSimulator
            key={`rdo_sim_guided_${ctuX}_${ctuY}`}
            imageSrc={imageSrc}
            imageDims={imageDims}
            ctuX={ctuX}
            ctuY={ctuY}
            partitionData={partitionData}
            rdoDecisions={rdoDecisions}
            selectedCu={selectedCu}
            onNavigateToStage={onNavigateToStage}
            showValues={showValues}
          />
        </div>
      )}
    </div>
  );
}

export default React.memo(Step5RdDecision);
