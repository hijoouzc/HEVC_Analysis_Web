import React, { useState, useEffect } from 'react';
import SetupScreen from './components/app/SetupScreen';
import ActiveStageViewport from './components/app/ActiveStageViewport';
import AnalysisInspector from './components/app/AnalysisInspector';
import RdoQuadtreeSimulator from './components/stages/rdo_simulator/RdoQuadtreeSimulator';
import { useAnalysisSession } from './hooks/useAnalysisSession';
import { getStepByNum } from './components/guided';
import {
  Window,
  WindowTitleBar,
  WindowContent,
  WindowStatusBar,
  Button,
  Badge,
} from './components/apple';
import './index.css';

/**
 * App (HEVC Video Analyzer Shell)
 * Top-level application container implementing applecn macOS Tahoe guidelines.
 * Decoupled and clean architecture with zero monolithic spaghetti code.
 */
function App() {
  const [isStandaloneSim, setIsStandaloneSim] = useState(false);
  const [showInspector, setShowInspector] = useState(true);
  const [backendStatus, setBackendStatus] = useState('Checking...');
  const [guidedStep, setGuidedStep] = useState('STEP_1'); // 'STEP_1'..'STEP_5'

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('apple_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const {
    file,
    imagePreview,
    rawImageDims,
    imageDims,
    loading,
    loadingStatus,
    errorMsg,
    setErrorMsg,
    data,
    refSamples,
    currentModeIdx,
    setCurrentModeIdx,
    currentMode,
    isPlaying,
    setIsPlaying,
    ctuX,
    ctuY,
    analyzedCtu,
    cuSize,
    analyzedCuSize,
    jobId,
    partitionData,
    setPartitionData,
    transformData,
    quantData,
    frameGopData,
    interSearchData,
    reconPictureData,
    inloopFilterData,
    cabacEntropyData,
    rdoDecisions,
    selectedCu,
    setSelectedCu,
    ctuPartitionsMap,
    hasDesync,
    allCtus,
    setAllCtus,
    profile,
    setProfile,
    frames,
    setFrames,
    API_BASE_URL,
    handleFileChange,
    handleUpload,
    handleResetImage,
    handleSelectCU,
    handleSelectCTU,
    handleSelectSize,
    handleSelectBlock,
    setCuSize,
  } = useAnalysisSession();

  // Check Backend Connection Health
  useEffect(() => {
    let isCurrent = true;
    fetch(`${API_BASE_URL}/health`)
      .then((res) => (res.ok ? res.json() : null))
      .then((health) => {
        if (!isCurrent) return;
        if (health && health.status === 'healthy') {
          setBackendStatus(health.encoder_bin_exists ? 'Ready' : 'Encoder Missing');
        } else {
          setBackendStatus('Offline');
        }
      })
      .catch(() => {
        if (isCurrent) setBackendStatus('Offline');
      });

    return () => {
      isCurrent = false;
    };
  }, [API_BASE_URL]);

  // Dark Mode Sync with DOM
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('apple_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('apple_theme', 'light');
    }
  }, [isDarkMode]);

  // Global Keyboard Shortcuts (1-5 for Guided Steps, I for inspector, D for theme)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'i' || e.key === 'I') {
        setShowInspector((prev) => !prev);
      } else if (e.key === 'd' || e.key === 'D') {
        setIsDarkMode((prev) => !prev);
      } else {
        const scrollTo = (id) => {
          const el = document.getElementById(id);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        const targetStep = getStepByNum(e.key);
        if (targetStep) {
          setGuidedStep(targetStep.id);
          scrollTo(targetStep.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Window>
      {/* TitleBar: Clean, Neutral, Apple HIG Standard */}
      <WindowTitleBar
        toolbar
        leading={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--apple-label)' }}>
              HEVC Video Analyzer
            </span>
            <span
              style={{
                fontSize: '10px',
                color: 'var(--apple-label-2)',
                fontFamily: 'var(--font-mono)',
                padding: '1px 6px',
                background: 'var(--fill-3)',
                borderRadius: '4px',
                border: '0.5px solid var(--separator)',
                fontWeight: 600,
              }}
            >
              HM-18.0
            </span>
            <span
              style={{
                fontSize: '10px',
                color: backendStatus === 'Ready' ? 'var(--apple-label)' : 'var(--apple-label-2)',
                fontFamily: 'var(--font-mono)',
                padding: '1px 6px',
                background: 'var(--fill-4)',
                borderRadius: '4px',
                border: '0.5px solid var(--separator)',
              }}
            >
              Backend: {backendStatus}
            </span>
          </div>
        }
        title={
          file ? file.name : isStandaloneSim ? 'Standalone RDO Simulator' : 'Setup & Sequence Intake'
        }
        subtitle={
          imageDims.width > 0
            ? `${imageDims.width}×${imageDims.height} • YCbCr 4:2:0 BT.709 • ${Math.ceil(imageDims.width / 64)}×${Math.ceil(imageDims.height / 64)} CTUs`
            : undefined
        }
        trailing={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ minWidth: '150px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
              {loading && loadingStatus && (
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--system-blue)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '150px'
                  }}
                >
                  {loadingStatus}
                </span>
              )}
            </div>

            {/* Active CTU Badge */}
            {data && (
              <Badge variant="blue" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', minWidth: '85px', justifyContent: 'center' }}>
                CTU ({ctuX !== null ? ctuX : 0}, {ctuY !== null ? ctuY : 0})
              </Badge>
            )}

            {/* Info Toggle */}
            {data && (
              <Button
                variant={showInspector ? 'tinted' : 'gray'}
                size="small"
                onClick={() => setShowInspector((prev) => !prev)}
                title="Toggle Info (I)"
                style={{ width: '80px', minWidth: '80px', justifyContent: 'center' }}
              >
                {showInspector ? 'Hide Info' : 'Info (i)'}
              </Button>
            )}

            {/* Theme Toggle */}
            <Button
              variant="gray"
              size="small"
              onClick={() => setIsDarkMode((d) => !d)}
              title="Toggle Theme (D)"
              style={{ width: '64px', minWidth: '64px', justifyContent: 'center' }}
            >
              {isDarkMode ? 'Light' : 'Dark'}
            </Button>

            {data && (
              <Button
                variant="gray"
                size="small"
                onClick={() => {
                  setIsStandaloneSim(false);
                  handleResetImage();
                }}
                title="Select another image"
                style={{ width: '100px', minWidth: '100px', justifyContent: 'center' }}
              >
                Change Image
              </Button>
            )}

            {!data && isStandaloneSim && (
              <Button
                variant="filled"
                size="small"
                onClick={() => setIsStandaloneSim(false)}
              >
                Back to Setup
              </Button>
            )}
          </div>
        }
      />

      <WindowContent style={{ padding: '16px 20px', width: '100%', boxSizing: 'border-box' }}>
        {errorMsg && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 14px',
              backgroundColor: 'var(--fill-4)',
              border: '0.5px solid var(--separator)',
              borderRadius: '6px',
              color: 'var(--apple-label)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              marginBottom: '14px',
            }}
          >
            <span>{errorMsg}</span>
            <Button variant="plain" size="mini" onClick={() => setErrorMsg(null)} title="Close">
              Close
            </Button>
          </div>
        )}

        {/* SCREEN 1: UPLOAD & SETUP */}
        {!data && !isStandaloneSim && (
          <SetupScreen
            file={file}
            rawImageDims={rawImageDims}
            imageDims={imageDims}
            ctuX={ctuX}
            ctuY={ctuY}
            loading={loading}
            imagePreview={imagePreview}
            partitionData={partitionData}
            ctuPartitionsMap={ctuPartitionsMap}
            allCtus={allCtus}
            setAllCtus={setAllCtus}
            profile={profile}
            setProfile={setProfile}
            frames={frames}
            setFrames={setFrames}
            onFileChange={handleFileChange}
            onSelectCTU={handleSelectCTU}
            onReAnalyze={(targetX, targetY) => {
              handleUpload(null, targetX, targetY);
            }}
            onUpload={handleUpload}
            onOpenSimulator={() => setIsStandaloneSim(true)}
          />
        )}

        {/* SCREEN 1B: STANDALONE RDO SIMULATOR */}
        {!data && isStandaloneSim && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <RdoQuadtreeSimulator
              imageSrc={imagePreview}
              imageDims={imageDims}
              ctuX={ctuX}
              ctuY={ctuY}
              partitionData={partitionData}
              onNavigateToStage={() => setIsStandaloneSim(false)}
            />
          </div>
        )}

        {/* SCREEN 2: ACTIVE WORKSPACE (Stage Viewport Canvas + Right Inspector) */}
        {data && data.length > 0 && currentMode && (
          <div className="workspace-layout">
            <ActiveStageViewport
              hasDesync={hasDesync}
              analyzedCtu={analyzedCtu}
              ctuX={ctuX}
              ctuY={ctuY}
              cuSize={cuSize}
              currentMode={currentMode}
              currentModeIdx={currentModeIdx}
              setCurrentModeIdx={setCurrentModeIdx}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              imagePreview={imagePreview}
              imageDims={imageDims}
              partitionData={partitionData}
              setPartitionData={setPartitionData}
              ctuPartitionsMap={ctuPartitionsMap}
              selectedCu={selectedCu}
              handleSelectCTU={handleSelectCTU}
              handleSelectCU={handleSelectCU}
              handleUpload={handleUpload}
              loading={loading}
              data={data}
              refSamples={refSamples}
              transformData={transformData}
              quantData={quantData}
              frameGopData={frameGopData}
              interSearchData={interSearchData}
              reconPictureData={reconPictureData}
              inloopFilterData={inloopFilterData}
              cabacEntropyData={cabacEntropyData}
              rdoDecisions={rdoDecisions}
              jobId={jobId}
              API_BASE_URL={API_BASE_URL}
              showInspector={showInspector}
              setShowInspector={setShowInspector}
              handleSelectSize={handleSelectSize}
              handleSelectBlock={handleSelectBlock}
              setCuSize={setCuSize}
              setSelectedCu={setSelectedCu}
              guidedStep={guidedStep}
              setGuidedStep={setGuidedStep}
            />

            {/* Right Column: Unified Apple Info Inspector */}
            {showInspector && (
              <AnalysisInspector
                file={file}
                imageDims={imageDims}
                ctuX={ctuX}
                ctuY={ctuY}
                analyzedCtu={analyzedCtu}
                selectedCu={selectedCu}
                analyzedCuSize={analyzedCuSize}
                currentMode={currentMode}
                partitionData={partitionData}
                ctuPartitionsMap={ctuPartitionsMap}
                onClose={() => setShowInspector(false)}
                onReAnalyze={(targetX, targetY) => {
                  handleUpload(null, targetX, targetY);
                }}
                loading={loading}
              />
            )}
          </div>
        )}
      </WindowContent>

      {/* Pro Apple Window Status Bar */}
      <WindowStatusBar
        left={
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {data ? (
              <>
                <span style={{ color: 'var(--apple-label-primary)', fontWeight: 600 }}>
                  CTU ({ctuX !== null ? ctuX : 0}, {ctuY !== null ? ctuY : 0})
                </span>
                <span style={{ color: 'var(--separator)' }}>•</span>
                <span style={{ color: 'var(--apple-label-secondary)' }}>
                  CU {selectedCu ? `${selectedCu.width}×${selectedCu.height}` : `${analyzedCuSize}×${analyzedCuSize}`}
                </span>
                <span style={{ color: 'var(--separator)' }}>•</span>
                <span style={{ color: 'var(--apple-blue)' }}>
                  Mode {currentMode ? currentMode.mode : 0}
                </span>
                {currentMode?.cost && (
                  <>
                    <span style={{ color: 'var(--separator)' }}>•</span>
                    <span style={{ color: 'var(--system-green)' }}>
                      J={Math.round(currentMode.cost).toLocaleString()}
                    </span>
                  </>
                )}
              </>
            ) : file ? (
              `${file.name} • ${imageDims.width}×${imageDims.height}`
            ) : (
              'Ready • Select an image to begin HEVC analysis'
            )}
          </span>
        }
        right={
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--apple-label-tertiary)' }}>
            1-5: Steps • I: Info • D: Theme • HM-18.0
          </span>
        }
      />
    </Window>
  );
}

export default App;
