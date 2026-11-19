'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Search, Moon, Sun, LogOut, ChevronRight, User } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export function Topbar() {
  const pathname = usePathname();
  const { user, theme, toggleTheme, logout } = useAuth();

  const segments = pathname
    .split('/')
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

  return (
    <header className="h-12 px-4 flex items-center justify-between border-b border-border bg-background select-none">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
        <span>Nirvagam</span>
        {segments.map((seg, idx) => (
          <React.Fragment key={idx}>
            <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />
            <span className={idx === segments.length - 1 ? 'font-medium text-text-primary' : ''}>
              {seg}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Quick Search Shortcut */}
        <button
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
          }}
          className="flex items-center gap-2 px-2.5 py-1 text-xs text-text-tertiary bg-surface-secondary hover:bg-app-frame rounded border border-border transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Quick search...</span>
          <kbd className="text-[10px] bg-background px-1.5 py-0.2 rounded border border-border font-mono">
            ⌘K
          </kbd>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface-secondary border border-transparent hover:border-border transition-colors"
        >
          {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
        </button>

        {/* User Profile Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <div className="w-6 h-6 rounded-full bg-accent/15 text-accent flex items-center justify-center font-semibold text-xs">
            {user?.firstName?.[0] || 'U'}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-medium text-text-primary leading-none">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[10px] text-text-tertiary font-mono leading-none mt-0.5">
              {user?.roles?.[0] || 'Staff'}
            </p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 rounded text-text-tertiary hover:text-red-500 hover:bg-surface-secondary transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
