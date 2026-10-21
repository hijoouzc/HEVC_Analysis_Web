import React from 'react';
import { Button, SegmentedControl, Badge } from '../../../apple';

/**
 * ComparisonToolbar: Header & controls for FourPictureComparison
 * (Scope selector, Layout switcher, ResiGain multipliers, and Values toggle).
 */
const ComparisonToolbar = ({
  ctuX,
  ctuY,
  onSelectCTU,
  onNavigateToIntra,
  modeInfo,
  currentMode,
  scope,
  setScope,
  layoutMode,
  setLayoutMode,
  resiGain,
  setResiGain,
  propsShowValues,
  showValues,
  setShowValues,
}) => {
  return (
    <div className="stage-section-card" style={{ padding: '0.75rem 1rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
            Picture Buffer Comparison
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {ctuX !== null && ctuY !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Badge variant="tag" color="gray">
                CTU ({ctuX}, {ctuY})
              </Badge>
              {onSelectCTU && (
                <Button
                  variant="gray"
                  size="mini"
                  onClick={() => onSelectCTU(null, null)}
                  title="Deselect CTU"
                >
                  ✕
                </Button>
              )}
            </div>
          )}
          {onNavigateToIntra && (
            <Button
              variant="gray"
              size="small"
              onClick={onNavigateToIntra}
            >
              Intra →
            </Button>
          )}
          {modeInfo && (
            <>
              <Badge variant="filled" color="blue">
                Mode {currentMode.mode}: {modeInfo.name}
              </Badge>
              <Badge variant="tag" color="orange">
                Cost: {currentMode.cost?.toFixed(1) || '0.0'}
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.6rem',
          marginTop: '0.65rem',
          paddingTop: '0.65rem',
          borderTop: '1px solid var(--apple-border)',
        }}
      >
        {/* Scope SegmentedControl */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '11px', color: 'var(--apple-label-secondary)', fontWeight: 600 }}>
            Scope:
          </span>
          <SegmentedControl
            value={scope}
            onChange={setScope}
            size="small"
            items={[
              { id: 'cu', label: 'Coding Unit (CU)' },
              { id: 'frame', label: 'Full Frame' },
            ]}
          />
        </div>

        {/* Layout SegmentedControl */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '11px', color: 'var(--apple-label-secondary)', fontWeight: 600 }}>
            Layout:
          </span>
          <SegmentedControl
            value={layoutMode}
            onChange={setLayoutMode}
            size="small"
            items={[
              { id: 'grid', label: 'Grid' },
              { id: 'split', label: 'Split Slider' },
              { id: 'single', label: 'Single' },
            ]}
          />
        </div>

        {/* Gain and Values */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '11px', color: 'var(--apple-label-secondary)', fontWeight: 600 }}>
              Gain:
            </span>
            <SegmentedControl
              value={resiGain}
              onChange={setResiGain}
              size="small"
              items={[
                { id: 1, label: '1×' },
                { id: 2, label: '2×' },
                { id: 4, label: '4×' },
                { id: 8, label: '8×' },
              ]}
            />
          </div>

          {scope === 'cu' && propsShowValues === undefined && (
            <Button
              variant="gray"
              size="small"
              onClick={() => setShowValues((prev) => !prev)}
            >
              Values: {showValues ? 'On' : 'Off'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ComparisonToolbar);
