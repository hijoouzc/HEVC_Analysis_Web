import React, { useState, useEffect, useCallback } from 'react';
import GopReferenceVisualizer from '../GopReferenceVisualizer';
import QuadTreeVisualizer from '../QuadTreeVisualizer';
import IntraPredictionFlow from '../IntraPredictionFlow';
import InterSearchVisualizer from '../InterSearchVisualizer';
import TransformQuantVisualizer from '../TransformQuantVisualizer';
import ReconPictureVisualizer from '../ReconPictureVisualizer';
import FourPictureComparison from '../FourPictureComparison';
import InLoopFilterVisualizer from '../InLoopFilterVisualizer';
import CabacEntropyVisualizer from '../CabacEntropyVisualizer';
import RdoQuadtreeSimulator from '../RdoQuadtreeSimulator';
import { Button, SegmentedControl, Badge } from '../apple';
import {
  GuidedJourneyBar,
  GuidedFooterNav,
  Step1FrameTree,
  Step2Prediction,
  Step3ResidualTu,
  Step4ReconInLoop,
  Step5RdDecision,
  SectionHeader,
  QuickJumpMenu,
} from '../guided';

/**
 * ActiveStageViewport
 * Dual-Mode Architecture:
 * 1. Guided Flow (5-Step Trace Viewer following HM-18.0 xCompressCU)
 * 2. Expert Checkpoints (9 dedicated telemetry tabs: CP_00 to CP_07 + RDO_SIM)
 * Design standard: Apple Pro-Grade macOS Tahoe, 100% English, zero overflow.
 */
const ActiveStageViewport = ({
  activeStageTab,
  setActiveStageTab,
  stageTabs,
  hasDesync,
  analyzedCtu,
  ctuX,
  ctuY,
  cuSize,
  currentMode,
  currentModeIdx,
  setCurrentModeIdx,
  isPlaying,
  setIsPlaying,
  imagePreview,
  imageDims,
  partitionData,
  setPartitionData,
  ctuPartitionsMap,
  selectedCu,
  handleSelectCTU,
  handleSelectCU,
  handleUpload,
  loading,
  data,
  refSamples,
  transformData,
  quantData,
  frameGopData,
  interSearchData,
  reconPictureData,
  inloopFilterData,
  cabacEntropyData,
  rdoDecisions = [],
  jobId,
  API_BASE_URL,
  showInspector,
  setShowInspector,
  reconMode = 'overview',
  setReconMode = null,
  handleSelectSize = null,
  handleSelectBlock = null,
  setCuSize = null,
  setSelectedCu = null,
  viewMode = 'guided',
  setViewMode = null,
  guidedStep = 'STEP_1',
  setGuidedStep = null,
}) => {
  const [internalViewMode, setInternalViewMode] = useState('guided');
  const [internalGuidedStep, setInternalGuidedStep] = useState('STEP_1');
  const [internalReconMode, setInternalReconMode] = useState('overview');
  const [activeChannel, setActiveChannel] = useState('Y'); // 'Y' | 'Cb' | 'Cr'

  const activeViewMode = viewMode ?? internalViewMode;
  const handleViewModeChange = setViewMode ?? setInternalViewMode;

  const activeGuidedStep = guidedStep ?? internalGuidedStep;
  const setStepFn = setGuidedStep ?? setInternalGuidedStep;

  const handleGuidedStepChange = useCallback((targetStep) => {
    setStepFn(targetStep);
    const el = document.getElementById(targetStep);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [setStepFn]);

  // Bidirectional View Mode Switcher: Maps Guided Step to Expert Tab & vice-versa
  const handleToggleViewMode = useCallback((newMode) => {
    if (newMode === 'expert') {
      const stepToTab = {
        STEP_1: 'CP_01',
        STEP_2: 'CP_02',
        STEP_3: 'CP_04',
        STEP_4: 'CP_05',
        STEP_5: 'CP_07',
      };
      if (stepToTab[activeGuidedStep]) {
        setActiveStageTab(stepToTab[activeGuidedStep]);
      }
    } else if (newMode === 'guided') {
      const tabToStep = {
        CP_00: 'STEP_1',
        CP_01: 'STEP_1',
        CP_02: 'STEP_2',
        CP_03: 'STEP_2',
        CP_04: 'STEP_3',
        CP_05: 'STEP_4',
        CP_06: 'STEP_4',
        CP_07: 'STEP_5',
        RDO_SIM: 'STEP_5',
      };
      const targetStep = tabToStep[activeStageTab] || 'STEP_1';
      setStepFn(targetStep);
      setTimeout(() => {
        const el = document.getElementById(targetStep);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
    handleViewModeChange(newMode);
  }, [activeGuidedStep, activeStageTab, handleViewModeChange, setActiveStageTab, setStepFn]);

  // Sync active step with scroll position in guided continuous stream mode
  useEffect(() => {
    if (activeViewMode !== 'guided') return;
    const stepIds = ['STEP_1', 'STEP_2', 'STEP_3', 'STEP_4', 'STEP_5'];
    const elements = stepIds.map((id) => document.getElementById(id)).filter(Boolean);
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible?.target?.id) {
          setStepFn(visible.target.id);
        }
      },
      { rootMargin: '-10% 0px -60% 0px', threshold: 0.1 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [activeViewMode, setStepFn]);

  const activeReconMode = reconMode ?? internalReconMode;
  const handleReconModeChange = setReconMode ?? setInternalReconMode;

  return (
    <div className="workspace-main" style={{ minWidth: 0 }}>
      {/* Top Header: View Mode Switcher (Guided vs Expert) + Right Inspector Button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <SegmentedControl
            value={activeViewMode}
            onChange={handleToggleViewMode}
            items={[
              { id: 'guided', label: 'Guided Flow (5 Steps)' },
              { id: 'expert', label: 'Expert Checkpoints (9 Tabs)' },
            ]}
            size="regular"
          />

          {activeViewMode === 'guided' && (
            <Badge variant="blue" style={{ fontSize: '10.5px' }}>
              HM xCompressCU Trace Viewer
            </Badge>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button
            variant={showInspector ? 'tinted' : 'gray'}
            size="small"
            onClick={() => setShowInspector((prev) => !prev)}
            title="Toggle Info Sidebar (I)"
            style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', width: '84px', minWidth: '84px', justifyContent: 'center' }}
          >
            {showInspector ? 'Hide Info' : 'Info (I)'}
          </Button>
        </div>
      </div>

      {/* CTU / CU Size Desync Notice */}
      {hasDesync && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 14px',
            background: 'var(--fill-4)',
            border: '0.5px solid var(--separator)',
            borderRadius: '6px',
            marginBottom: '12px',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--apple-label)',
          }}
        >
          <span>
            Analyzed CTU: ({analyzedCtu.x}, {analyzedCtu.y}) &bull; Focused Target: CTU ({ctuX}, {ctuY}) (
            {cuSize || 8}&times;{cuSize || 8})
          </span>
          <Button
            variant="filled"
            size="small"
            onClick={() => handleUpload(null, ctuX, ctuY, cuSize || 8, currentMode?.mode)}
            disabled={loading}
            style={{ width: '160px', minWidth: '160px', justifyContent: 'center' }}
          >
            {loading ? 'Analyzing...' : `Analyze CTU (${ctuX}, ${ctuY})`}
          </Button>
        </div>
      )}

      {/* =========================================================================
      {/* =========================================================================
       * MODE 1: GUIDED FLOW (VERTICAL CONTINUOUS STREAM)
       * ========================================================================= */}
      {activeViewMode === 'guided' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Sticky GuidedJourneyBar at top of Guided Stream */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 30,
              background: 'var(--window-bg, #FFFFFF)',
              paddingBottom: '4px',
            }}
          >
            <GuidedJourneyBar
              activeStep={activeGuidedStep}
              onSelectStep={handleGuidedStepChange}
              selectedCu={selectedCu}
              ctuX={ctuX}
              ctuY={ctuY}
              channel={activeChannel}
              onSelectChannel={setActiveChannel}
              splitDecision={rdoDecisions?.find(
                (d) =>
                  d.cu_x === (selectedCu?.x ?? selectedCu?.abs_x) &&
                  d.cu_y === (selectedCu?.y ?? selectedCu?.abs_y)
              )}
              hasTransform={transformData && transformData.length > 0}
              hasRecon={
                reconPictureData &&
                (reconPictureData.reconstructed_y?.length > 0 || reconPictureData.length > 0)
              }
              hasRdo={rdoDecisions && rdoDecisions.length > 0}
            />
          </div>

          {/* Section 1: Frame & CU Tree */}
          {/* Section 1: Frame & CU Tree */}
          <section id="STEP_1" style={{ scrollMarginTop: '30px' }}>
            <SectionHeader
              title="CU QuadTree Partitioning"
              hmFunction="TEncCu::xCompressCU"
              badge="Quadtree"
            />
            <Step1FrameTree
              imageSrc={imagePreview}
              imageDims={imageDims}
              ctuX={ctuX}
              ctuY={ctuY}
              partitionData={partitionData}
              ctuPartitionsMap={ctuPartitionsMap}
              selectedCu={selectedCu}
              onSelectCU={handleSelectCU}
              onSelectCTU={handleSelectCTU}
              onReAnalyze={(targetX, targetY) => handleUpload(null, targetX, targetY)}
              loading={loading}
              frameGopData={frameGopData}
              onProceedToPrediction={() => handleGuidedStepChange('STEP_2')}
              handleSelectSize={handleSelectSize}
              setCuSize={setCuSize}
              setCurrentModeIdx={setCurrentModeIdx}
              data={data}
            />
          </section>

          {/* Stream Connector 1 -> 2 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px 0',
              color: 'var(--apple-label-quaternary)',
              fontSize: '12px',
            }}
          >
            &darr;
          </div>

          {/* Section 2: Prediction Candidates */}
          <section id="STEP_2" style={{ scrollMarginTop: '30px' }}>
            <SectionHeader
              title="Intra &amp; Inter Prediction"
              hmFunction="TEncSearch::estIntraPredLumaQT"
              badge="Prediction"
            />
            <Step2Prediction
              modeData={currentMode}
              modesData={data}
              currentModeIdx={currentModeIdx}
              onSelectModeIndex={setCurrentModeIdx}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              refSamples={refSamples}
              selectedCu={selectedCu}
              cuSize={cuSize}
              setCuSize={setCuSize}
              setSelectedCu={setSelectedCu}
              handleSelectSize={handleSelectSize}
              imagePreview={imagePreview}
              imageDims={imageDims}
              ctuX={ctuX}
              ctuY={ctuY}
              jobId={jobId}
              API_BASE_URL={API_BASE_URL}
              transformData={transformData}
              quantData={quantData}
              interSearchData={interSearchData}
              frameGopData={frameGopData}
              onSelectBlock={handleSelectBlock}
              partitionData={partitionData}
              onProceedToResidual={() => handleGuidedStepChange('STEP_3')}
              onProceedToRdo={() => handleGuidedStepChange('STEP_5')}
              channel={activeChannel}
              onSelectChannel={setActiveChannel}
            />
          </section>

          {/* Stream Connector 2 -> 3 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px 0',
              color: 'var(--apple-label-quaternary)',
              fontSize: '12px',
            }}
          >
            &darr;
          </div>

          {/* Section 3: Residual & TU */}
          <section id="STEP_3" style={{ scrollMarginTop: '30px' }}>
            <SectionHeader
              title="Residual Transform &amp; Quantization (RQT)"
              hmFunction="TComTrQuant::transformNxN"
              badge="RQT Engine"
            />
            <Step3ResidualTu
              transformData={transformData}
              quantData={quantData}
              ctuX={ctuX}
              ctuY={ctuY}
              selectedCu={selectedCu}
              currentMode={currentMode}
              data={data}
              onProceedToRecon={() => handleGuidedStepChange('STEP_4')}
              onProceedToRdo={() => handleGuidedStepChange('STEP_5')}
              channel={activeChannel}
              onSelectChannel={setActiveChannel}
            />
          </section>

          {/* Stream Connector 3 -> 4 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px 0',
              color: 'var(--apple-label-quaternary)',
              fontSize: '12px',
            }}
          >
            &darr;
          </div>

          {/* Section 4: Reconstruction */}
          <section id="STEP_4" style={{ scrollMarginTop: '30px' }}>
            <SectionHeader
              title="Spatial Reconstruction &amp; In-Loop Filtering"
              hmFunction="TComPic::getPicYuvRec"
              badge="Picture Buffer"
            />
            <Step4ReconInLoop
              imageSrc={imagePreview}
              imageDims={imageDims}
              ctuX={ctuX}
              ctuY={ctuY}
              currentMode={currentMode}
              selectedCu={selectedCu}
              cuSize={cuSize}
              reconPictureData={reconPictureData}
              inloopFilterData={inloopFilterData}
              jobId={jobId}
              API_BASE_URL={API_BASE_URL}
              onSelectCTU={handleSelectCTU}
              onNavigateToIntra={() => handleGuidedStepChange('STEP_2')}
              splitDecision={rdoDecisions?.find(
                (d) =>
                  d.cu_x === (selectedCu?.x ?? selectedCu?.abs_x) &&
                  d.cu_y === (selectedCu?.y ?? selectedCu?.abs_y)
              )}
              onProceedToRdo={() => handleGuidedStepChange('STEP_5')}
              channel={activeChannel}
              onSelectChannel={setActiveChannel}
            />
          </section>

          {/* Stream Connector 4 -> 5 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px 0',
              color: 'var(--apple-label-quaternary)',
              fontSize: '12px',
            }}
          >
            &darr;
          </div>

          {/* Section 5: RD Decision & Simulator */}
          <section id="STEP_5" style={{ scrollMarginTop: '30px' }}>
            <SectionHeader
              title="CABAC Entropy Coding &amp; Rate-Distortion Decision"
              hmFunction="TEncCu::xCheckBestMode"
              badge="RDO Engine"
            />
            <Step5RdDecision
              rdoDecisions={rdoDecisions}
              cabacEntropyData={cabacEntropyData}
              selectedCu={selectedCu}
              ctuX={ctuX}
              ctuY={ctuY}
              imageSrc={imagePreview}
              imageDims={imageDims}
              partitionData={ctuPartitionsMap?.[`${ctuX}_${ctuY}`] || partitionData}
              onNavigateToStage={(stg) => {
                setActiveStageTab(stg);
                handleViewModeChange('expert');
              }}
            />
          </section>

          {/* Guided Footer Navigation Bar */}
          <GuidedFooterNav
            activeStep={activeGuidedStep}
            onSelectStep={handleGuidedStepChange}
            selectedCu={selectedCu}
            ctuX={ctuX}
            ctuY={ctuY}
            onJumpToExpert={(_cp) => {
              const map = {
                'STEP_1': 'CP_01',
                'STEP_2': 'CP_02',
                'STEP_3': 'CP_04',
                'STEP_4': 'CP_05',
                'STEP_5': 'CP_07',
              };
              setActiveStageTab(map[activeGuidedStep] || 'CP_00');
              handleViewModeChange('expert');
            }}
          />

          {/* Floating Quick-Jump Pop-up Menu */}
          <QuickJumpMenu
            activeStep={activeGuidedStep}
            onSelectStep={handleGuidedStepChange}
          />
        </div>
      )}

      {/* =========================================================================
       * MODE 2: EXPERT CHECKPOINTS (9 TABS)
       * ========================================================================= */}
      {activeViewMode === 'expert' && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Top 9 Checkpoint Tabs */}
          <div style={{ marginBottom: '14px' }}>
            <SegmentedControl
              value={
                stageTabs.some((t) => t.id === activeStageTab)
                  ? activeStageTab
                  : 'CP_00'
              }
              onChange={(val) => {
                if ((val === 'CP_01' || val === 'RDO_SIM') && ctuX !== null && ctuY !== null) {
                  const cached = ctuPartitionsMap?.[`${ctuX}_${ctuY}`];
                  if (cached && setPartitionData) {
                    setPartitionData(cached);
                  }
                }
                setActiveStageTab(val);
              }}
              items={stageTabs}
              size="regular"
            />
          </div>

          {/* CHECKPOINT 0: FRAME & GOP STRUCTURE */}
          {activeStageTab === 'CP_00' && (
            <GopReferenceVisualizer
              imageSrc={imagePreview}
              imageDims={imageDims}
              ctuX={ctuX}
              ctuY={ctuY}
              onSelectCTU={handleSelectCTU}
              onNavigateToQuadTree={(x, y) => {
                handleSelectCTU(x, y);
                setActiveStageTab('CP_01');
              }}
              partitionData={partitionData}
              ctuPartitionsMap={ctuPartitionsMap}
              isAnalyzed={true}
              onReAnalyze={(targetX, targetY) => {
                handleUpload(null, targetX, targetY);
              }}
              loading={loading}
              selectedCu={selectedCu}
              onSelectCU={handleSelectCU}
              frameGopData={frameGopData}
            />
          )}

          {/* CHECKPOINT 1: CU QUADTREE & RDO DECISION */}
          {activeStageTab === 'CP_01' && (
            <div className="stage-section-card">
              <div className="stage-section-header">
                <div className="stage-section-title">CU QuadTree Partitioning</div>
                <Badge variant="blue">HM TEncCu::xCompressCU</Badge>
              </div>
              <QuadTreeVisualizer
                partitionData={partitionData}
                ctuX={ctuX}
                ctuY={ctuY}
                imageSrc={imagePreview}
                imageDims={imageDims}
                selectedCU={selectedCu}
                onSelectCU={handleSelectCU}
                onNavigateToIntra={(node) => {
                  if (!node) return;
                  handleSelectCU(node);
                  const targetSize = node.width || 8;
                  if (setCuSize) setCuSize(targetSize);
                  if (handleSelectSize) handleSelectSize(targetSize);
                  const targetMode =
                    node && node.intra_dir !== null && node.intra_dir !== undefined
                      ? node.intra_dir
                      : null;
                  if (targetMode !== null && data) {
                    const targetIdx = data.findIndex((d) => d.mode === targetMode);
                    if (targetIdx !== -1) setCurrentModeIdx(targetIdx);
                  }
                  setActiveStageTab('CP_02');
                }}
                onBackToFrame={() => setActiveStageTab('CP_00')}
                onNavigateToSim={() => setActiveStageTab('RDO_SIM')}
              />
            </div>
          )}

          {/* CHECKPOINT 2: 5-STEP INTRA PREDICTION FLOW */}
          {activeStageTab === 'CP_02' && (
            <IntraPredictionFlow
              modeData={currentMode}
              modesData={data}
              currentModeIdx={currentModeIdx}
              onSelectModeIndex={setCurrentModeIdx}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              refSamples={refSamples}
              currentMode={currentMode?.mode ?? 0}
              blockSize={selectedCu?.width || cuSize || 8}
              onChangeBlockSize={(newSize) => {
                if (setCuSize) setCuSize(newSize);
                if (setSelectedCu && selectedCu) {
                  setSelectedCu({ ...selectedCu, width: newSize, height: newSize });
                }
                if (handleSelectSize) handleSelectSize(newSize);
              }}
              imagePreview={imagePreview}
              imageDims={imageDims}
              ctuX={ctuX}
              ctuY={ctuY}
              onBackToQuadTree={() => setActiveStageTab('CP_01')}
              onGoTo4Way={() => setActiveStageTab('CP_05')}
              jobId={jobId}
              API_BASE_URL={API_BASE_URL}
              transformData={transformData}
              quantData={quantData}
              selectedCu={selectedCu}
              onSelectBlock={handleSelectBlock}
              partitionData={partitionData}
            />
          )}

          {/* CHECKPOINT 3: INTER PREDICTION & MOTION ESTIMATION */}
          {activeStageTab === 'CP_03' && (
            <div className="stage-section-card">
              <div className="stage-section-header">
                <div className="stage-section-title">Inter Prediction &amp; Motion Estimation</div>
                <Badge variant="blue">HM TEncSearch::predInterSearch</Badge>
              </div>
              <InterSearchVisualizer
                interSearchData={interSearchData}
                ctuX={ctuX}
                ctuY={ctuY}
                selectedCu={selectedCu}
                frameGopData={frameGopData}
              />
            </div>
          )}

          {/* CHECKPOINT 4: RESIDUAL TRANSFORM & RQT */}
          {activeStageTab === 'CP_04' && (
            <div className="stage-section-card">
              <div className="stage-section-header">
                <div className="stage-section-title">Residual Transform &amp; RQT Hierarchy</div>
                <Badge variant="purple">HM TComTrQuant::transformNxN</Badge>
              </div>
              <TransformQuantVisualizer
                transformData={transformData}
                quantData={quantData}
                ctuX={ctuX}
                ctuY={ctuY}
                targetTuX={selectedCu?.x ?? null}
                targetTuY={selectedCu?.y ?? null}
                targetCuX={selectedCu?.abs_x ?? selectedCu?.x ?? null}
                targetCuY={selectedCu?.abs_y ?? selectedCu?.y ?? null}
                targetCuSize={selectedCu?.width ?? null}
                selectedCu={selectedCu}
              />
            </div>
          )}

          {/* CHECKPOINT 5: RECONSTRUCTED PICTURE & FULL-FRAME COMPARISON */}
          {activeStageTab === 'CP_05' && (
            <div
              className="stage-section-card"
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div className="stage-section-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="stage-section-title">Reconstructed Picture Buffer (S&apos;)</div>
                  <Badge variant="green">HM m_cPicYuvRec</Badge>
                </div>

                <SegmentedControl
                  value={activeReconMode}
                  onChange={handleReconModeChange}
                  size="small"
                  items={[
                    { id: 'overview', label: "Full Frame Buffer (S')" },
                    { id: 'cu', label: 'CU Planar Buffer (m_cPicYuvRec)' },
                  ]}
                />
              </div>

              {activeReconMode === 'overview' ? (
                <FourPictureComparison
                  imageSrc={imagePreview}
                  imageDims={imageDims}
                  ctuX={ctuX}
                  ctuY={ctuY}
                  currentMode={currentMode}
                  selectedCu={selectedCu}
                  reconPictureData={reconPictureData}
                  jobId={jobId}
                  API_BASE_URL={API_BASE_URL}
                  onSelectCTU={handleSelectCTU}
                  onNavigateToIntra={() => setActiveStageTab('CP_02')}
                />
              ) : (
                <ReconPictureVisualizer
                  currentMode={currentMode}
                  reconPictureData={reconPictureData}
                  ctuX={ctuX}
                  ctuY={ctuY}
                  selectedCu={selectedCu}
                  cuSize={cuSize}
                  imageSrc={imagePreview}
                  imageDims={imageDims}
                  jobId={jobId}
                  API_BASE_URL={API_BASE_URL}
                />
              )}
            </div>
          )}

          {/* CHECKPOINT 6: IN-LOOP FILTER (DBF & SAO) */}
          {activeStageTab === 'CP_06' && (
            <div className="stage-section-card">
              <div className="stage-section-header">
                <div className="stage-section-title">In-Loop Filtering (DBF &amp; SAO)</div>
                <Badge variant="blue">HM TComLoopFilter &bull; SAO</Badge>
              </div>
              <InLoopFilterVisualizer
                inloopFilterData={inloopFilterData}
                ctuX={ctuX}
                ctuY={ctuY}
              />
            </div>
          )}

          {/* CHECKPOINT 7: CABAC ENTROPY & BITSTREAM SYNTAX */}
          {activeStageTab === 'CP_07' && (
            <div className="stage-section-card">
              <div className="stage-section-header">
                <div className="stage-section-title">CABAC Entropy &amp; Bitstream Syntax</div>
                <Badge variant="blue">HM TEncSbac</Badge>
              </div>
              <CabacEntropyVisualizer
                cabacEntropyData={cabacEntropyData}
                ctuX={ctuX}
                ctuY={ctuY}
              />
            </div>
          )}

          {/* CHECKPOINT 8 / RDO SIMULATOR: xCompressCU TREE RECURSION & COST SIMULATOR */}
          {activeStageTab === 'RDO_SIM' && (
            <RdoQuadtreeSimulator
              key={`rdo_sim_${ctuX}_${ctuY}`}
              imageSrc={imagePreview}
              imageDims={imageDims}
              ctuX={ctuX}
              ctuY={ctuY}
              partitionData={ctuPartitionsMap?.[`${ctuX}_${ctuY}`] || partitionData}
              rdoDecisions={rdoDecisions}
              selectedCu={selectedCu}
              onNavigateToStage={setActiveStageTab}
            />
          )}

          {/* Encoder Flow Journey Breadcrumbs & Next Stage Action */}
          {stageTabs && stageTabs.length > 0 && (
            <div
              style={{
                marginTop: '16px',
                padding: '8px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--fill-1)',
                borderRadius: '6px',
                border: '0.5px solid var(--separator)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                boxSizing: 'border-box',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--apple-label-secondary)', fontWeight: 600 }}>FLOW:</span>
                {stageTabs.map((tab, idx) => {
                  const isActive = tab.id === activeStageTab;
                  return (
                    <span key={tab.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span
                        onClick={() => setActiveStageTab(tab.id)}
                        style={{
                          cursor: 'pointer',
                          fontWeight: isActive ? 700 : 400,
                          color: isActive ? 'var(--apple-blue)' : 'var(--apple-label-tertiary)',
                          textDecoration: isActive ? 'underline' : 'none',
                        }}
                        title={`Jump to ${tab.label}`}
                      >
                        {tab.id}
                      </span>
                      {idx < stageTabs.length - 1 && (
                        <span style={{ color: 'var(--separator)' }}>&rarr;</span>
                      )}
                    </span>
                  );
                })}
              </div>

              {/* Next Stage Navigation Button */}
              {(() => {
                const currentIndex = stageTabs.findIndex((t) => t.id === activeStageTab);
                const nextTab =
                  currentIndex >= 0 && currentIndex < stageTabs.length - 1
                    ? stageTabs[currentIndex + 1]
                    : null;
                if (!nextTab) return null;
                return (
                  <Button
                    variant="tinted"
                    size="small"
                    onClick={() => setActiveStageTab(nextTab.id)}
                    style={{ fontSize: '11px', height: '24px' }}
                  >
                    Next: {nextTab.label} &rarr;
                  </Button>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(ActiveStageViewport);
