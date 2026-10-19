import React from 'react';

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
