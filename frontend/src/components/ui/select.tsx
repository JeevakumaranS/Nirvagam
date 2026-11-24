'use client';

import React from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';
import { FieldLabel } from './field-label';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options?: { value: string | number; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, options, children, id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1 text-left">
        {label && (
          <FieldLabel
            htmlFor={selectId}
            label={label}
            className="text-xs font-medium text-text-secondary select-none tracking-tight"
          />
        )}
        <div className="relative flex items-center">
          <select
            id={selectId}
            ref={ref}
            className={clsx(
              'w-full h-8 pl-2.5 pr-8 text-xs bg-surface text-text-primary rounded-sm border border-border appearance-none cursor-pointer',
              'transition-all duration-fast ease-standard',
              'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/35',
              'disabled:opacity-50 disabled:bg-surface-secondary',
              error && 'border-danger focus:border-danger focus:ring-danger/30',
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <ChevronDown className="absolute right-2.5 w-3.5 h-3.5 pointer-events-none text-text-tertiary" />
        </div>
        {error ? (
          <span className="text-[11px] text-danger font-normal leading-tight">{error}</span>
        ) : hint ? (
          <span className="text-[11px] text-text-tertiary font-normal leading-tight">{hint}</span>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
