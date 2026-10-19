import React from 'react';
import { FullFrameViewer } from '../stages/cp00_frame_gop';
import { Card, Badge, Button } from '../apple';

/**
 * SetupScreen
 * Screen 1: File selection, resolution scaling choice (Native 1:1 vs Fast 640x360),
 * target CTU focus coordinate picker, and full-frame visualizer.
 * 100% compliant with Apple HIG and applecn macOS Tahoe 26.6.1 standards.
 */
const SetupScreen = ({
  file,
  rawImageDims,
  imageDims,
  ctuX,
  ctuY,
  loading,
  imagePreview,
  partitionData,
  ctuPartitionsMap,
  allCtus = false,
  setAllCtus,
  profile = 'all_intra',
  setProfile,
  frames = 1,
  setFrames,
  onFileChange,
  onSelectCTU,
  onReAnalyze,
  onUpload,
  onOpenSimulator,
}) => {
  return (
    <div className="workspace-layout">
      {/* Left Column: Input Source & Target Coordinates */}
      <div className="workspace-sidebar">
        <Card style={{ padding: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--apple-label)', marginBottom: '10px' }}>
            Source Image
          </div>

          <input
            type="file"
            id="file-upload"
            onChange={onFileChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
          <label
            htmlFor="file-upload"
            className="apple-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px 14px',
              border: '1px solid var(--separator)',
              borderRadius: '8px',
              cursor: 'pointer',
              background: 'var(--fill-4)',
              transition: 'background-color 150ms ease, border-color 150ms ease',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--apple-label)' }}>
                {file ? file.name : 'Select Image File'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--apple-label-2)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                {rawImageDims.width ? `${rawImageDims.width} × ${rawImageDims.height}` : 'PNG, JPG, BMP'}
              </div>
            </div>
          </label>

          {file && rawImageDims.width > 0 && (
            <div
              style={{
                marginTop: '10px',
                padding: '8px 10px',
                background: 'var(--fill-3)',
                border: '0.5px solid var(--separator)',
                borderRadius: '6px',
              }}
            >
              <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--apple-label-2)', marginBottom: '2px', fontFamily: 'var(--font-mono)' }}>
                Resolution
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--apple-label)', fontFamily: 'var(--font-mono)' }}>
                {imageDims.width} × {imageDims.height} • {Math.ceil(imageDims.width / 64)} × {Math.ceil(imageDims.height / 64)} CTUs
              </div>
            </div>
          )}
        </Card>

        <Card style={{ padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--apple-label)' }}>Analysis Scope</span>
            <Badge variant="blue">
              {allCtus ? 'Full Frame' : (ctuX !== null && ctuY !== null ? `CTU (${ctuX}, ${ctuY})` : '(0, 0)')}
            </Badge>
          </div>

          {/* Scope Toggle Button Group */}
          {setAllCtus && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setAllCtus(false)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  fontSize: '11px',
                  fontWeight: !allCtus ? 600 : 400,
                  borderRadius: '6px',
                  border: !allCtus ? '1px solid var(--apple-blue)' : '1px solid var(--separator)',
                  background: !allCtus ? 'rgba(0, 122, 255, 0.12)' : 'var(--fill-3)',
                  color: !allCtus ? 'var(--apple-blue)' : 'var(--apple-label-secondary)',
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
              >
                Target CTU
              </button>
              <button
                type="button"
                onClick={() => setAllCtus(true)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  fontSize: '11px',
                  fontWeight: allCtus ? 600 : 400,
                  borderRadius: '6px',
                  border: allCtus ? '1px solid var(--apple-blue)' : '1px solid var(--separator)',
                  background: allCtus ? 'rgba(0, 122, 255, 0.12)' : 'var(--fill-3)',
                  color: allCtus ? 'var(--apple-blue)' : 'var(--apple-label-secondary)',
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
              >
                Full Frame
              </button>
            </div>
          )}

          {/* Encoder Profile Selector */}
          {setProfile && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', color: 'var(--apple-label-2)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
                Encoder Profile
              </div>
              <select
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: '11.5px',
                  borderRadius: '6px',
                  border: '1px solid var(--separator)',
                  background: 'var(--fill-3)',
                  color: 'var(--apple-label)',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              >
                <option value="all_intra">All-Intra (Intra Prediction)</option>
                <option value="low_delay_p">Low-Delay-P (Inter Prediction)</option>
                <option value="random_access">Random-Access (Hierarchical B)</option>
              </select>
            </div>
          )}

          {/* Frames Slider if Inter Prediction */}
          {setFrames && profile !== 'all_intra' && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--apple-label-2)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
                <span>Encoding Frames:</span>
                <span style={{ color: 'var(--apple-label)', fontWeight: 600 }}>{frames} frames</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={frames}
                onChange={(e) => setFrames(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: 'var(--apple-blue)' }}
              />
            </div>
          )}

          <div
            style={{
              padding: '8px 10px',
              background: 'var(--fill-3)',
              border: '0.5px solid var(--separator)',
              borderRadius: '6px',
              marginBottom: '14px',
              fontSize: '11.5px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--apple-label-2)' }}>CTU Focus:</span>
              <span style={{ color: 'var(--apple-label)', fontWeight: 700 }}>
                {allCtus ? 'All CTUs' : (ctuX !== null && ctuY !== null ? `(${ctuX}, ${ctuY})` : '(0, 0)')}
              </span>
            </div>
          </div>

          <Button
            variant="filled"
            size="large"
            onClick={onUpload}
            disabled={!file || loading}
            style={{ width: '100%' }}
          >
            {loading ? 'Analyzing...' : (allCtus ? 'Analyze Entire Frame' : 'Start HM Analysis')}
          </Button>

          <Button
            variant="gray"
            size="regular"
            onClick={onOpenSimulator}
            style={{ width: '100%', marginTop: '8px' }}
          >
            Launch Standalone Simulator
          </Button>
        </Card>
      </div>

      {/* Right Column: Interactive Frame Preview */}
      <div className="workspace-main">
        {imagePreview ? (
          <FullFrameViewer
            imageSrc={imagePreview}
            imageDims={imageDims}
            ctuX={ctuX}
            ctuY={ctuY}
            onSelectCTU={onSelectCTU}
            partitionData={partitionData}
            ctuPartitionsMap={ctuPartitionsMap}
            isAnalyzed={false}
            onReAnalyze={onReAnalyze}
            loading={loading}
          />
        ) : (
          <Card
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '380px',
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--apple-label-2)', fontWeight: 600 }}>
              No image loaded. Select an image file to begin CTU analysis.
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SetupScreen;
