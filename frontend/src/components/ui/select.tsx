import React from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';

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
      <div className="w-full flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="text-xs font-medium text-text-secondary select-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            id={selectId}
            ref={ref}
            className={clsx(
              'w-full h-8 pl-2.5 pr-8 text-xs bg-background text-text-primary rounded border border-border shadow-subtle appearance-none cursor-pointer',
              'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors',
              'disabled:opacity-50 disabled:bg-surface-secondary',
              error && 'border-red-500 focus:border-red-500',
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
        {error && <span className="text-[11px] text-red-500">{error}</span>}
        {hint && !error && <span className="text-[11px] text-text-tertiary">{hint}</span>}
      </div>
    );
  }
);

Select.displayName = 'Select';
