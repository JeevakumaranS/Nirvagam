'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  LayoutDashboard,
  Receipt,
  ShoppingCart,
  Package,
  Layers,
  Users2,
  BookOpen,
  PieChart,
  Users,
  Settings,
  Moon,
  Sun,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
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

  const actions = [
    { name: 'Dashboard Overview', icon: LayoutDashboard, href: '/dashboard', section: 'Commercial' },
    { name: 'Sales & Billing (GST Invoices)', icon: Receipt, href: '/sales', section: 'Commercial' },
    { name: 'POS Fast Billing Counter', icon: ShoppingCart, href: '/pos', section: 'Commercial' },
    { name: 'Purchases & Goods Receipts (GRN)', icon: Package, href: '/purchases', section: 'Commercial' },
    { name: 'Inventory & Stock Catalog', icon: Layers, href: '/inventory', section: 'Operations' },
    { name: 'Customers & Vendors Directory', icon: Users2, href: '/partners', section: 'Operations' },
    { name: 'Double-Entry Accounting & Ledger', icon: BookOpen, href: '/accounting', section: 'Operations' },
    { name: 'Financial Statements & GST Reports', icon: PieChart, href: '/reports', section: 'Operations' },
    { name: 'Business Organization Profile', icon: Building2, href: '/settings/business', section: 'Organization' },
    { name: 'Team Members & Staff Access', icon: Users, href: '/settings/users', section: 'Organization' },
    { name: 'Roles & Permission Matrix', icon: ShieldCheck, href: '/settings/roles', section: 'Organization' },
    {
      name: `Switch to ${theme === 'light' ? 'Dark' : 'Light'} Appearance`,
      icon: theme === 'light' ? Moon : Sun,
      action: toggleTheme,
      section: 'Preferences',
    },
  ];

  const filtered = actions.filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase().trim())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
      return;
    }

    const handleNavigation = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        const item = filtered[selectedIndex];
        setIsOpen(false);
        if (item.action) item.action();
        else if (item.href) router.push(item.href);
      }
    };

    window.addEventListener('keydown', handleNavigation);
    return () => window.removeEventListener('keydown', handleNavigation);
  }, [isOpen, filtered, selectedIndex, router]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4 bg-black/35 backdrop-blur-md animate-in fade-in duration-150"
      onClick={() => setIsOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-surface border border-border/80 rounded-[14px] shadow-modal overflow-hidden animate-in zoom-in-[0.98] duration-150"
      >
        {/* Spotlight Input */}
        <div className="flex items-center px-4 py-3 border-b border-border/60 bg-surface">
          <Search className="w-4 h-4 text-text-tertiary shrink-0 mr-3 stroke-[1.5]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or jump to page..."
            className="w-full h-8 bg-transparent text-[13px] text-text-primary focus:outline-none placeholder:text-text-tertiary tracking-[-0.01em]"
          />
          <kbd className="text-[10px] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded border border-border/60 text-text-tertiary font-mono tracking-tight">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-text-tertiary">
              No matching actions found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={idx}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => {
                    setIsOpen(false);
                    if (item.action) item.action();
                    else if (item.href) router.push(item.href);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors text-left ${
                    isSelected
                      ? 'bg-accent/12 text-accent font-medium'
                      : 'text-text-primary hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 stroke-[1.5] ${
                      isSelected ? 'text-accent' : 'text-text-tertiary'
                    }`}
                  />
                  <span className="flex-1 truncate tracking-[-0.01em]">{item.name}</span>
                  <span className="text-[11px] text-text-tertiary font-mono tracking-tight">
                    {item.section}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/50 bg-surface-secondary/40 text-[11px] text-text-tertiary">
          <span>Navigate with <kbd className="font-mono">↑</kbd> <kbd className="font-mono">↓</kbd></span>
          <span>Open with <kbd className="font-mono">↵</kbd></span>
        </div>
      </div>
    </div>
  );
}
