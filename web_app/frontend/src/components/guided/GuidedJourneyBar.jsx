import React from 'react';
import { Badge } from '../apple';
import { GUIDED_STEPS } from './guidedSteps';

/**
 * GuidedJourneyBar
 * macOS Tahoe 5-Step Progress, Active Target Breadcrumb & Global Chroma Channel Controller
 */
const STEP_SHORT_TITLES = {
  STEP_1: 'Partition',
  STEP_2: 'Prediction',
  STEP_3: 'Residual & TU',
  STEP_4: 'Reconstruction',
  STEP_5: 'RD Decision',
};

export function GuidedJourneyBar({
  activeStep = 'STEP_1',
  onSelectStep,
  selectedCu = null,
  splitDecision: _splitDecision = null,
  hasTransform: _hasTransform = false,
  hasRecon: _hasRecon = false,
  hasRdo: _hasRdo = false,
  ctuX = 0,
  ctuY = 0,
  channel = 'Y',
  onSelectChannel = null,
  showValues = true,
  onToggleValues = null,
}) {
  const isParentCu = Boolean(selectedCu?.split);
  const cuSizeStr = selectedCu ? `${selectedCu.width || 8}×${selectedCu.height || 8}` : '64×64';
  const cuPosStr = selectedCu ? `(${selectedCu.x ?? selectedCu.abs_x ?? 0}, ${selectedCu.y ?? selectedCu.abs_y ?? 0})` : `(0, 0)`;

  const normalizedChannel = (channel === 'U' ? 'Cb' : (channel === 'V' ? 'Cr' : (channel || 'Y')));

  // Keyboard shortcuts for Channel (C) and Values (V); Steps 1-5 handled globally by App.jsx
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName) || e.target?.isContentEditable) return;
      if ((e.key === 'c' || e.key === 'C') && onSelectChannel) {
        const nextCh = normalizedChannel === 'Y' ? 'Cb' : (normalizedChannel === 'Cb' ? 'Cr' : 'Y');
        onSelectChannel(nextCh);
      }
      if ((e.key === 'v' || e.key === 'V') && onToggleValues) {
        onToggleValues();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectChannel, onToggleValues, normalizedChannel]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        marginBottom: '10px',
        background: 'var(--fill-1)',
        padding: '6px 10px',
        borderRadius: '8px',
        border: '0.5px solid var(--separator)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
        boxSizing: 'border-box'
      }}
    >
      {/* Target Breadcrumb & Global Channel/Values Strip */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          overflowY: 'hidden',
          gap: '8px',
          height: '24px',
          paddingBottom: '4px',
          borderBottom: '0.5px solid var(--separator)',
          boxSizing: 'border-box',
          flexShrink: 0
        }}
      >
        {/* Left: Target CTU & CU Inspector Summary (Responsive minWidth) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', flexShrink: 1, minWidth: 0, overflow: 'hidden', fontSize: '11px', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ color: 'var(--apple-label-tertiary)', fontWeight: 600 }}>TARGET:</span>
          <span style={{ color: 'var(--apple-label)', fontWeight: 700, whiteSpace: 'nowrap' }}>
            CTU ({ctuX ?? 0}, {ctuY ?? 0})
          </span>
          <span style={{ color: 'var(--separator)' }}>&rsaquo;</span>
          <span style={{ color: 'var(--system-blue)', fontWeight: 700, whiteSpace: 'nowrap' }}>
            CU {cuSizeStr}
          </span>
          <span style={{ color: 'var(--apple-label-secondary)', whiteSpace: 'nowrap' }}>
            at {cuPosStr}
          </span>
          <Badge
            variant={isParentCu ? 'purple' : 'green'}
            style={{ fontSize: '9px', padding: '1px 5px', fontWeight: 600, flexShrink: 0 }}
          >
            {isParentCu ? 'Split CU' : 'Leaf CU'}
          </Badge>
        </div>

        {/* Right: Unified Global Controls (Values + Channel) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Values Matrix Overlay Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--apple-label-secondary)', fontWeight: 600 }}>
              VALUES:
            </span>
            <button
              type="button"
              onClick={() => onToggleValues && onToggleValues()}
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                padding: '2px 7px',
                borderRadius: '4px',
                background: showValues ? 'var(--system-blue)' : 'var(--window-bg)',
                color: showValues ? '#FFFFFF' : 'var(--apple-label)',
                border: '0.5px solid var(--separator)',
                cursor: 'pointer',
                fontWeight: showValues ? 700 : 500,
                transition: 'all 0.15s ease',
              }}
              title="Toggle numerical values on sample matrices (V). QP, RDO costs, and telemetry metrics remain visible."
            >
              {showValues ? 'ON' : 'OFF'}
            </button>
          </div>

          <span style={{ color: 'var(--separator)', fontSize: '11px' }}>•</span>

          {/* Unified Chroma Channel Switcher [ Y | Cb | Cr ] */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--apple-label-secondary)', fontWeight: 600 }}>
              CHANNEL:
            </span>
            <div style={{ display: 'flex', gap: '3px' }}>
              {[
                { id: 'Y', label: 'Y', title: 'Luma plane (Y)' },
                { id: 'Cb', label: 'Cb', title: 'Chroma blue-diff plane (Cb) — Active in Steps 2, 3, 4' },
                { id: 'Cr', label: 'Cr', title: 'Chroma red-diff plane (Cr) — Active in Steps 2, 3, 4' },
              ].map((ch) => {
                const isActive = normalizedChannel === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => onSelectChannel && onSelectChannel(ch.id)}
                    style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: isActive ? 'var(--system-blue)' : 'var(--window-bg)',
                      color: isActive ? '#FFFFFF' : 'var(--apple-label)',
                      border: '0.5px solid var(--separator)',
                      cursor: 'pointer',
                      fontWeight: isActive ? 700 : 500,
                      transition: 'all 0.15s ease',
                    }}
                    title={ch.title}
                  >
                    {ch.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 5-Step Stepper Chips (Streamlined Single-Line) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '2px 0',
        }}
      >
        {GUIDED_STEPS.map((step, idx) => {
          const isSelected = activeStep === step.id;

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => onSelectStep && onSelectStep(step.id)}
                title={`${step.title} (${step.subtitle || ''})`}
                style={{
                  flex: 1,
                  minWidth: '96px',
                  height: '28px',
                  padding: '0 8px',
                  borderRadius: '6px',
                  background: isSelected ? 'var(--window-bg)' : 'transparent',
                  border: isSelected ? '0.5px solid var(--separator)' : '0.5px solid transparent',
                  boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    color: isSelected ? 'var(--system-blue)' : 'var(--apple-label-tertiary)',
                  }}
                >
                  0{step.num}
                </span>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: isSelected ? 600 : 500,
                    color: isSelected ? 'var(--apple-label)' : 'var(--apple-label-secondary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {STEP_SHORT_TITLES[step.id] || step.title}
                </span>
              </button>

              {idx < GUIDED_STEPS.length - 1 && (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--separator)',
                    fontSize: '11px',
                    userSelect: 'none',
                    flexShrink: 0,
                  }}
                >
                  &rsaquo;
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(GuidedJourneyBar);
