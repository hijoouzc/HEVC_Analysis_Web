import React from 'react';

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
