import React, { useState, useEffect, useMemo, useDeferredValue, useRef, useCallback } from 'react';
import {
  runHevcQuadtreeSimulation,
  generateSyntheticCtuPattern,
  computeLambda,
  computeQstep
} from '../../../utils/hevcRdoSimulator';
import { buildSimulatorQuadtreeTree } from '../../../utils/quadtreeTreeLayout';

import SimulatorControls from './subcomponents/SimulatorControls';
import PartitionCanvas from './subcomponents/PartitionCanvas';
import RdoDecisionCard from './subcomponents/RdoDecisionCard';
import PixelMicroscope from './subcomponents/PixelMicroscope';
import CandidateModesTable from './subcomponents/CandidateModesTable';
import TreeCallStack from './subcomponents/TreeCallStack';
import HmSourceCodeModal from '../../common/HmSourceCodeModal';
import DrawioExportModal from '../../common/DrawioExportModal';
import { HM_RDO_COST_SIMULATION_SNIPPET } from '../../../constants/hmSourceSnippets';
import { Button, Card, Badge, Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../apple';

/**
 * RdoQuadtreeSimulator
 * Interactive HEVC xCompressCU QuadTree & RDO Microscope.
 * Strict functional minimalism according to hevc-pixel-accurate-design skill:
 * - High information density, quiet neutral chrome.
 * - Zero hover bounces or decorative emojis.
 * - 100% discrete pixel and color fidelity.
 */
function RdoQuadtreeSimulator({
  imageSrc = null,
  imageDims = { width: 640, height: 360 },
  ctuX = 0,
  ctuY = 0,
  partitionData = null,
  rdoDecisions = [],
  candidateDetails = [],
  selectedCu = null,
  onNavigateToStage = null,
  showValues: propsShowValues = undefined,
  onToggleValues = null,
}) {
  const [qp, setQp] = useState(32);
  const deferredQp = useDeferredValue(qp);
  const [speed, setSpeed] = useState(650);
  const [patternType, setPatternType] = useState(imageSrc ? 'image' : 'gradient');
  const [customPatch, setCustomPatch] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [internalShowValues, setInternalShowValues] = useState(true);
  const showValues = propsShowValues !== undefined ? propsShowValues : internalShowValues;
  const setShowValues = onToggleValues || setInternalShowValues;
  const [showHmModal, setShowHmModal] = useState(false);
  const [showDrawioModal, setShowDrawioModal] = useState(false);

  // Extract 64x64 discrete Luma samples (BT.709) from imageSrc
  useEffect(() => {
    if (patternType !== 'image' || !imageSrc) return;

    let isCurrent = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!isCurrent) return;
      const cvs = document.createElement('canvas');
      cvs.width = imageDims.width || 640;
      cvs.height = imageDims.height || 360;
      const ctx = cvs.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, cvs.width, cvs.height);

      const startX = Math.max(0, Math.min(cvs.width - 64, ctuX * 64));
      const startY = Math.max(0, Math.min(cvs.height - 64, ctuY * 64));
      const imgData = ctx.getImageData(startX, startY, 64, 64);
      const luma64 = new Array(64 * 64);
      for (let i = 0; i < 64 * 64; i++) {
        const r = imgData.data[i * 4];
        const g = imgData.data[i * 4 + 1];
        const b = imgData.data[i * 4 + 2];
        // Exact ITU-R BT.709 Full-Range Luma
        luma64[i] = Math.max(0, Math.min(255, Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)));
      }
      setCustomPatch(luma64);
    };
    img.src = imageSrc;

    return () => {
      isCurrent = false;
    };
  }, [patternType, imageSrc, ctuX, ctuY, imageDims]);

  // Active 64x64 CTU original patch
  const activeCtuPatch = useMemo(() => {
    if (patternType === 'image' && customPatch && customPatch.length === 4096) {
      return customPatch;
    }
    return generateSyntheticCtuPattern(patternType === 'image' ? 'gradient' : patternType);
  }, [patternType, customPatch]);

  const currentCtuDecisions = useMemo(() => {
    if (!Array.isArray(rdoDecisions) || rdoDecisions.length === 0) return [];
    return rdoDecisions.filter(d => (ctuX == null || d.ctu_x === ctuX) && (ctuY == null || d.ctu_y === ctuY));
  }, [rdoDecisions, ctuX, ctuY]);

  // Simulation execution result (synced with HM encoder ground-truth when available)
  const isGroundTruthActive = patternType === 'image' && Boolean(partitionData?.nodes?.length);
  const [workerResult, setWorkerResult] = useState(null);
  const [_isCalculating, setIsCalculating] = useState(false);
  const workerRef = useRef(null);
  const activeRequestIdRef = useRef(0);

  // Synchronous calculation function (used for initial render, tests, and error fallback)
  const runSyncSimulation = useCallback(() => {
    return runHevcQuadtreeSimulation({
      ctuPatch: activeCtuPatch,
      qp: deferredQp,
      groundTruthNodes: isGroundTruthActive ? partitionData.nodes : null,
      rdoDecisions: isGroundTruthActive ? currentCtuDecisions : null,
      candidateDetails: isGroundTruthActive ? candidateDetails : null
    });
  }, [activeCtuPatch, deferredQp, isGroundTruthActive, partitionData, currentCtuDecisions, candidateDetails]);

  // Synchronous fallback (and initial value) for immediate render & tests
  const syncSimResult = useMemo(() => {
    return runSyncSimulation();
  }, [runSyncSimulation]);

  // Web Worker lifecycle: run simulation off the main UI thread
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        const worker = new Worker(
          new URL('../../../workers/rdoSimulator.worker.js', import.meta.url),
          { type: 'module' }
        );
        workerRef.current = worker;
        worker.onmessage = (e) => {
          if (e.data?.id === activeRequestIdRef.current) {
            if (e.data?.status === 'success' && e.data?.result) {
              setWorkerResult(e.data.result);
            } else if (e.data?.status === 'error') {
              console.warn('Worker error, falling back to sync simulation:', e.data?.error);
              setWorkerResult(runSyncSimulation());
            }
            setIsCalculating(false);
          }
        };
        worker.onerror = (err) => {
          console.warn('Worker runtime error, falling back to sync simulation:', err);
          setWorkerResult(runSyncSimulation());
          setIsCalculating(false);
        };
        return () => {
          worker.terminate();
          workerRef.current = null;
        };
      } catch (err) {
        console.warn('Simulator Web Worker not supported in this environment, using main thread:', err);
      }
    }
  }, [runSyncSimulation]);

  // Post simulation request to worker when inputs change; invalidate previous result
  useEffect(() => {
    const reqId = ++activeRequestIdRef.current;
    if (workerRef.current) {
      setWorkerResult(null);
      setIsCalculating(true);
      workerRef.current.postMessage({
        id: reqId,
        params: {
          ctuPatch: activeCtuPatch,
          qp: deferredQp,
          groundTruthNodes: isGroundTruthActive ? partitionData.nodes : null,
          rdoDecisions: isGroundTruthActive ? currentCtuDecisions : null,
          candidateDetails: isGroundTruthActive ? candidateDetails : null
        }
      });
    }
  }, [activeCtuPatch, deferredQp, isGroundTruthActive, partitionData?.nodes, currentCtuDecisions, candidateDetails]);

  const simResult = workerResult || syncSimResult;

  const totalSteps = simResult.totalSteps || 1;
  const safeStepIdx = Math.min(stepIdx, totalSteps - 1);
  const currentStep = simResult.steps[safeStepIdx] || simResult.steps[0];

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
          return prev + 1;
        });
      }, speed);
    }
    return () => clearInterval(timer);
  }, [isPlaying, totalSteps, speed]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setStepIdx(prev => Math.min(totalSteps - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setStepIdx(prev => Math.max(0, prev - 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying(p => !p);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsPlaying(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [totalSteps]);

  const activeNode = currentStep?.node || {};
  const activeEval = currentStep?.activeModeEval || currentStep?.allEvaluations?.[0] || null;
  const qstepVal = computeQstep(qp);
  const lambdaVal = computeLambda(qp);

  const simTree = useMemo(() => {
    return buildSimulatorQuadtreeTree(currentStep?.treeSnapshot, activeNode.id, currentStep?.callStack);
  }, [currentStep?.treeSnapshot, activeNode.id, currentStep?.callStack]);

  return (
    <div className="stage-section-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* 1. Header */}
      <div className="stage-section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div className="stage-section-title">
            CU QuadTree RDO &amp; xCompressCU
          </div>
          {isGroundTruthActive ? (
            <Badge variant="blue" style={{ fontSize: '11px' }}>
              HM TRACE GROUND-TRUTH
            </Badge>
          ) : (
            <Badge variant="orange" style={{ fontSize: '11px' }}>
              SYNTHETIC SANDBOX SIMULATION
            </Badge>
          )}
          {partitionData?.ctu_actual_bits != null && (
            <Badge variant="green" style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }} title="Written bitstream size by TEncSlice::encodeCtu()">
              Actual bits — CTU: {partitionData.ctu_actual_bits.toLocaleString()} b
            </Badge>
          )}
          <span style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: 'JetBrains Mono' }}>
            HM TEncCu::xCompressCU
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Button
            variant="gray"
            size="small"
            onClick={() => setShowDrawioModal(true)}
            title="Export / Copy Draw.io XML for current RDO tree"
          >
            [+] Draw.io XML
          </Button>

          <Button
            variant="filled"
            size="small"
            onClick={() => setShowHmModal(true)}
            title="Inspect HM-18.0 C++ Source Code for xCompressCU"
          >
            &lt;&gt; Show HM Code
          </Button>

          {onNavigateToStage && (
            <Button
              variant="gray"
              size="small"
              onClick={() => onNavigateToStage('CP_01')}
            >
              Trace View
            </Button>
          )}
        </div>
      </div>

      {/* HM-18.0 Measured RDO Decisions from Trace */}
      {currentCtuDecisions.length > 0 && (
        <Card style={{ padding: '10px 14px', border: '0.5px solid var(--separator)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                HM-18.0 MEASURED CU RDO DECISIONS (Trace Ground Truth)
              </span>
              <Badge variant="green">{currentCtuDecisions.length} Nodes Recorded</Badge>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
              xCompressCU &bull; J_nosplit vs J_split
            </span>
          </div>
          <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
            <Table style={{ fontSize: '11px' }}>
              <TableHeader>
                <TableRow>
                  <TableHead>Depth</TableHead>
                  <TableHead>CU Block (x, y)</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>J_best_nonSplit</TableHead>
                  <TableHead>J_split</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Best Mode</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentCtuDecisions.map((dec, idx) => {
                  const isSel = selectedCu && ((selectedCu.abs_x ?? selectedCu.x) === dec.cu_x && (selectedCu.abs_y ?? selectedCu.y) === dec.cu_y);
                  return (
                    <TableRow key={idx} style={{ background: isSel ? 'var(--apple-blue-subtle, rgba(0,122,255,0.1))' : undefined }}>
                      <TableCell style={{ fontFamily: 'var(--font-mono)' }}>{dec.depth}</TableCell>
                      <TableCell style={{ fontFamily: 'var(--font-mono)' }}>({dec.cu_x}, {dec.cu_y})</TableCell>
                      <TableCell style={{ fontFamily: 'var(--font-mono)' }}>{dec.cu_size}×{dec.cu_size}</TableCell>
                      <TableCell style={{ fontFamily: 'var(--font-mono)' }}>
                        {(dec.nosplit?.cost ?? dec.cost_nosplit ?? 0).toFixed(1)}
                        {dec.nosplit?.qp ? ` (QP${dec.nosplit.qp})` : ''}
                      </TableCell>
                      <TableCell style={{ fontFamily: 'var(--font-mono)' }}>
                        {dec.split_evaluated === false
                          ? '— (Not evaluated)'
                          : `${(dec.split?.cost ?? dec.cost_split ?? 0).toFixed(1)}${dec.split?.qp ? ` (QP${dec.split.qp})` : ''}`}
                      </TableCell>
                      <TableCell>
                        <Badge variant={dec.split_decision ? 'orange' : 'green'}>
                          {dec.split_decision ? 'SPLIT (4×Sub-CUs)' : 'NO SPLIT (Leaf)'}
                        </Badge>
                      </TableCell>
                      <TableCell style={{ fontFamily: 'var(--font-mono)' }}>
                        {dec.best_mode >= 0 ? `Mode ${dec.best_mode}` : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* 2. Timeline Controls */}
      <SimulatorControls
        stepIdx={safeStepIdx}
        totalSteps={totalSteps}
        isPlaying={isPlaying}
        onFirst={() => { setIsPlaying(false); setStepIdx(0); }}
        onPrev={() => { setIsPlaying(false); setStepIdx(prev => Math.max(0, prev - 1)); }}
        onTogglePlay={() => setIsPlaying(p => !p)}
        onNext={() => { setIsPlaying(false); setStepIdx(prev => Math.min(totalSteps - 1, prev + 1)); }}
        onLast={() => { setIsPlaying(false); setStepIdx(totalSteps - 1); }}
        qp={qp}
        lambdaVal={lambdaVal}
        onQpChange={(newQp) => { setQp(newQp); setStepIdx(0); }}
        speed={speed}
        onSpeedChange={setSpeed}
        patternType={patternType}
        onPatternChange={(p) => { setPatternType(p); setStepIdx(0); }}
        hasImage={Boolean(imageSrc)}
        ctuX={ctuX}
        ctuY={ctuY}
        showValues={showValues}
        onToggleValues={propsShowValues === undefined ? (() => setShowValues(v => !v)) : null}
      />

      {/* 3. Call Stack Breadcrumb & Action Banner */}
      <Card style={{
        padding: '0.65rem 0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.45rem'
      }}>
        {/* Call Stack Breadcrumbs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--apple-label-secondary)', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
            Stack:
          </span>
          {currentStep?.callStack?.map((frame, idx) => {
            const isTop = idx === currentStep.callStack.length - 1;
            return (
              <span key={frame.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{
                  fontSize: '0.7rem',
                  fontFamily: 'JetBrains Mono',
                  fontWeight: isTop ? 800 : 600,
                  color: isTop ? 'var(--apple-blue)' : 'var(--apple-label-secondary)',
                  background: isTop ? 'var(--apple-blue-subtle)' : 'var(--apple-canvas)',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '4px',
                  border: isTop ? '1px solid rgba(0, 122, 255, 0.25)' : '1px solid var(--apple-hairline)'
                }}>
                  {frame.depth === 0 ? 'CTU' : `Sub_${frame.childIndex}`}({frame.size}×{frame.size})
                </span>
                {idx < currentStep.callStack.length - 1 && <span style={{ color: '#94A3B8' }}>›</span>}
              </span>
            );
          })}
        </div>

        {/* Current Step Description */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 800,
              color: 'var(--apple-label-primary)',
              marginRight: '0.5rem'
            }}>
              {currentStep?.title}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--apple-label-secondary)', fontFamily: 'JetBrains Mono' }}>
              {currentStep?.description}
            </span>
          </div>

          <Badge
            variant={currentStep?.type === 'BACKTRACK_DECISION' ? 'filled' : 'tag'}
            color={currentStep?.type === 'BACKTRACK_DECISION' ? 'orange' : 'blue'}
          >
            {currentStep?.type}
          </Badge>
        </div>
      </Card>

      {/* 4. Main 2-Column Inspector Area */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(330px, 350px) minmax(0, 1fr)', gap: '0.85rem' }}>
        {/* Left Column: 64x64 CTU Partition Canvas & RDO Decision Math Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', minWidth: 0, boxSizing: 'border-box' }}>
          <PartitionCanvas
            activeCtuPatch={activeCtuPatch}
            currentStep={currentStep}
            activeNode={activeNode}
            treeRoot={simTree}
          />

          <RdoDecisionCard
            qp={qp}
            qstepVal={qstepVal}
            lambdaVal={lambdaVal}
            activeEval={activeEval}
            currentStep={currentStep}
          />
        </div>

        {/* Right Column: 4-Picture Microscope & Tree Call Stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', minWidth: 0, boxSizing: 'border-box' }}>
          <PixelMicroscope
            size={activeNode.size}
            origBlock={currentStep?.origBlock}
            activeEval={activeEval}
            showValues={showValues}
          />

          <CandidateModesTable
            size={activeNode.size}
            evaluations={currentStep?.allEvaluations}
          />

          <TreeCallStack
            treeSnapshot={currentStep?.treeSnapshot}
            activeNodeId={activeNode.id}
            callStack={currentStep?.callStack}
            onExportDrawio={() => setShowDrawioModal(true)}
          />
        </div>
      </div>

      {/* HM-18.0 Source Code Inspector Modal for RDO Evaluation & xCompressCU */}
      <HmSourceCodeModal
        isOpen={showHmModal}
        onClose={() => setShowHmModal(false)}
        title={HM_RDO_COST_SIMULATION_SNIPPET.title}
        sourceFile={HM_RDO_COST_SIMULATION_SNIPPET.sourceFile}
        functionName={HM_RDO_COST_SIMULATION_SNIPPET.functionName}
        standardRef={HM_RDO_COST_SIMULATION_SNIPPET.standardRef}
        description={HM_RDO_COST_SIMULATION_SNIPPET.description}
        variables={[
          { name: 'Active QP', value: qp, highlight: true },
          { name: 'Quantization Step (Qstep)', value: qstepVal.toFixed(2) },
          { name: 'Lagrange Multiplier (λ)', value: lambdaVal.toFixed(2), highlight: true },
          { name: 'Active Node', value: `${activeNode.size}×${activeNode.size} samples (Depth ${activeNode.depth ?? 0})` },
          { name: 'Simulation Step', value: `${safeStepIdx + 1} / ${totalSteps}` },
          { name: 'Current Event', value: currentStep?.type || 'EVAL' },
        ]}
        codeSnippet={HM_RDO_COST_SIMULATION_SNIPPET.codeSnippet}
      />

      {/* Draw.io / diagrams.net XML Export Modal */}
      <DrawioExportModal
        isOpen={showDrawioModal}
        onClose={() => setShowDrawioModal(false)}
        treeRoot={simTree}
        ctuX={ctuX}
        ctuY={ctuY}
        leafCount={Object.values(currentStep?.treeSnapshot || {}).filter(n => n.status === 'LEAF').length}
        maxDepth={Math.max(...Object.values(currentStep?.treeSnapshot || {}).map(n => n.depth), 0)}
      />
    </div>
  );
}

export default React.memo(RdoQuadtreeSimulator);
