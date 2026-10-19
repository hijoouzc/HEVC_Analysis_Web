import React from 'react';

/* ----------------------------------------------------------------------------
 * 8. FORM CONTROLS (Input, Select, Switch, Slider, Checkbox)
 * ---------------------------------------------------------------------------- */

export function Input({
  value,
  onChange,
  placeholder,
  className = '',
  style = {},
  type = 'text',
  disabled = false,
  size = 'regular',
  ...props
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={`apple-input size-${size} ${className}`}
      style={style}
      {...props}
    />
  );
}

export function Select({
  value,
  onChange,
  options = [],
  children,
  className = '',
  style = {},
  disabled = false,
  size = 'regular',
  ...props
}) {
  return (
    <div className={`apple-select-wrapper size-${size} ${className}`} style={style}>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="apple-select-control"
        {...props}
      >
        {options.length > 0
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
    </div>
  );
}

export function Switch({
  checked = false,
  onChange,
  disabled = false,
  label,
  className = '',
  style = {},
}) {
  return (
    <label className={`apple-switch-label ${disabled ? 'is-disabled' : ''} ${className}`} style={style}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange && onChange(!checked)}
        className={`apple-switch ${checked ? 'is-checked' : ''}`}
      >
        <span className="apple-switch-thumb" />
      </button>
      {label && <span className="apple-switch-text">{label}</span>}
    </label>
  );
}

export function Checkbox({
  checked = false,
  onChange,
  label,
  disabled = false,
  className = '',
  style = {},
  ...props
}) {
  return (
    <label
      className={`apple-checkbox-label ${disabled ? 'is-disabled' : ''} ${className}`}
      style={style}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.checked)}
        className="apple-checkbox"
        {...props}
      />
      {label && <span className="apple-checkbox-text">{label}</span>}
    </label>
  );
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  showValue = true,
  formatValue = null,
  badgeColor = null,
  badgeBg = null,
  disabled = false,
  className = '',
  style = {},
  inputStyle = {},
  title = null,
  ...props
}) {
  const displayVal = formatValue ? formatValue(value) : `${value}${unit}`;

  return (
    <div
      data-slot="slider"
      className={`apple-slider-container ${className}`}
      style={style}
      title={title || undefined}
    >
      {label && <span className="apple-slider-label">{label}</span>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange && onChange(Number(e.target.value))}
        className="apple-slider"
        style={inputStyle}
        {...props}
      />
      {showValue && (
        <span
          className="apple-slider-value"
          style={{
            color: badgeColor || undefined,
            backgroundColor: badgeBg || undefined,
          }}
        >
          {displayVal}
        </span>
      )}
    </div>
  );
}
