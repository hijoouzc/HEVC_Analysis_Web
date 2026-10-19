import React from 'react';

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
