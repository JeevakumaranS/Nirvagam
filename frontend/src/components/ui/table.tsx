'use client';

import React from 'react';
import { clsx } from 'clsx';

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-x-auto border border-border rounded-md bg-surface shadow-subtle">
      <table ref={ref} className={clsx('w-full text-left text-xs border-collapse', className)} {...props} />
    </div>
  )
);
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      className={clsx(
        'sticky top-0 bg-surface/95 backdrop-blur-md border-b border-border text-text-secondary z-10 select-none',
        className
      )}
      {...props}
    />
  )
);
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={clsx('divide-y divide-border bg-surface', className)} {...props} />
  )
);
TableBody.displayName = 'TableBody';

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={clsx(
        'transition-colors duration-fast ease-standard hover:bg-surface-secondary/70 data-[state=selected]:bg-accent-subtle',
        className
      )}
      {...props}
    />
  )
);
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={clsx(
        'h-8 px-3 text-[11px] font-semibold text-text-secondary uppercase tracking-section font-sans',
        className
      )}
      {...props}
    />
  )
);
TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={clsx(
        'py-2 px-3 align-middle text-text-primary text-xs tracking-tight',
        className
      )}
      {...props}
    />
  )
);
TableCell.displayName = 'TableCell';

export function TableEmptyState({ message = 'No records found' }: { message?: string }) {
  return (
    <tr>
      <td colSpan={100} className="py-12 text-center text-xs text-text-tertiary font-sans">
        {message}
      </td>
    </tr>
  );
}
