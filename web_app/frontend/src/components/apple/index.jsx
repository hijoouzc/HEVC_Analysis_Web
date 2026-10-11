import React, { useState, useRef, useEffect } from 'react';

/**
 * ============================================================================
 * applecn DESIGN SYSTEM FOR HEVC ANALYZER (macOS Tahoe 26.6.1 & Apple HIG)
 * Measured, pixel-accurate Apple Human Interface Guidelines implementation.
 * ============================================================================
 */

/* ----------------------------------------------------------------------------
 * 1. WINDOW CHROME & PRO APP FRAME (macOS 26 Tahoe)
 * ---------------------------------------------------------------------------- */

export function Window({ children, className = '', style = {}, _title, ...props }) {
  return (
    <div
      data-slot="window"
      data-platform="macos"
      className={`apple-window ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

export function WindowTrafficLights() {
  return null;
}

export function WindowTitleBar({
  title,
  subtitle,
  leading,
  trailing,
  toolbar = false,
  className = '',
  style = {},
  ...props
}) {
  return (
    <header
      data-slot="window-title-bar"
      data-toolbar={toolbar || undefined}
      className={`apple-titlebar ${toolbar ? 'titlebar-toolbar' : ''} ${className}`}
      style={style}
      {...props}
    >
      <div className="titlebar-leading">
        {leading}
      </div>
      {(title || subtitle) && (
        <div className="titlebar-center">
          {title && <div className="titlebar-title">{title}</div>}
          {subtitle && <div className="titlebar-subtitle">{subtitle}</div>}
        </div>
      )}
      <div className="titlebar-trailing">
        {trailing}
      </div>
    </header>
  );
}

export function WindowContent({ children, className = '', style = {}, ...props }) {
  return (
    <div data-slot="window-content" className={`apple-window-content ${className}`} style={style} {...props}>
      {children}
    </div>
  );
}

export function WindowStatusBar({ children, left, right, className = '', style = {} }) {
  return (
    <footer data-slot="window-status-bar" className={`apple-status-bar ${className}`} style={style}>
      <div className="status-bar-left">{left || children}</div>
      {right && <div className="status-bar-right">{right}</div>}
    </footer>
  );
}

/* ----------------------------------------------------------------------------
 * 2. SPLIT VIEW LAYOUT (Apple HIG Multi-Pane Pro Architecture)
 * ---------------------------------------------------------------------------- */

export function SplitView({ children, columns = 2, className = '', style = {}, ...props }) {
  return (
    <div
      data-slot="split-view"
      data-columns={columns}
      className={`apple-split-view cols-${columns} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

export function SplitViewSidebar({
  children,
  width = '240px',
  collapsed = false,
  className = '',
  style = {},
  'aria-label': label = 'Sidebar',
  ...props
}) {
  if (collapsed) return null;
  return (
    <aside
      data-slot="split-view-sidebar"
      aria-label={label}
      className={`apple-split-sidebar ${className}`}
      style={{ width, ...style }}
      {...props}
    >
      {children}
    </aside>
  );
}

export function SplitViewContent({
  children,
  className = '',
  style = {},
  'aria-label': label = 'Content',
  ...props
}) {
  return (
    <main
      data-slot="split-view-content"
      aria-label={label}
      className={`apple-split-content ${className}`}
      style={style}
      {...props}
    >
      {children}
    </main>
  );
}

export function SplitViewDetail({
  children,
  width = '300px',
  collapsed = false,
  className = '',
  style = {},
  'aria-label': label = 'Detail Inspector',
  ...props
}) {
  if (collapsed) return null;
  return (
    <section
      data-slot="split-view-detail"
      aria-label={label}
      className={`apple-split-detail ${className}`}
      style={{ width, ...style }}
      {...props}
    >
      {children}
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * 3. TOOLBAR & FLOATING GLASS PLATTERS
 * ---------------------------------------------------------------------------- */

export function Toolbar({ children, placement = 'top', className = '', style = {}, ...props }) {
  return (
    <div
      data-slot="toolbar"
      data-placement={placement}
      className={`apple-toolbar toolbar-${placement} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

export function ToolbarGroup({ children, className = '', style = {}, variant = 'glass', ...props }) {
  return (
    <div
      data-slot="toolbar-group"
      className={`apple-toolbar-group group-${variant} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

export function ToolbarButton({
  children,
  icon,
  prominent = false,
  active = false,
  disabled = false,
  onClick,
  title,
  className = '',
  style = {},
  ...props
}) {
  return (
    <button
      type="button"
      data-slot="toolbar-button"
      data-prominent={prominent || undefined}
      data-active={active || undefined}
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`apple-toolbar-button ${prominent ? 'is-prominent' : ''} ${active ? 'is-active' : ''} ${className}`}
      style={style}
      {...props}
    >
      {icon && <span className="toolbar-button-icon">{icon}</span>}
      {children && <span className="toolbar-button-label">{children}</span>}
    </button>
  );
}

export function ToolbarSeparator({ className = '', style = {} }) {
  return <div data-slot="toolbar-separator" className={`apple-toolbar-separator ${className}`} style={style} />;
}

export function ToolbarSpacer({ flexible = true, width = 16, className = '', style = {} }) {
  return (
    <div
      data-slot="toolbar-spacer"
      aria-hidden="true"
      style={{
        flex: flexible ? 1 : 'none',
        width: flexible ? undefined : `${width}px`,
        ...style,
      }}
      className={className}
    />
  );
}

/* ----------------------------------------------------------------------------
 * 4. PUSH BUTTON (AppKit Tahoe Measured Sizes & Variants)
 * ---------------------------------------------------------------------------- */

export function Button({
  children,
  variant = 'filled',
  size = 'regular',
  shape = 'automatic',
  className = '',
  style = {},
  disabled = false,
  onClick,
  type = 'button',
  title,
  icon,
  ...props
}) {
  const sizeClasses = {
    mini: 'apple-btn-mini',       // 16px, r=3.5px
    small: 'apple-btn-small',     // 20px, r=4.5px
    regular: 'apple-btn-regular', // 24px, r=6px
    large: 'apple-btn-large',     // 28px capsule
    xl: 'apple-btn-xl',           // 36px capsule
  };

  const variantClasses = {
    filled: 'apple-btn-filled',
    tinted: 'apple-btn-tinted',
    gray: 'apple-btn-gray',
    bordered: 'apple-btn-bordered',
    plain: 'apple-btn-plain',
    destructive: 'apple-btn-destructive',
  };

  const shapeClasses = {
    automatic: '',
    capsule: 'apple-btn-capsule',
    rounded: 'apple-btn-rounded',
    circle: 'apple-btn-circle',
  };

  const classes = [
    'apple-btn',
    sizeClasses[size] || sizeClasses.regular,
    variantClasses[variant] || variantClasses.filled,
    shapeClasses[shape] || '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classes}
      style={style}
      disabled={disabled}
      onClick={onClick}
      title={title}
      {...props}
    >
      {icon && <span className="btn-icon">{icon}</span>}
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------------------
 * 5. SEGMENTED CONTROL (With Animated Sliding Indicator)
 * ---------------------------------------------------------------------------- */

export function SegmentedControl({
  value,
  onChange,
  items = [],
  size = 'regular',
  className = '',
  style = {},
}) {
  const trackRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({});

  const sizeClasses = {
    small: 'apple-segmented-small',   // 20px
    regular: 'apple-segmented-regular', // 24px
    large: 'apple-segmented-large',   // 32px
  };

  useEffect(() => {
    const updateIndicator = () => {
      if (!trackRef.current) return;
      const activeBtn = trackRef.current.querySelector('[data-state="active"]');
      if (activeBtn) {
        setIndicatorStyle({
          width: `${activeBtn.offsetWidth}px`,
          transform: `translateX(${activeBtn.offsetLeft}px)`,
          opacity: 1,
        });
      } else {
        setIndicatorStyle({ opacity: 0 });
      }
    };

    updateIndicator();
    const rafId = requestAnimationFrame(updateIndicator);
    window.addEventListener('resize', updateIndicator);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateIndicator);
    };
  }, [value, items]);

  return (
    <div
      ref={trackRef}
      className={`apple-segmented-track ${sizeClasses[size] || sizeClasses.regular} ${className}`}
      role="tablist"
      style={style}
    >

      <div
        className="apple-segmented-indicator"
        style={indicatorStyle}
        aria-hidden="true"
      />
      {items.map((item) => {
        const isSelected = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            data-state={isSelected ? 'active' : 'inactive'}
            className={`apple-segmented-item ${isSelected ? 'active' : ''}`}
            onClick={() => onChange && onChange(item.id)}
            title={item.tooltip || item.label}
          >
            {item.icon && <span className="segmented-icon">{item.icon}</span>}
            <span className="segmented-label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * 6. CARD & GROUP BOX (AppKit Tahoe Grouped Surface)
 * ---------------------------------------------------------------------------- */

export function Card({ children, className = '', style = {}, title, subtitle, action, ...props }) {
  return (
    <div className={`apple-card ${className}`} style={style} {...props}>
      {(title || subtitle || action) && (
        <CardHeader action={action}>
          {title && <CardTitle>{title}</CardTitle>}
          {subtitle && <CardDescription>{subtitle}</CardDescription>}
        </CardHeader>
      )}
      {children}
    </div>
  );
}

export function CardHeader({ children, action, className = '', style = {} }) {
  return (
    <div className={`apple-card-header ${className}`} style={style}>
      <div className="card-header-titles">{children}</div>
      {action && <div className="card-header-action">{action}</div>}
    </div>
  );
}

export function CardTitle({ children, className = '', style = {} }) {
  return (
    <h3 className={`apple-card-title ${className}`} style={style}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '', style = {} }) {
  return (
    <p className={`apple-card-subtitle ${className}`} style={style}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '', style = {} }) {
  return (
    <div className={`apple-card-content ${className}`} style={style}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', style = {} }) {
  return (
    <div className={`apple-card-footer ${className}`} style={style}>
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * 7. TABLE (macOS AppKit Tahoe Compact 24px Striped Table)
 * ---------------------------------------------------------------------------- */

export function Table({ children, striped = true, className = '', style = {}, ...props }) {
  return (
    <div className="apple-table-container">
      <table className={`apple-table ${striped ? 'table-striped' : ''} ${className}`} style={style} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className = '', style = {} }) {
  return <thead className={`apple-table-header ${className}`} style={style}>{children}</thead>;
}

export function TableBody({ children, className = '', style = {} }) {
  return <tbody className={`apple-table-body ${className}`} style={style}>{children}</tbody>;
}

export function TableFooter({ children, className = '', style = {} }) {
  return <tfoot className={`apple-table-footer ${className}`} style={style}>{children}</tfoot>;
}

export function TableRow({ children, selected = false, active = false, className = '', onClick, style = {} }) {
  return (
    <tr
      className={`apple-table-row ${selected ? 'is-selected' : ''} ${active ? 'is-active' : ''} ${className}`}
      onClick={onClick}
      style={style}
    >
      {children}
    </tr>
  );
}

export function TableHead({ children, className = '', align = 'left', style = {} }) {
  return (
    <th className={`apple-table-th text-${align} ${className}`} style={style}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = '', align = 'left', style = {} }) {
  return (
    <td className={`apple-table-td text-${align} ${className}`} style={style}>
      {children}
    </td>
  );
}

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
      <span className="apple-select-chevron" aria-hidden="true">▾</span>
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

/* ----------------------------------------------------------------------------
 * 10. MATERIALS & LIQUID GLASS (macOS Tahoe Specular Surfaces)
 * ---------------------------------------------------------------------------- */

export function Glass({
  children,
  variant = 'regular', // regular | clear | prominent
  shape = 'rounded',   // rounded | capsule | circle
  interactive = false,
  className = '',
  style = {},
  ...props
}) {
  return (
    <div
      data-slot="glass"
      className={`apple-glass glass-${variant} shape-${shape} ${interactive ? 'pressable' : ''} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

export function Material({
  children,
  thickness = 'regular', // ultra-thin | thin | regular | thick
  className = '',
  style = {},
  ...props
}) {
  return (
    <div
      data-slot="material"
      className={`apple-material material-${thickness} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}
