'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent' | 'outline';
  size?: 'sm' | 'md';
}

export function Badge({
  className,
  variant = 'neutral',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  const variants = {
    neutral: 'bg-app-frame/60 text-text-secondary border-border/80',
    success: 'bg-success/12 text-success border-success/20',
    warning: 'bg-warning/12 text-warning border-warning/20',
    danger: 'bg-danger/12 text-danger border-danger/20',
    accent: 'bg-accent/12 text-accent border-accent/20',
    outline: 'bg-transparent text-text-secondary border-border',
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 leading-none',
    md: 'text-[11px] px-2.5 py-0.5 leading-tight',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 font-medium rounded-full border tracking-tight select-none font-sans',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
