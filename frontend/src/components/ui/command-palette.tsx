'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, LayoutDashboard, FileText, ShoppingCart, Package, Users, Settings, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const { theme, toggleTheme } = useAuth();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const actions = [
    { name: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, href: '/dashboard' },
    { name: 'Invoices & Billing', icon: <FileText className="w-4 h-4" />, href: '/dashboard' },
    { name: 'POS Fast Billing', icon: <ShoppingCart className="w-4 h-4" />, href: '/dashboard' },
    { name: 'Inventory & Products', icon: <Package className="w-4 h-4" />, href: '/dashboard' },
    { name: 'Team & User Settings', icon: <Users className="w-4 h-4" />, href: '/settings/users' },
    { name: 'Business Configuration', icon: <Settings className="w-4 h-4" />, href: '/settings/business' },
    { name: 'Roles & Permissions', icon: <Settings className="w-4 h-4" />, href: '/settings/roles' },
    {
      name: `Toggle ${theme === 'light' ? 'Dark' : 'Light'} Mode`,
      icon: theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />,
      action: toggleTheme,
    },
  ];

  const filtered = actions.filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase().trim())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/40 backdrop-blur-[2px]">
      <div className="w-full max-w-lg bg-background border border-border rounded-lg shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center px-3 border-b border-border bg-surface-secondary">
          <Search className="w-4 h-4 text-text-tertiary shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, navigate, or press Esc to close..."
            className="w-full h-10 px-3 text-xs bg-transparent text-text-primary focus:outline-none placeholder:text-text-tertiary"
          />
          <kbd className="text-[10px] bg-app-frame px-1.5 py-0.5 rounded border border-border text-text-tertiary font-mono">
            ESC
          </kbd>
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-text-tertiary">No matching commands</div>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setIsOpen(false);
                  if (item.action) item.action();
                  else if (item.href) router.push(item.href);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs text-text-primary hover:bg-surface-secondary hover:text-accent transition-colors text-left"
              >
                <span className="text-text-tertiary">{item.icon}</span>
                <span className="flex-1">{item.name}</span>
                <span className="text-[10px] text-text-tertiary font-mono">Navigate</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
