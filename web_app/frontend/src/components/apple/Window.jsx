import React from 'react';

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
