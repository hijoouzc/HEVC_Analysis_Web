import React, { useEffect, useCallback } from 'react';
import { Button } from '../apple';
import { PIPELINE_STEPS } from '../../constants/intraPipelineSteps';

/**
 * IntraPipelineStepper
 * 5-Stage Execution Timeline Stepper for HEVC Intra Prediction Search & RDO
 * 100% Click-Only: zero hover flutter, zero hover listeners.
 */
export default function IntraPipelineStepper({
  activeStep = 1,
  onSelectStep = null
}) {
  const handlePrev = useCallback(() => {
    if (activeStep > 1 && onSelectStep) {
      onSelectStep(activeStep - 1);
    }
  }, [activeStep, onSelectStep]);

  const handleNext = useCallback(() => {
    if (activeStep < PIPELINE_STEPS.length && onSelectStep) {
      onSelectStep(activeStep + 1);
    }
  }, [activeStep, onSelectStep]);

  // Keyboard navigation: Left/Right arrows when active
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName)) return;
      if (e.key === 'ArrowLeft' && activeStep > 1) {
        handlePrev();
      } else if (e.key === 'ArrowRight' && activeStep < PIPELINE_STEPS.length) {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeStep, handlePrev, handleNext]);

  return (
    <div className="apple-card" style={{
      padding: '0.85rem 1rem',
      marginBottom: '1rem',
      background: 'var(--apple-canvas)',
      border: '1px solid var(--apple-hairline)'
    }}>
      {/* Top Header & Quick Stepper Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem',
        marginBottom: '0.85rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid var(--apple-hairline)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            fontSize: '0.74rem',
            fontWeight: 800,
            color: 'var(--apple-label)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            fontFamily: 'JetBrains Mono'
          }}>
            HM-18.0 Intra Search Call-Stack Stepper
          </span>
          <span style={{
            fontSize: '0.70rem',
            color: 'var(--apple-label-secondary)',
            fontFamily: 'JetBrains Mono'
          }}>
            [Step {activeStep} of {PIPELINE_STEPS.length}]
          </span>
        </div>

        {/* Step Prev / Next Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Button
            variant="gray"
            size="small"
            onClick={handlePrev}
            disabled={activeStep <= 1}
            title="Go to previous pipeline stage (←)"
          >
            ← Prev Stage
          </Button>
          <Button
            variant="gray"
            size="small"
            onClick={handleNext}
            disabled={activeStep >= PIPELINE_STEPS.length}
            title="Advance to next pipeline stage (→)"
          >
            Next Stage →
          </Button>
        </div>
      </div>

      {/* 5-Step Stepper Ribbon */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
        gap: '0.5rem',
        width: '100%'
      }}>
        {PIPELINE_STEPS.map((step) => {
          const isActive = step.id === activeStep;
          const isCompleted = step.id < activeStep;

          return (
            <div
              key={step.id}
              onClick={() => onSelectStep && onSelectStep(step.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
                padding: '0.55rem 0.65rem',
                borderRadius: '4px',
                cursor: 'pointer',
                userSelect: 'none',
                background: isActive
                  ? 'var(--apple-blue-subtle, rgba(0, 122, 255, 0.12))'
                  : isCompleted
                  ? 'var(--apple-surface, #F5F5F7)'
                  : 'transparent',
                border: isActive
                  ? '1.5px solid var(--apple-blue, #007AFF)'
                  : isCompleted
                  ? '1px solid var(--apple-hairline)'
                  : '1px solid var(--apple-hairline)',
                outline: 'none',
                transition: 'none'
              }}
            >
              {/* Step Top Row: Number & Tag */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  fontFamily: 'JetBrains Mono',
                  color: isActive
                    ? 'var(--apple-blue, #007AFF)'
                    : isCompleted
                    ? 'var(--system-green, #34C759)'
                    : 'var(--apple-label-secondary)'
                }}>
                  {isCompleted ? `✓ STEP ${step.id}` : `STEP ${step.id}`}
                </span>

                <span style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  fontFamily: 'JetBrains Mono',
                  padding: '1px 4px',
                  borderRadius: '2px',
                  background: isActive ? 'var(--apple-blue)' : 'rgba(0, 0, 0, 0.08)',
                  color: isActive ? '#FFFFFF' : 'var(--apple-label-tertiary)'
                }}>
                  {step.tag}
                </span>
              </div>

              {/* Step Title */}
              <div style={{
                fontSize: '0.78rem',
                fontWeight: isActive ? 800 : 600,
                color: isActive ? 'var(--apple-label)' : 'var(--apple-label-secondary)',
                lineHeight: 1.2
              }}>
                {step.title}
              </div>

              {/* Step Subtitle / C++ function */}
              <div style={{
                fontSize: '0.68rem',
                fontFamily: 'JetBrains Mono',
                color: isActive ? 'var(--apple-blue)' : 'var(--apple-label-tertiary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {step.functionName}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
