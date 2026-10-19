import React, { useState, useMemo, useEffect, useCallback } from 'react';
import TuQuadtreeHierarchyGraph from './TuQuadtreeHierarchyGraph';
import { buildRqtTree, generateRqtSimulationSteps, QUADRANT_NAMES } from '../../../utils/rqtTreeLayout';
import { Button, Slider } from '../../apple';

/**
 * TuTreeCallStack
 * RQT (Residual QuadTree) Transform Call Stack and Stepper Visualization.
 * Faithful 1:1 match with CTU QuadTree Call Stack (TreeCallStack.jsx) & Geometric Square Blocks.
 *
 * Features:
 * 1. Dual-View: 'tree' (Geometric Square Blocks Graph) | 'stack' (Compact Call Stack Badges)
 * 2. Playback & Step Controller: First, Prev, Play/Pause, Next, Last, Timeline Scrub Slider, Speed
 * 3. Two-Way Interactive Sync: Automatically notifies onSelectTu at every step to update matrices
 */
export default function TuTreeCallStack({
  tuEvents = [],
  cuX = 0,
  cuY = 0,
  cuSize = 32,
  component = 'Y',
  intraMode = null,
  selectedTu = null,
  onSelectTu = null,
  onExportDrawio = null
}) {
  const [viewMode, setViewMode] = useState('tree'); // 'tree' | 'stack'
  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(700); // 700ms normal

  // Build RQT tree and simulation steps
  const tree = useMemo(() => {
    return buildRqtTree(tuEvents, { cuX, cuY, cuSize, component, intraMode });
  }, [tuEvents, cuX, cuY, cuSize, component, intraMode]);

  const simSteps = useMemo(() => {
    return generateRqtSimulationSteps(tree, tuEvents);
  }, [tree, tuEvents]);

  const totalSteps = simSteps.length || 1;
  const safeStepIdx = Math.min(stepIdx, totalSteps - 1);
  const currentStep = simSteps[safeStepIdx] || simSteps[0];

  // Auto-play timer
  useEffect(() => {
    let timer;
    if (isPlaying) {
      timer = setInterval(() => {
        setStepIdx(prev => {
          if (prev >= totalSteps - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          if (onSelectTu && simSteps[next]?.tuRecord) {
            onSelectTu(simSteps[next].tuRecord);
          }
          return next;
        });
      }, speed);
    }
    return () => clearInterval(timer);
  }, [isPlaying, totalSteps, speed, onSelectTu, simSteps]);

  // Stepper handlers
  const handleStepJump = useCallback((targetIdx) => {
    const clamped = Math.max(0, Math.min(totalSteps - 1, targetIdx));
    setStepIdx(clamped);
    if (onSelectTu && simSteps[clamped]?.tuRecord) {
      onSelectTu(simSteps[clamped].tuRecord);
    }
  }, [totalSteps, simSteps, onSelectTu]);

  const handleFirst = () => { setIsPlaying(false); handleStepJump(0); };
  const handlePrev = () => { setIsPlaying(false); handleStepJump(safeStepIdx - 1); };
  const handleNext = () => { setIsPlaying(false); handleStepJump(safeStepIdx + 1); };
  const handleLast = () => { setIsPlaying(false); handleStepJump(totalSteps - 1); };
  const handleTogglePlay = () => setIsPlaying(p => !p);

  // Sync when selectedTu changes externally during render
  const [prevSelectedTu, setPrevSelectedTu] = useState(selectedTu);
  if (selectedTu !== prevSelectedTu) {
    setPrevSelectedTu(selectedTu);
    if (selectedTu && simSteps.length) {
      const selX = selectedTu.rawTuX ?? selectedTu.tu_x ?? selectedTu.absX;
      const selY = selectedTu.rawTuY ?? selectedTu.tu_y ?? selectedTu.absY;
      const selSize = selectedTu.width || selectedTu.size;

      const matchStepIdx = simSteps.findIndex(s => {
        if (!s.tuNode) return false;
        const n = s.tuNode;
        if (s.activeNodeId === selectedTu.id || n.id === selectedTu.id) return true;
        const sizeMatches = selSize ? (n.size === selSize) : true;
        if (selX !== undefined && selY !== undefined) {
          if (n.absX === selX && n.absY === selY && sizeMatches) return true;
          if (n.relX === selX && n.relY === selY && sizeMatches) return true;
          if (cuX !== 0 && (selX - cuX) === n.relX && (selY - cuY) === n.relY && sizeMatches) return true;
        }
        return false;
      });
      if (matchStepIdx !== -1) {
        setStepIdx(matchStepIdx);
      }
    }
  }

  // Handle direct node selection from the interactive RQT tree graph
  const handleGraphSelectTu = useCallback((tuRecord) => {
    if (!tuRecord) return;
    const targetX = tuRecord.rawTuX ?? tuRecord.tu_x ?? tuRecord.absX;
    const targetY = tuRecord.rawTuY ?? tuRecord.tu_y ?? tuRecord.absY;
    const targetSize = tuRecord.width ?? tuRecord.size;

    const matchStepIdx = simSteps.findIndex(s => {
      if (!s.tuNode) return false;
      const n = s.tuNode;
      if (tuRecord.id && (s.activeNodeId === tuRecord.id || n.id === tuRecord.id)) return true;
      const sizeMatch = targetSize ? (n.size === targetSize) : true;
      if (targetX !== undefined && targetY !== undefined) {
        if (n.absX === targetX && n.absY === targetY && sizeMatch) return true;
        if (n.relX === targetX && n.relY === targetY && sizeMatch) return true;
        if (cuX !== 0 && (targetX - cuX) === n.relX && (targetY - cuY) === n.relY && sizeMatch) return true;
      }
      return false;
    });

    if (matchStepIdx !== -1) {
      setStepIdx(matchStepIdx);
    }
    if (onSelectTu) {
      onSelectTu(tuRecord);
    }
  }, [simSteps, cuX, cuY, onSelectTu]);

  const rootSize = tree?.size || cuSize || 32;

  return (
    <div
      className="apple-card"
      style={{
        padding: '0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        background: 'var(--apple-surface)',
        border: '1px solid var(--apple-hairline)',
        borderRadius: 0,
        boxSizing: 'border-box'
      }}
    >
      {/* 1. Header & Controls: Exact Match to TreeCallStack.jsx */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.45rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--apple-label)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            Transform QuadTree Call Stack
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--apple-label-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
            D0 ({rootSize}) &rarr; D3 (4)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {/* View Toggle */}
          <div className="apple-segmented">
            <button
              type="button"
              className={`apple-segmented-item ${viewMode === 'tree' ? 'active' : ''}`}
              onClick={() => setViewMode('tree')}
              style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}
              title="Interactive Geometric Square Tree Graph"
            >
              Tree Graph
            </button>
            <button
              type="button"
              className={`apple-segmented-item ${viewMode === 'stack' ? 'active' : ''}`}
              onClick={() => setViewMode('stack')}
              style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}
              title="Compact RQT Call Stack Badges"
            >
              Call Stack
            </button>
          </div>

          {onExportDrawio && (
            <button
              type="button"
              className="apple-btn-secondary"
              onClick={onExportDrawio}
              style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}
              title="Export Current RQT State to Draw.io XML"
            >
              [+] Draw.io
            </button>
          )}
        </div>
      </div>

      {/* 2. Playback / Stepper Controller ("có tính năng để chạy") */}
      <div
        style={{
          background: 'var(--fill-1)',
          border: '0.5px solid var(--separator)',
          borderRadius: '6px',
          padding: '0.5rem 0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          {/* Stepper Buttons */}
          <div className="apple-segmented-track" style={{ height: '26px', padding: '2px', gap: '2px', alignItems: 'center', display: 'flex' }}>
            <Button
              variant="gray"
              size="small"
              onClick={handleFirst}
              disabled={safeStepIdx === 0}
              title="First Step"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', padding: '0 6px', height: '22px' }}
            >
              First
            </Button>
            <Button
              variant="gray"
              size="small"
              onClick={handlePrev}
              disabled={safeStepIdx === 0}
              title="Previous Step"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', padding: '0 6px', height: '22px' }}
            >
              Prev
            </Button>
            <Button
              variant={isPlaying ? 'filled' : 'gray'}
              size="small"
              onClick={handleTogglePlay}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10.5px',
                fontWeight: 700,
                padding: '0 10px',
                height: '22px',
                ...(isPlaying ? { backgroundColor: 'var(--system-orange, #FF9500)', color: '#FFFFFF' } : {})
              }}
              title={isPlaying ? 'Pause Stepper' : 'Auto-Play Stepper'}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button
              variant="gray"
              size="small"
              onClick={handleNext}
              disabled={safeStepIdx >= totalSteps - 1}
              title="Next Step"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', padding: '0 6px', height: '22px' }}
            >
              Next
            </Button>
            <Button
              variant="gray"
              size="small"
              onClick={handleLast}
              disabled={safeStepIdx >= totalSteps - 1}
              title="Last Step"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', padding: '0 6px', height: '22px' }}
            >
              Last
            </Button>
          </div>

          {/* Speed Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--apple-label-secondary)', fontFamily: 'var(--font-mono)' }}>Speed:</span>
            {[
              { label: '0.5×', ms: 1200 },
              { label: '1.0×', ms: 700 },
              { label: '2.0×', ms: 350 },
            ].map((sp) => (
              <button
                key={sp.label}
                type="button"
                onClick={() => setSpeed(sp.ms)}
                style={{
                  height: '20px',
                  padding: '0 5px',
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: speed === sp.ms ? 700 : 400,
                  background: speed === sp.ms ? 'var(--apple-blue, #007AFF)' : 'var(--fill-2)',
                  color: speed === sp.ms ? '#FFFFFF' : 'var(--apple-label)',
                  border: '0.5px solid var(--separator)',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                {sp.label}
              </button>
            ))}
          </div>

          {/* Step Counter Badge */}
          <div style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--apple-blue)' }}>
            Step {safeStepIdx + 1} / {totalSteps}
          </div>
        </div>

        {/* Timeline Slider & Action Banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Slider
            min={0}
            max={Math.max(1, totalSteps - 1)}
            step={1}
            value={safeStepIdx}
            onChange={(val) => handleStepJump(val)}
            style={{ flex: 1 }}
          />
        </div>

        {/* Action Banner: Current Step Description */}
        <div
          style={{
            fontSize: '11px',
            fontFamily: 'JetBrains Mono, monospace',
            background: 'var(--fill-2)',
            padding: '4px 8px',
            borderRadius: '4px',
            color: 'var(--apple-label)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span style={{ color: 'var(--system-orange, #FF9500)', fontWeight: 800 }}>
            [STEP {safeStepIdx + 1}]:
          </span>
          <span style={{ fontWeight: 600 }}>{currentStep?.title}</span>
          <span style={{ color: 'var(--apple-label-secondary)', marginLeft: 'auto', fontSize: '10px' }}>
            {currentStep?.desc}
          </span>
        </div>
      </div>

      {/* 3. View 1: Interactive QuadTree Hierarchy Graph */}
      {viewMode === 'tree' ? (
        <div style={{ width: '100%' }}>
          <TuQuadtreeHierarchyGraph
            tuEvents={tuEvents}
            cuX={cuX}
            cuY={cuY}
            cuSize={cuSize}
            component={component}
            intraMode={intraMode}
            selectedTu={selectedTu || currentStep?.tuRecord}
            activeNodeId={currentStep?.activeNodeId}
            onSelectTu={handleGraphSelectTu}
          />
        </div>
      ) : (
        /* 4. View 2: Compact Stack Badges (Exact match to TreeCallStack.jsx) */
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.45rem',
            maxHeight: '260px',
            overflowY: 'auto',
            padding: '0.55rem',
            background: 'var(--apple-canvas)',
            border: '1px solid var(--apple-hairline)',
            borderRadius: '6px'
          }}
        >
          {(currentStep?.callStack || []).map((n, idx) => {
            const isActive = n.id === currentStep?.activeNodeId;
            let borderColor = 'var(--separator)';
            let bgColor = 'var(--fill-1)';

            if (isActive) {
              borderColor = '#FF9500';
              bgColor = 'rgba(255, 149, 0, 0.12)';
            } else if (n.status === 'LEAF') {
              borderColor = '#34C759';
              bgColor = 'rgba(52, 199, 89, 0.1)';
            } else if (n.status === 'SPLIT') {
              borderColor = '#007AFF';
              bgColor = 'rgba(0, 122, 255, 0.1)';
            }

            return (
              <div
                key={n.id || idx}
                onClick={() => {
                  const targetStepIdx = simSteps.findIndex(s => s.activeNodeId === n.id);
                  if (targetStepIdx !== -1) handleStepJump(targetStepIdx);
                }}
                style={{
                  border: `1px solid ${borderColor}`,
                  background: bgColor,
                  borderRadius: '6px',
                  padding: '0.35rem 0.55rem',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.68rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.15rem',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 0 0 1.5px #FF9500' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}>
                  <span style={{ fontWeight: 800, color: 'var(--apple-label)' }}>D{n.depth}: {n.size}&times;{n.size}</span>
                  <span style={{ fontSize: '0.62rem', color: 'var(--apple-label-secondary)' }}>
                    {QUADRANT_NAMES[idx % 4]}
                  </span>
                </div>

                <div style={{ fontSize: '0.62rem', color: 'var(--apple-label)' }}>
                  {n.label}
                </div>

                <div style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  color: n.status === 'SPLIT' ? '#007AFF' : n.status === 'LEAF' ? '#34C759' : '#FF9500'
                }}>
                  {n.status}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
