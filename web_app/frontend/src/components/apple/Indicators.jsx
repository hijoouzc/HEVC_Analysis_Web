import React from 'react';

/* ----------------------------------------------------------------------------
 * 9. BADGE, METER & STATUS INDICATORS
 * ---------------------------------------------------------------------------- */

export function Badge({
  children,
  variant = 'gray',
  color = null,
  className = '',
  style = {},
}) {
  const finalVariant = color || variant || 'gray';
  return (
    <span className={`apple-badge badge-${finalVariant} ${className}`} style={style}>
      {children}
    </span>
  );
}

export function Meter({
  value = 0,
  min = 0,
  max = 100,
  label = null,
  formatValue = null,
  variant = 'blue',
  className = '',
  style = {},
}) {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <div className={`apple-meter-container ${className}`} style={style}>
      {(label || formatValue) && (
        <div className="apple-meter-header">
          {label && <span className="apple-meter-label">{label}</span>}
          <span className="apple-meter-val">
            {formatValue ? formatValue(value) : `${Math.round(percentage)}%`}
          </span>
        </div>
      )}
      <div className="apple-meter-track">
        <div
          className={`apple-meter-bar bar-${variant}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function Progress({ value = 0, max = 100, indeterminate = false, className = '', style = {} }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`apple-progress-track ${indeterminate ? 'is-indeterminate' : ''} ${className}`} style={style}>
      {!indeterminate && <div className="apple-progress-fill" style={{ width: `${pct}%` }} />}
    </div>
  );
}
