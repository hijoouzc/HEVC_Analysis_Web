import React from 'react';
import FullFrameViewer from '../FullFrameViewer';
import YUVViewer from '../YUVViewer';
import QuadTreeVisualizer from '../QuadTreeVisualizer';
import RdoQuadtreeSimulator from '../RdoQuadtreeSimulator';
import IntraPredictionFlow from '../IntraPredictionFlow';
import TransformQuantVisualizer from '../TransformQuantVisualizer';
import FourPictureComparison from '../FourPictureComparison';
import Synchronized4WayViewport from '../Synchronized4WayViewport';
import { Button, SegmentedControl, Badge } from '../apple';

/**
 * ActiveStageViewport
 * Modular stage renderer for the 7 HEVC analysis pipeline checkpoints.
 * Keeps App.jsx minimal, decoupled, and free of monolithic spaghetti code.
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
  reconMode,
  setReconMode,
  jobId,
  API_BASE_URL,
  showInspector,
  setShowInspector,
}) => {
  return (
    <div className="workspace-main">
      {/* Top Stage Navigation Bar - Apple HIG macOS Tahoe Sliding Tabs */}
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
        <SegmentedControl
          value={
            activeStageTab === 'FOUR_PIC_VIEW' || activeStageTab === 'VIEW_4WAY'
              ? 'RECON_VIEW'
              : activeStageTab
          }
          onChange={(val) => {
            if (val === 'CP_01' && ctuX !== null && ctuY !== null) {
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button
            variant={showInspector ? 'tinted' : 'gray'}
            size="small"
            onClick={() => setShowInspector((prev) => !prev)}
            title="Toggle Info Sidebar (I)"
            style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}
          >
            Info (i)
          </Button>
        </div>
      </div>

      {/* CTU / CU Size Desync Notice */}
      {hasDesync && activeStageTab !== 'MACRO' && (
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
            Analyzed CTU: ({analyzedCtu.x}, {analyzedCtu.y}) • Focused Target: CTU ({ctuX}, {ctuY}) (
            {cuSize || 8}×{cuSize || 8})
          </span>
          <Button
            variant="filled"
            size="small"
            onClick={() => handleUpload(null, ctuX, ctuY, cuSize || 8, currentMode?.mode)}
            disabled={loading}
          >
            {loading ? 'Analyzing...' : `Analyze CTU (${ctuX}, ${ctuY})`}
          </Button>
        </div>
      )}

      {/* STAGE 1: FRAME OVERVIEW & CTU GRID */}
      {activeStageTab === 'MACRO' && (
        <FullFrameViewer
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
        />
      )}

      {/* STAGE 2: YUV PLANAR DECOMPOSITION */}
      {activeStageTab === 'YUV_VIEW' && (
        <YUVViewer
          imageSrc={imagePreview}
          imageDims={imageDims}
          ctuX={ctuX}
          ctuY={ctuY}
          onSelectCTU={handleSelectCTU}
          onNavigateToQuadTree={(x, y) => {
            handleSelectCTU(x, y);
            setActiveStageTab('CP_01');
          }}
          onNavigateToIntra={(x, y) => {
            handleSelectCTU(x, y);
            setActiveStageTab('INTRA_PIPE');
          }}
        />
      )}

      {/* STAGE 3: CU QUADTREE PARTITIONING */}
      {activeStageTab === 'CP_01' && (
        <div className="stage-section-card">
          <div className="stage-section-header">
            <div className="stage-section-title">CU Partitioning (HM xCompressCU)</div>
            <Badge variant="blue">HM Trace</Badge>
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
              if (node && node.width !== 8) return;
              handleSelectCU(node);
              const targetMode =
                node && node.intra_dir !== null && node.intra_dir !== undefined
                  ? node.intra_dir
                  : null;
              if (targetMode !== null && data) {
                const targetIdx = data.findIndex((d) => d.mode === targetMode);
                if (targetIdx !== -1) setCurrentModeIdx(targetIdx);
              }
              setActiveStageTab('INTRA_PIPE');
            }}
            onBackToFrame={() => setActiveStageTab('MACRO')}
            onNavigateToSim={() => setActiveStageTab('RDO_SIM')}
          />
        </div>
      )}

      {/* STAGE 4: RDO SIMULATOR */}
      {activeStageTab === 'RDO_SIM' && (
        <RdoQuadtreeSimulator
          imageSrc={imagePreview}
          imageDims={imageDims}
          ctuX={ctuX}
          ctuY={ctuY}
          partitionData={partitionData}
          onNavigateToStage={setActiveStageTab}
        />
      )}

      {/* STAGE 5: INTRA PREDICTION PIPELINE */}
      {activeStageTab === 'INTRA_PIPE' && (
        <IntraPredictionFlow
          modeData={currentMode}
          modesData={data}
          currentModeIdx={currentModeIdx}
          onSelectModeIndex={setCurrentModeIdx}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          refSamples={refSamples}
          currentMode={currentMode?.mode ?? 0}
          blockSize={8}
          imagePreview={imagePreview}
          imageDims={imageDims}
          ctuX={ctuX}
          ctuY={ctuY}
          onBackToQuadTree={() => setActiveStageTab('CP_01')}
          onGoTo4Way={() => {
            setReconMode('synchronized');
            setActiveStageTab('RECON_VIEW');
          }}
        />
      )}

      {/* STAGE 6: TRANSFORM & QUANTIZATION */}
      {activeStageTab === 'CP_06_07' && (
        <div className="stage-section-card">
          <div className="stage-section-header">
            <div className="stage-section-title">Transform & Quantization (TU / RQT)</div>
            <Badge variant="purple">HM xTrQuant</Badge>
          </div>
          <TransformQuantVisualizer
            transformData={transformData}
            quantData={quantData}
            ctuX={ctuX}
            ctuY={ctuY}
            targetTuX={selectedCu?.x ?? null}
            targetTuY={selectedCu?.y ?? null}
          />
        </div>
      )}

      {/* STAGE 7: RECONSTRUCTION & 4-PICTURE VERIFICATION */}
      {(activeStageTab === 'RECON_VIEW' ||
        activeStageTab === 'FOUR_PIC_VIEW' ||
        activeStageTab === 'VIEW_4WAY') && (
        <div
          className="stage-section-card"
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <div className="stage-section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="stage-section-title">Reconstruction Loop</div>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--label-2)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                S, P, R, S'
              </span>
            </div>

            <SegmentedControl
              value={reconMode}
              onChange={setReconMode}
              size="small"
              items={[
                { id: 'overview', label: 'Overview & Split' },
                { id: 'synchronized', label: 'Synchronized YCbCr' },
              ]}
            />
          </div>

          {reconMode === 'overview' ? (
            <FourPictureComparison
              imageSrc={imagePreview}
              imageDims={imageDims}
              ctuX={ctuX}
              ctuY={ctuY}
              currentMode={currentMode}
              selectedCu={selectedCu}
              jobId={jobId}
              API_BASE_URL={API_BASE_URL}
              onSelectCTU={handleSelectCTU}
              onNavigateToIntra={() => setActiveStageTab('INTRA_PIPE')}
            />
          ) : (
            <Synchronized4WayViewport
              modeData={currentMode}
              currentMode={currentMode?.mode ?? 0}
              blockSize={8}
              ctuX={ctuX}
              ctuY={ctuY}
              onBackToIntra={() => setActiveStageTab('INTRA_PIPE')}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(ActiveStageViewport);
