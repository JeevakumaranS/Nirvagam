'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toast: (options: { type?: ToastType; title: string; message?: string; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ type = 'info', title, message, duration = 4000 }: { type?: ToastType; title: string; message?: string; duration?: number }) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);

      setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast]
  );

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-success shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-warning shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-danger shrink-0" />,
    info: <Info className="w-4 h-4 text-accent shrink-0" />,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none select-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'pointer-events-auto relative overflow-hidden flex items-start gap-3 p-3.5',
              'bg-surface/90 backdrop-blur-xl border border-border rounded-lg shadow-modal',
              'animate-in slide-in-from-top-2 fade-in duration-base ease-spring'
            )}
          >
            {icons[t.type]}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-text-primary tracking-tight font-sans">{t.title}</p>
              {t.message && <p className="text-[11px] text-text-secondary mt-0.5 leading-snug">{t.message}</p>}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="p-0.5 text-text-tertiary hover:text-text-primary rounded-sm transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            {/* Auto-dismiss progress bar */}
            <div
              className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent/40 origin-left"
              style={{
                animation: `toastProgress ${t.duration || 4000}ms linear forwards`,
              }}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
