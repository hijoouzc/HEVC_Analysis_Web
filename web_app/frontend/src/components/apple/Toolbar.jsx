import React from 'react';

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
