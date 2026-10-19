import React from 'react';

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
