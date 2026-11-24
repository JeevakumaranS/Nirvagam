'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Search, Moon, Sun, LogOut, ChevronRight, Menu } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const pathname = usePathname();
  const { user, theme, toggleTheme, logout } = useAuth();

  const segments = pathname
    .split('/')
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

  return (
    <header className="min-h-12 px-3 sm:px-5 flex items-center gap-3 macos-vibrancy border-b border-border/80 shrink-0 select-none transition-colors duration-200">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="lg:hidden w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5"
      >
        <Menu className="w-4 h-4" />
      </button>
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1 text-[12px] text-text-secondary">
        <div className="hidden sm:flex items-center gap-1.5 min-w-0">
          <span className="shrink-0 font-normal text-text-secondary">Nirvagam</span>
          {segments.map((segment, index) => (
            <React.Fragment key={`${segment}-${index}`}>
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-text-tertiary stroke-[1.5]" />
              <span
                className={`truncate ${
                  index === segments.length - 1
                    ? 'font-medium text-text-primary'
                    : 'font-normal text-text-secondary'
                }`}
              >
                {segment}
              </span>
            </React.Fragment>
          ))}
        </div>
        <span className="sm:hidden block truncate font-medium text-text-primary">
          {segments.length > 1 ? `${segments[0]} · ${segments[segments.length - 1]}` : segments[0]}
        </span>
      </nav>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <button
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
          }}
          className="hidden lg:flex items-center gap-2.5 h-7 px-3 text-[12px] text-text-secondary bg-black/5 dark:bg-white/5 hover:bg-black/8 dark:hover:bg-white/10 rounded-full border border-border/60 hover:border-border transition-all duration-150 active:scale-[0.98]"
        >
          <Search className="w-3.5 h-3.5 text-text-tertiary stroke-[1.5]" />
          <span className="text-text-tertiary">Quick search...</span>
          <kbd className="text-[10px] bg-background/80 px-1.5 py-0.5 rounded border border-border/80 text-text-secondary font-mono tracking-tight shadow-sm">
            ⌘K
          </kbd>
        </button>

        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          aria-label="Toggle color theme"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
        >
          {theme === 'light' ? (
            <Moon className="w-3.5 h-3.5 stroke-[1.5]" />
          ) : (
            <Sun className="w-3.5 h-3.5 stroke-[1.5]" />
          )}
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2.5 sm:pl-3 sm:border-l border-border/70">
          <div className="w-6 h-6 rounded-full bg-accent/15 text-accent flex items-center justify-center font-semibold text-[11px] shadow-sm">
            {user?.firstName?.[0] || 'U'}
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-[12px] font-medium text-text-primary leading-tight">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="hidden lg:block text-[10px] text-text-tertiary font-mono leading-tight">
              {user?.roles?.[0] || 'Staff'}
            </p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary hover:text-danger hover:bg-danger/10 active:scale-95 transition-all"
          >
            <LogOut className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>
        </div>
      </div>
    </header>
  );
}
