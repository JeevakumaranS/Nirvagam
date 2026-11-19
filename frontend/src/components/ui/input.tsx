import React from 'react';
import { clsx } from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, prefixIcon, suffixIcon, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-text-secondary select-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefixIcon && (
            <div className="absolute left-2.5 flex items-center pointer-events-none text-text-tertiary">
              {prefixIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={clsx(
              'w-full h-8 px-2.5 text-xs bg-background text-text-primary rounded border border-border shadow-subtle',
              'placeholder:text-text-tertiary transition-colors',
              'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent',
              'disabled:opacity-50 disabled:bg-surface-secondary',
              prefixIcon && 'pl-8',
              suffixIcon && 'pr-8',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
              className
            )}
            {...props}
          />
          {suffixIcon && (
            <div className="absolute right-2.5 flex items-center text-text-tertiary">
              {suffixIcon}
            </div>
          )}
        </div>
        {error ? (
          <span className="text-[11px] text-red-500 font-normal">{error}</span>
        ) : hint ? (
          <span className="text-[11px] text-text-tertiary">{hint}</span>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
