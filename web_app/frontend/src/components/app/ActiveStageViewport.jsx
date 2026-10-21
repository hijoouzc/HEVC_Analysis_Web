import React, { useState, useEffect, useCallback } from 'react';
import { Button, Badge } from '../apple';
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
  GUIDED_STEPS,
} from '../guided';

/**
 * ActiveStageViewport
 * Guided Flow Architecture:
 * 5-Step Continuous Trace Viewer following HM-18.0 xCompressCU pipeline.
 * Design standard: Apple Pro-Grade macOS Tahoe, 100% English, zero overflow.
 */
const ActiveStageViewport = ({
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
  setPartitionData: _setPartitionData,
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
  showInspector: _showInspector,
  setShowInspector: _setShowInspector,
  handleSelectSize = null,
  handleSelectBlock = null,
  setCuSize = null,
  setSelectedCu = null,
  guidedStep = 'STEP_1',
  setGuidedStep = null,
}) => {
  const [internalGuidedStep, setInternalGuidedStep] = useState('STEP_1');
  const [activeChannel, setActiveChannel] = useState('Y'); // 'Y' | 'Cb' | 'Cr'
  const [guidedShowValues, setGuidedShowValues] = useState(true);
  const [guidedResiGain, setGuidedResiGain] = useState(4); // 1 | 2 | 4 | 8

  const activeGuidedStep = guidedStep ?? internalGuidedStep;
  const setStepFn = setGuidedStep ?? setInternalGuidedStep;

  const handleGuidedStepChange = useCallback((targetStep) => {
    setStepFn(targetStep);
    const el = document.getElementById(targetStep);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [setStepFn]);

  // Sync active step with scroll position in guided continuous stream mode
  useEffect(() => {
    const stepIds = GUIDED_STEPS.map((s) => s.id);
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
  }, [setStepFn]);

  return (
    <div className="workspace-main" style={{ minWidth: 0 }}>
      {/* Top Header: Guided Stream Identity Badge */}
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
          <Badge variant="blue" style={{ fontSize: '11px', padding: '4px 10px' }}>
            HM xCompressCU Guided Stream (Steps 1–5)
          </Badge>
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
       * GUIDED FLOW (VERTICAL CONTINUOUS STREAM)
       * ========================================================================= */}
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
            showValues={guidedShowValues}
            onToggleValues={() => setGuidedShowValues((v) => !v)}
            resiGain={guidedResiGain}
            onSelectResiGain={setGuidedResiGain}
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
            showValues={guidedShowValues}
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
            showValues={guidedShowValues}
            resiGain={guidedResiGain}
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
            title="Committed Picture Reconstruction &amp; In-Loop Filters"
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
            showValues={guidedShowValues}
            resiGain={guidedResiGain}
            onSelectResiGain={setGuidedResiGain}
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
            title="Rate-Distortion Decision &amp; Entropy Stream"
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
            onNavigateToStage={() => handleGuidedStepChange('STEP_1')}
            showValues={guidedShowValues}
          />
        </section>

        {/* Guided Footer Navigation Bar */}
        <GuidedFooterNav
          activeStep={activeGuidedStep}
          onSelectStep={handleGuidedStepChange}
          selectedCu={selectedCu}
          ctuX={ctuX}
          ctuY={ctuY}
        />

        {/* Floating Quick-Jump Pop-up Menu */}
        <QuickJumpMenu
          activeStep={activeGuidedStep}
          onSelectStep={handleGuidedStepChange}
        />
      </div>
    </div>
  );
};

export default React.memo(ActiveStageViewport);
