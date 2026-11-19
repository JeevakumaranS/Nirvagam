'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Receipt,
  ShoppingCart,
  Package,
  Layers,
  Users2,
  BookOpen,
  PieChart,
  Settings,
  ShieldCheck,
  Building2,
  Store,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export function Sidebar() {
  const pathname = usePathname();
  const { tenant, activeBusiness } = useAuth();

  const navGroups = [
    {
      title: 'COMMERCIAL',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Sales & Billing', href: '/dashboard', icon: Receipt },
        { label: 'POS Checkout', href: '/dashboard', icon: ShoppingCart },
        { label: 'Purchases & GRN', href: '/dashboard', icon: Package },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        { label: 'Inventory & Stock', href: '/dashboard', icon: Layers },
        { label: 'Customers & Vendors', href: '/dashboard', icon: Users2 },
        { label: 'Double-Entry Ledger', href: '/dashboard', icon: BookOpen },
        { label: 'Reports & Analytics', href: '/dashboard', icon: PieChart },
      ],
    },
    {
      title: 'ORGANIZATION',
      items: [
        { label: 'Business Profile', href: '/settings/business', icon: Building2 },
        { label: 'Team Members', href: '/settings/users', icon: Users2 },
        { label: 'Roles & Access', href: '/settings/roles', icon: ShieldCheck },
      ],
    },
  ];

  return (
    <aside className="w-56 h-screen flex flex-col bg-app-frame border-r border-border shrink-0 select-none">
      {/* App Header / Workspace Switcher */}
      <div className="h-12 px-3 flex items-center gap-2 border-b border-border">
        <div className="w-6 h-6 rounded bg-accent flex items-center justify-center text-white font-bold text-xs">
          N
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-text-primary truncate">
            {activeBusiness?.tradeName || tenant?.name || 'NIRVAGAM'}
          </p>
          <div className="flex items-center gap-1 text-[10px] text-text-tertiary">
            <Store className="w-3 h-3" />
            <span className="truncate">{activeBusiness?.branchName || 'Head Office'}</span>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {navGroups.map((group, idx) => (
          <div key={idx}>
            <div className="px-2 pb-1.5 text-[10px] font-semibold tracking-wider text-text-tertiary">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={clsx(
                      'flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-colors',
                      isActive
                        ? 'bg-background text-accent font-medium shadow-subtle border border-border/80'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary'
                    )}
                  >
                    <Icon className={clsx('w-3.5 h-3.5', isActive ? 'text-accent' : 'text-text-tertiary')} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Workspace Footer Info */}
      <div className="p-3 border-t border-border bg-surface-secondary/40">
        <div className="flex items-center justify-between text-[11px] text-text-tertiary">
          <span className="font-mono">v1.0.0-PROD</span>
          <span className="flex items-center gap-1 text-emerald-500 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online
          </span>
        </div>
      </div>
    </aside>
  );
}
