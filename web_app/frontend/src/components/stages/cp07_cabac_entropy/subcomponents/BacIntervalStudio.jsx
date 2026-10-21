import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, Badge, Button, SegmentedControl } from '../../../apple';
import {
  createInitialBacState,
  stepBacEncode,
  getLpsProbability,
  AUC_LPS_TABLE,
} from '../../../../utils/cabacMathEngine';

/**
 * BacIntervalStudio
 * 
 * Interactive studio for HEVC Binary Arithmetic Coder (BAC) interval subdivision [L, L + R),
 * FSM 64-state probability modeling, and Renormalization bitstream emission.
 */
const BacIntervalStudio = ({
  traceBins = [],
  externalBinFeed = null,
}) => {
  const [mode, setMode] = useState('trace'); // 'trace' | 'sandbox'
  const [bacState, setBacState] = useState(() => createInitialBacState());
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1); // 1x, 2x, 5x
  const [sandboxCustomInput, setSandboxCustomInput] = useState('10110');

  // Active bin sequence depending on mode
  const activeBins = useMemo(() => {
    if (mode === 'trace') {
      if (Array.isArray(traceBins) && traceBins.length > 0) {
        return traceBins.map(b => ({
          bin: b.bin ?? 0,
          syntax: b.syntax_element || 'syntax_bin',
          isBypass: b.syntax_element?.includes('bypass') || b.syntax_element === 'rem_intra_luma_pred_mode' || false,
        }));
      }
      // Default fallback sequence for demonstration when no trace is available
      return [
        { bin: 0, syntax: 'split_cu_flag', isBypass: false },
        { bin: 1, syntax: 'prev_intra_luma_pred_flag', isBypass: false },
        { bin: 0, syntax: 'mpm_idx', isBypass: true },
        { bin: 1, syntax: 'cbf_luma', isBypass: false },
        { bin: 0, syntax: 'split_transform_flag', isBypass: false },
        { bin: 1, syntax: 'coeff_abs_level_greater1_flag', isBypass: false },
      ];
    }
    // Sandbox sequence from custom input
    return sandboxCustomInput.split('').filter(c => c === '0' || c === '1').map(c => ({
      bin: Number(c),
      syntax: 'sandbox_custom_bin',
      isBypass: false,
    }));
  }, [mode, traceBins, sandboxCustomInput]);

  // Handle external bin feed from BinarizationTreeViewer
  const [prevExternalFeed, setPrevExternalFeed] = useState(externalBinFeed);
  if (externalBinFeed && externalBinFeed !== prevExternalFeed) {
    setPrevExternalFeed(externalBinFeed);
    if (externalBinFeed.binString) {
      setMode('sandbox');
      setSandboxCustomInput(externalBinFeed.binString);
      setBacState(createInitialBacState());
      setActiveStepIdx(0);
      setIsPlaying(false);
    }
  }

  // Reset BAC state whenever mode or custom input changes
  const handleReset = useCallback(() => {
    setBacState(createInitialBacState());
    setActiveStepIdx(0);
    setIsPlaying(false);
  }, []);

  // Step Forward
  const handleStepForward = useCallback(() => {
    if (activeStepIdx >= activeBins.length) return;
    const currentItem = activeBins[activeStepIdx];
    const { newState } = stepBacEncode(bacState, currentItem.bin, currentItem.isBypass);
    setBacState(newState);
    setActiveStepIdx(prev => prev + 1);
  }, [activeStepIdx, activeBins, bacState]);

  // Step Backward
  const handleStepBackward = useCallback(() => {
    if (activeStepIdx <= 0) return;
    const targetIdx = activeStepIdx - 1;
    // Replay up to targetIdx from clean initial state
    let state = createInitialBacState();
    for (let i = 0; i < targetIdx; i++) {
      const item = activeBins[i];
      const res = stepBacEncode(state, item.bin, item.isBypass);
      state = res.newState;
    }
    setBacState(state);
    setActiveStepIdx(targetIdx);
  }, [activeStepIdx, activeBins]);

  // Auto-play timer
  const playTimerRef = useRef(null);
  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      return;
    }

    const intervalMs = Math.max(100, Math.round(900 / playSpeed));
    playTimerRef.current = setInterval(() => {
      setActiveStepIdx(prevIdx => {
        if (prevIdx >= activeBins.length) {
          setIsPlaying(false);
          return prevIdx;
        }
        setBacState(prevState => {
          const item = activeBins[prevIdx];
          const { newState } = stepBacEncode(prevState, item.bin, item.isBypass);
          return newState;
        });
        return prevIdx + 1;
      });
    }, intervalMs);

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, playSpeed, activeBins]);

  // Feed Manual Bin in Sandbox
  const handleFeedManualBin = (val, isBypass = false) => {
    const { newState } = stepBacEncode(bacState, val, isBypass);
    setBacState(newState);
    setActiveStepIdx(prev => prev + 1);
  };

  // Current calculations
  const curRange = bacState.range;
  const curPState = bacState.pStateIdx;
  const curValMPS = bacState.valMPS;
  const qCodIRangeIdx = (curRange >> 6) & 3;
  const curLpsRange = AUC_LPS_TABLE[curPState][qCodIRangeIdx];
  const curMpsRange = curRange - curLpsRange;
  const mpsPercent = Math.max(5, Math.min(95, (curMpsRange / curRange) * 100));
  const lpsPercent = 100 - mpsPercent;
  const pLpsEst = (getLpsProbability(curPState) * 100).toFixed(1);

  const lastRecord = bacState.history && bacState.history.length > 0
    ? bacState.history[bacState.history.length - 1]
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', boxSizing: 'border-box' }}>
      {/* Top Studio Controls Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '8px 12px',
          background: 'var(--fill-2)',
          borderRadius: '8px',
          border: '0.5px solid var(--separator)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SegmentedControl
            value={mode}
            onChange={(m) => {
              setMode(m);
              handleReset();
            }}
            size="small"
            items={[
              { id: 'trace', label: 'Trace Playback' },
              { id: 'sandbox', label: 'Interactive Sandbox' },
            ]}
          />
          <Badge variant={mode === 'trace' ? 'blue' : 'orange'}>
            {mode === 'trace' ? `${activeBins.length} Bins Queued` : 'Sandbox Simulator'}
          </Badge>
        </div>

        {/* Transport buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Button
            variant="gray"
            size="small"
            onClick={handleStepBackward}
            disabled={activeStepIdx <= 0 || isPlaying}
            title="Step Backward"
          >
            ◀ Step
          </Button>
          <Button
            variant={isPlaying ? 'yellow' : 'blue'}
            size="small"
            onClick={() => setIsPlaying(p => !p)}
            disabled={activeStepIdx >= activeBins.length}
          >
            {isPlaying ? 'Pause ⏸' : 'Play ▶'}
          </Button>
          <Button
            variant="gray"
            size="small"
            onClick={handleStepForward}
            disabled={activeStepIdx >= activeBins.length || isPlaying}
            title="Step Forward"
          >
            Step ▶
          </Button>
          <Button
            variant="gray"
            size="small"
            onClick={handleReset}
            title="Reset BAC State"
          >
            Reset ↺
          </Button>

          <SegmentedControl
            value={playSpeed}
            onChange={setPlaySpeed}
            size="small"
            items={[
              { id: 1, label: '1×' },
              { id: 2, label: '2×' },
              { id: 5, label: '5×' },
            ]}
          />
        </div>
      </div>

      {/* Sandbox Direct Manual Input Banner */}
      {mode === 'sandbox' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '8px 12px',
            background: 'var(--fill-1)',
            borderRadius: '6px',
            border: '0.5px solid var(--separator)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--apple-label-secondary)', fontWeight: 600 }}>
              CUSTOM BINS:
            </span>
            <input
              type="text"
              value={sandboxCustomInput}
              onChange={(e) => {
                setSandboxCustomInput(e.target.value.replace(/[^01]/g, ''));
                handleReset();
              }}
              placeholder="e.g. 101100"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                padding: '2px 8px',
                width: '140px',
                borderRadius: '4px',
                border: '0.5px solid var(--separator)',
                background: 'var(--apple-surface)',
                color: 'var(--apple-label-primary)',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--apple-label-secondary)' }}>
              Feed Manual:
            </span>
            <Button size="mini" variant="blue" onClick={() => handleFeedManualBin(curValMPS, false)}>
              Feed MPS ({curValMPS})
            </Button>
            <Button size="mini" variant="red" onClick={() => handleFeedManualBin(1 - curValMPS, false)}>
              Feed LPS ({1 - curValMPS})
            </Button>
            <Button size="mini" variant="gray" onClick={() => handleFeedManualBin(1, true)}>
              Feed Bypass (1)
            </Button>
          </div>
        </div>
      )}

      {/* Main Studio Deck: Interval Bar + Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
        <Card style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
            CURRENT INTERVAL RANGE (R)
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--apple-label)' }}>
              {curRange}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--apple-label-secondary)', fontFamily: 'var(--font-mono)' }}>
              (0x{curRange.toString(16).toUpperCase()})
            </span>
            {curRange < 256 && (
              <Badge variant="yellow" style={{ fontSize: '9.5px' }}>Needs Renorm</Badge>
            )}
          </div>
        </Card>

        <Card style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
            FSM STATE &amp; POLARITY
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--apple-blue)' }}>
              State {curPState}
            </span>
            <Badge variant="blue">MPS = {curValMPS}</Badge>
            <span style={{ fontSize: '11px', color: 'var(--apple-label-secondary)', fontFamily: 'var(--font-mono)' }}>
              p(LPS) ≈ {pLpsEst}%
            </span>
          </div>
        </Card>

        <Card style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
            RANGE PARTITION (R_MPS vs R_LPS)
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--apple-blue)' }}>
              {curMpsRange}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--apple-label-secondary)' }}>vs</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#FF3B30' }}>
              {curLpsRange}
            </span>
            <span style={{ fontSize: '10.5px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
              LUT qIdx={qCodIRangeIdx}
            </span>
          </div>
        </Card>

        <Card style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
            ENCODED BITSTREAM OUTPUT
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--system-green)' }}>
              {bacState.totalBits} <span style={{ fontSize: '0.8rem', color: 'var(--apple-label-secondary)' }}>bits</span>
            </span>
            <span style={{ fontSize: '11px', color: 'var(--apple-label-secondary)', fontFamily: 'var(--font-mono)' }}>
              ({bacState.totalBins} bins)
            </span>
          </div>
        </Card>
      </div>

      {/* DYNAMIC BAC INTERVAL BAR (Mathematical Representation of [0, R)) */}
      <Card style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>
            BAC Range Interval Subdivision: [0, {curRange})
          </div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--apple-blue)' }}>■ MPS Span ({curMpsRange})</span>
            <span style={{ color: '#FF3B30' }}>■ LPS Span ({curLpsRange})</span>
          </div>
        </div>

        {/* Visual Dual-Color Bar */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '38px',
            borderRadius: '6px',
            overflow: 'hidden',
            display: 'flex',
            background: 'var(--apple-border)',
            border: '1px solid var(--separator)',
            boxSizing: 'border-box',
          }}
        >
          {/* MPS Sub-interval */}
          <div
            style={{
              width: `${mpsPercent}%`,
              background: 'linear-gradient(90deg, #007AFF 0%, #0056B3 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.2px',
              transition: 'width 0.25s ease',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            MPS [{curValMPS}]: 0 .. {curMpsRange} ({mpsPercent.toFixed(0)}%)
          </div>

          {/* LPS Sub-interval */}
          <div
            style={{
              width: `${lpsPercent}%`,
              background: 'linear-gradient(90deg, #FF3B30 0%, #D32F2F 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.2px',
              transition: 'width 0.25s ease',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            LPS [{1 - curValMPS}]: {curMpsRange} .. {curRange} ({lpsPercent.toFixed(0)}%)
          </div>
        </div>

        {/* Tick marks and scale */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--apple-label-secondary)' }}>
          <span>L = 0</span>
          <span>Split: {curMpsRange}</span>
          <span>R = {curRange}</span>
        </div>
      </Card>

      {/* 64-State FSM Ribbon & Renormalization Tube */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* FSM 64-State Tracker */}
        <Card style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600 }}>FSM Probability State Ribbon (0..62)</span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--apple-label-tertiary)' }}>
              Active: #{curPState}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '3px',
              overflowX: 'auto',
              padding: '6px 2px',
              borderBottom: '0.5px solid var(--separator)',
            }}
          >
            {Array.from({ length: 63 }).map((_, st) => {
              const isActive = st === curPState;
              return (
                <div
                  key={`st-${st}`}
                  style={{
                    minWidth: '18px',
                    height: '24px',
                    borderRadius: '3px',
                    background: isActive ? 'var(--apple-blue)' : 'var(--fill-3)',
                    color: isActive ? '#FFFFFF' : 'var(--apple-label-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9.5px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: isActive ? 700 : 500,
                    border: isActive ? '1px solid #0056B3' : '0.5px solid var(--separator)',
                    flexShrink: 0,
                  }}
                >
                  {st}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--apple-label-secondary)', marginTop: '4px' }}>
            <span>State 0 (Uncertain, p≈50%)</span>
            <span>State 62 (Certain, p≈1.9%)</span>
          </div>
        </Card>

        {/* Emitted Bitstream FIFO Tube */}
        <Card style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Renormalization Bitstream FIFO</span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--system-green)', fontWeight: 600 }}>
              {bacState.bitstream.length} Bits Emitted
            </span>
          </div>

          <div
            style={{
              height: '34px',
              background: 'var(--fill-2)',
              borderRadius: '6px',
              border: '0.5px solid var(--separator)',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              overflowX: 'auto',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {bacState.bitstream.length === 0 ? (
              <span style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)' }}>
                No bits emitted yet. Step through bins to observe renormalization.
              </span>
            ) : (
              bacState.bitstream.map((b, i) => (
                <span
                  key={`bit-${i}`}
                  style={{
                    padding: '1px 5px',
                    borderRadius: '3px',
                    background: b === 1 ? 'var(--apple-blue)' : 'var(--fill-4)',
                    color: b === 1 ? '#FFFFFF' : 'var(--apple-label-primary)',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  {b}
                </span>
              ))
            )}
          </div>

          {lastRecord && (
            <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--apple-label-secondary)' }}>
              Last Step: Bin <strong>{lastRecord.binValue}</strong> ({lastRecord.isLPS ? 'LPS' : 'MPS'}) &bull;
              Shifted Low: {lastRecord.oldLow} → {lastRecord.newLow} &bull; Emitted: [{lastRecord.emittedBits.join(', ')}]
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default React.memo(BacIntervalStudio);
