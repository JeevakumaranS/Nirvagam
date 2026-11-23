'use client';

import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', loading, icon, children, disabled, ...props }, ref) => {
    const baseClasses =
      'inline-flex items-center justify-center font-medium rounded-sm select-none transition-all duration-fast ease-standard ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 ' +
      'disabled:opacity-45 disabled:pointer-events-none active:scale-[0.98]';

    const variants = {
      primary:
        'bg-accent text-white hover:bg-accent-hover shadow-subtle border border-accent/20 active:bg-accent-hover',
      secondary:
        'bg-surface text-text-primary hover:bg-surface-secondary border border-border shadow-subtle hover:border-border/80',
      outline:
        'bg-transparent text-text-primary hover:bg-surface-secondary border border-border hover:border-text-secondary/30',
      ghost:
        'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-secondary border border-transparent',
      danger:
        'bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20 active:bg-danger/25',
    };

    const sizes = {
      sm: 'h-7 px-2.5 text-xs gap-1.5 rounded-sm',
      md: 'h-8 px-3 text-xs gap-1.5 rounded-sm',
      lg: 'h-9 px-4 text-sm gap-2 rounded',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(baseClasses, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon ? icon : null}
        <span>{children}</span>
      </button>
    );
  }
);

Button.displayName = 'Button';
