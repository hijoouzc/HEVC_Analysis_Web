import React from 'react';
import { Button, Slider, Select, Checkbox } from '../apple';

/**
 * SimulatorControls
 * Clean, minimalist timeline navigation and parameter controllers.
 * Fully reconstructed with authentic Apple HIG / applecn components:
 * - Apple Buttons with 0.97 press physics
 * - Apple Sliders with progress fill & thumb shadow
 * - Apple Select with custom bezel and chevron
 * - Apple Checkbox with System Blue checkmark
 */
export default function SimulatorControls({
  stepIdx,
  totalSteps,
  isPlaying,
  onFirst,
  onPrev,
  onTogglePlay,
  onNext,
  onLast,
  qp,
  lambdaVal,
  onQpChange,
  speed,
  onSpeedChange,
  patternType,
  onPatternChange,
  hasImage,
  ctuX,
  ctuY,
  showValues,
  onToggleValues
}) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '0.5px solid var(--separator)',
      borderRadius: 'var(--card-radius)',
      boxShadow: 'var(--shadow-card-small)',
      padding: '0.65rem 0.85rem',
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '0.65rem'
    }}>
      {/* Playback Stepper Control Group */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <div className="apple-segmented-track" style={{ height: '28px', padding: '2px', gap: '2px', alignItems: 'center' }}>
          <Button
            variant="gray"
            size="regular"
            onClick={onFirst}
            title="First Step"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '0 8px', height: '24px' }}
          >
            First
          </Button>
          <Button
            variant="gray"
            size="regular"
            onClick={onPrev}
            disabled={stepIdx === 0}
            title="Previous Step"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '0 8px', height: '24px' }}
          >
            Prev
          </Button>
          <Button
            variant={isPlaying ? 'filled' : 'gray'}
            size="regular"
            onClick={onTogglePlay}
            style={{
              padding: '0 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 700,
              height: '24px',
              ...(isPlaying ? { backgroundColor: 'var(--system-orange)', color: '#FFFFFF' } : {})
            }}
            title={isPlaying ? 'Pause Timeline' : 'Play Timeline'}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <Button
            variant="gray"
            size="regular"
            onClick={onNext}
            disabled={stepIdx >= totalSteps - 1}
            title="Next Step"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '0 8px', height: '24px' }}
          >
            Next
          </Button>
          <Button
            variant="gray"
            size="regular"
            onClick={onLast}
            title="Last Step"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '0 8px', height: '24px' }}
          >
            Last
          </Button>
        </div>

        <span style={{
          fontSize: '11.5px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          color: 'var(--label-2)'
        }}>
          Step {stepIdx + 1} / {totalSteps}
        </span>
      </div>

      {/* Parameters & Configuration */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
        {/* QP Slider & Live Lambda Variable */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Slider
            label="QP:"
            min={10}
            max={51}
            step={1}
            value={qp}
            onChange={onQpChange}
            badgeColor="var(--system-blue)"
            badgeBg="rgba(0, 122, 255, 0.12)"
            title={`Quantization Parameter QP = ${qp} (Range: 10–51)`}
          />
          {typeof lambdaVal === 'number' && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--apple-label-secondary)',
                padding: '1px 5px',
                background: 'var(--fill-4)',
                border: '0.5px solid var(--separator)',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
              }}
              title={`Lagrange Multiplier λ = 0.57 × 2^((QP-12)/3) = ${lambdaVal.toFixed(2)}`}
            >
              λ={lambdaVal < 10 ? lambdaVal.toFixed(2) : Math.round(lambdaVal)}
            </span>
          )}
        </div>

        {/* Speed Slider */}
        <Slider
          label="Speed:"
          min={150}
          max={1500}
          step={50}
          value={speed}
          onChange={onSpeedChange}
          unit="ms"
          badgeColor="var(--apple-label-primary)"
          badgeBg="var(--fill-4)"
          title={`Timeline step delay = ${speed} ms`}
        />

        {/* Source Patch Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--label-2)' }}>Patch:</span>
          <Select
            value={patternType}
            onChange={(e) => onPatternChange(e.target.value)}
            options={[
              ...(hasImage ? [{ value: 'image', label: `CTU (${ctuX}, ${ctuY})` }] : []),
              { value: 'gradient', label: 'Gradient Edge' },
              { value: 'checkerboard', label: 'Checkerboard' },
              { value: 'flat', label: 'Flat Region' },
              { value: 'circle', label: 'Disc Edge' },
            ]}
          />
        </div>

        {/* Value Display Toggle */}
        <Checkbox
          checked={showValues}
          onChange={onToggleValues}
          label="Values"
        />
      </div>
    </div>
  );
}
