'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
    } else {
      const timer = setTimeout(() => setMounted(false), 140);
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

  if (!mounted || typeof document === 'undefined') return null;

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return createPortal(
    <div
      className={clsx(
        'fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-[200ms]',
        isOpen
          ? 'bg-black/35 opacity-100 pointer-events-auto'
          : 'bg-black/0 opacity-0 pointer-events-none'
      )}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          'w-full bg-surface border border-border/80 rounded-[14px] shadow-modal overflow-hidden transform transition-all',
          isOpen
            ? 'opacity-100 scale-100 translate-y-0 duration-[200ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]'
            : 'opacity-0 scale-95 translate-y-1 duration-[140ms] ease-[cubic-bezier(0.2,0,0,1)]',
          maxWidths[maxWidth]
        )}
      >
        {/* macOS Style Title Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/70 bg-surface-secondary/60">
          <div>
            <h3 className="text-[13px] font-semibold text-text-primary tracking-[-0.01em]">{title}</h3>
            {description && <p className="text-[11px] text-text-tertiary mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-6 h-6 rounded-md flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
          >
            <X className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
