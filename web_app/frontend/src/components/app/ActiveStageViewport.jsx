import React from 'react';
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

/**
 * ActiveStageViewport
 * Specializes into 8 dedicated Checkpoint tabs (CP_00 to CP_07).
 * Design standard: Apple Pro-Grade, 100% English, minimal text, no emoji icons, zero overflow.
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
  jobId,
  API_BASE_URL,
  showInspector,
  setShowInspector,
  reconMode = 'overview',
  setReconMode = null,
}) => {
  const [internalReconMode, setInternalReconMode] = React.useState('overview');
  const activeReconMode = reconMode ?? internalReconMode;
  const handleReconModeChange = setReconMode ?? setInternalReconMode;
  return (
    <div className="workspace-main" style={{ minWidth: 0 }}>
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
      {hasDesync && activeStageTab !== 'CP_00' && (
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
            {cuSize || 8}×{cuSize || 8})
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
          onNavigateToStage={setActiveStageTab}
        />
      )}
    </div>
  );
};

export default React.memo(ActiveStageViewport);
