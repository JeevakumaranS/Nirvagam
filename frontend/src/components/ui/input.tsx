'use client';

import React from 'react';
import { clsx } from 'clsx';
import { FieldLabel } from './field-label';

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
      <div className="w-full flex flex-col gap-1 text-left">
        {label && (
          <FieldLabel
            htmlFor={inputId}
            label={label}
            className="text-xs font-medium text-text-secondary select-none tracking-tight"
          />
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
              'w-full h-8 px-2.5 text-xs bg-surface text-text-primary rounded-sm border border-border',
              'placeholder:text-text-tertiary/80 transition-all duration-fast ease-standard',
              'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/35',
              'disabled:opacity-50 disabled:bg-surface-secondary',
              prefixIcon && 'pl-8',
              suffixIcon && 'pr-8',
              error && 'border-danger focus:border-danger focus:ring-danger/30',
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
          <span className="text-[11px] text-danger font-normal leading-tight">{error}</span>
        ) : hint ? (
          <span className="text-[11px] text-text-tertiary font-normal leading-tight">{hint}</span>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
