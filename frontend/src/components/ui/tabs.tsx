'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: 'line' | 'segmented';
}

export function Tabs({ tabs, activeTab, onChange, className, variant = 'line' }: TabsProps) {
  if (variant === 'segmented') {
    return (
      <div
        className={clsx(
          'inline-flex items-center p-0.5 rounded-sm bg-surface-secondary border border-border select-none',
          className
        )}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={clsx(
                'relative flex items-center gap-1.5 px-3 py-1 rounded-[5px] text-xs font-medium',
                'transition-all duration-fast ease-standard focus-visible:outline-none',
                isActive
                  ? 'bg-surface text-text-primary shadow-subtle font-medium'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface/40'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={clsx(
                    'px-1.5 py-0.2 text-[10px] rounded-full font-mono',
                    isActive ? 'bg-accent-subtle text-accent' : 'bg-surface text-text-tertiary'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={clsx('flex items-center gap-1 border-b border-border select-none', className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={clsx(
              'relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px',
              'transition-all duration-fast ease-standard focus-visible:outline-none',
              isActive
                ? 'border-accent text-accent font-medium'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={clsx(
                  'px-1.5 py-0.2 text-[10px] rounded-full font-mono transition-colors duration-fast',
                  isActive ? 'bg-accent-subtle text-accent' : 'bg-surface-secondary text-text-tertiary'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
