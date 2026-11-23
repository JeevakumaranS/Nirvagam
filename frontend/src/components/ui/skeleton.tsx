'use client';

import React from 'react';
import { clsx } from 'clsx';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded bg-border/40',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r',
        'before:from-transparent before:via-surface/40 before:to-transparent',
        className
      )}
      {...props}
    />
  );
}
