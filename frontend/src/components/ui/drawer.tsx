'use client';

import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  width?: 'md' | 'lg' | 'xl';
}

export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  width = 'lg',
}: DrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
    } else {
      const timer = setTimeout(() => setMounted(false), 160);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen && !mounted) return null;

  const widths = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div
      className={clsx(
        'fixed inset-0 z-50 flex justify-end transition-all duration-[200ms]',
        isOpen
          ? 'bg-black/35 backdrop-blur-sm opacity-100 pointer-events-auto'
          : 'bg-black/0 backdrop-blur-none opacity-0 pointer-events-none'
      )}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          'w-full h-full bg-surface border-l border-border/80 shadow-modal flex flex-col transform transition-transform',
          isOpen
            ? 'translate-x-0 duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)]'
            : 'translate-x-full duration-[160ms] ease-[cubic-bezier(0.2,0,0,1)]',
          widths[width]
        )}
      >
        {/* macOS Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/70 bg-surface-secondary/50">
          <div>
            <h3 className="text-[13px] font-semibold text-text-primary tracking-[-0.01em]">{title}</h3>
            {description && <p className="text-[11px] text-text-tertiary mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-md flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
          >
            <X className="w-4 h-4 stroke-[1.5]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
