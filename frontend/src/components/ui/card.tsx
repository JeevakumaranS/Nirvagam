'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverable = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'bg-surface border border-border rounded-md shadow-card transition-all duration-base ease-standard',
          hoverable && 'cursor-pointer hover:-translate-y-[1px] hover:shadow-modal hover:border-border/80',
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx('flex items-center justify-between px-4 py-3 border-b border-border', className)}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={clsx('text-xs font-semibold text-text-primary tracking-heading uppercase font-sans', className)}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={clsx('p-4', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';
