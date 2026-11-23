'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function Switch({ checked, onChange, disabled, label, className }: SwitchProps) {
  return (
    <label
      className={clsx(
        'inline-flex items-center gap-2 select-none cursor-pointer',
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        className
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
          'transition-colors duration-base ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
          checked ? 'bg-accent' : 'bg-surface-secondary border-border/80'
        )}
      >
        <span
          className={clsx(
            'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-subtle',
            'transition-transform duration-base ease-spring',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </button>
      {label && <span className="text-xs text-text-primary font-medium">{label}</span>}
    </label>
  );
}
