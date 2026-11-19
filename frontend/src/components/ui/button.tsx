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
      'inline-flex items-center justify-center font-medium rounded transition-colors focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:pointer-events-none select-none';

    const variants = {
      primary: 'bg-accent text-white hover:bg-accent-hover shadow-subtle border border-transparent',
      secondary:
        'bg-surface-secondary text-text-primary hover:bg-app-frame border border-border shadow-subtle',
      outline:
        'bg-transparent text-text-primary hover:bg-surface-secondary border border-border',
      ghost:
        'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-secondary border border-transparent',
      danger:
        'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20',
    };

    const sizes = {
      sm: 'h-7 px-2.5 text-xs gap-1.5',
      md: 'h-8 px-3 text-xs gap-2',
      lg: 'h-9 px-4 text-sm gap-2',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(baseClasses, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon ? icon : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
