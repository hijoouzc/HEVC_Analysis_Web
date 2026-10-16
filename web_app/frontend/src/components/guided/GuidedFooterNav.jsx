import React from 'react';
import { Button, Badge } from '../apple';
import { GUIDED_STEPS } from './guidedSteps';


/**
 * GuidedFooterNav
 * Fixed footer navigation bar with Previous, Next, Target CU context, and Expert jump
 */
export function GuidedFooterNav({
  activeStep = 'STEP_1',
  onSelectStep,
  selectedCu = null,
  ctuX = 0,
  ctuY = 0,
  onJumpToExpert = null,
}) {
  const currentIndex = GUIDED_STEPS.findIndex((s) => s.id === activeStep);
  const currentStep = GUIDED_STEPS[currentIndex] || GUIDED_STEPS[0];
  const prevStep = currentIndex > 0 ? GUIDED_STEPS[currentIndex - 1] : null;
  const nextStep = currentIndex < GUIDED_STEPS.length - 1 ? GUIDED_STEPS[currentIndex + 1] : null;

  return (
    <div
      style={{
        marginTop: '16px',
        padding: '10px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--fill-1)',
        borderRadius: '8px',
        border: '0.5px solid var(--separator)',
        fontSize: '11.5px',
        fontFamily: 'var(--font-mono)',
        boxSizing: 'border-box',
        flexWrap: 'wrap',
        gap: '10px',
      }}
    >
      {/* Left: Previous Step Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Button
          variant="gray"
          size="small"
          onClick={() => prevStep && onSelectStep(prevStep.id)}
          disabled={!prevStep}
          style={{ fontSize: '11px', height: '26px' }}
        >
          &lsaquo; Prev{prevStep ? `: ${prevStep.title}` : ''}
        </Button>

        {onJumpToExpert && (
          <Button
            variant="plain"
            size="mini"
            onClick={() => onJumpToExpert(currentStep.checkpoint)}
            title="Inspect in Expert 9-Tab Mode"
            style={{ fontSize: '10.5px', color: 'var(--apple-label-secondary)' }}
          >
            Open in Expert Checkpoint &rarr;
          </Button>
        )}
      </div>

      {/* Center: Selected CU Context Badge Pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--apple-label-tertiary)', fontWeight: 600 }}>CONTEXT:</span>
        <Badge variant="blue" style={{ fontSize: '11px' }}>
          CTU ({ctuX !== null ? ctuX : 0}, {ctuY !== null ? ctuY : 0})
        </Badge>

        {selectedCu ? (
          <Badge variant="green" style={{ fontSize: '11px' }}>
            CU ({selectedCu.x ?? selectedCu.abs_x ?? 0}, {selectedCu.y ?? selectedCu.abs_y ?? 0}) &bull; {selectedCu.width || 8}&times;{selectedCu.height || 8} &bull; Depth {selectedCu.depth ?? 0}
            {selectedCu.intra_dir !== null && selectedCu.intra_dir !== undefined ? ` &bull; Mode ${selectedCu.intra_dir}` : ''}
          </Badge>
        ) : (
          <span style={{ color: 'var(--apple-label-secondary)', fontStyle: 'italic', fontSize: '11px' }}>
            No specific CU selected (Defaulting to CTU root)
          </span>
        )}
      </div>

      {/* Right: Next Step Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {nextStep ? (
          <Button
            variant="filled"
            size="small"
            onClick={() => onSelectStep(nextStep.id)}
            style={{ fontSize: '11px', height: '26px', background: 'var(--system-blue)', color: '#FFFFFF' }}
          >
            Next: {nextStep.title} &rsaquo;
          </Button>
        ) : (
          <Button
            variant="tinted"
            size="small"
            onClick={() => onSelectStep('STEP_1')}
            style={{ fontSize: '11px', height: '26px' }}
          >
            Restart Flow (Step 1) &circlearrowright;
          </Button>
        )}
      </div>
    </div>
  );
}

export default React.memo(GuidedFooterNav);
