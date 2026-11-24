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
  ShieldCheck,
  Building2,
  Store,
  SlidersHorizontal,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export function Sidebar() {
  const pathname = usePathname();
  const { tenant, activeBusiness, user } = useAuth();

  const tenantNavGroups = [
    {
      title: 'COMMERCIAL',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Sales & Billing', href: '/sales', icon: Receipt },
        { label: 'POS Checkout', href: '/pos', icon: ShoppingCart },
        { label: 'Purchases & GRN', href: '/purchases', icon: Package },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        { label: 'Inventory & Stock', href: '/inventory', icon: Layers },
        { label: 'Customers & Vendors', href: '/partners', icon: Users2 },
        { label: 'Double-Entry Ledger', href: '/accounting', icon: BookOpen },
        { label: 'Reports & Analytics', href: '/reports', icon: PieChart },
      ],
    },
    {
      title: 'ORGANIZATION',
      items: [
        { label: 'Business Profile', href: '/settings/business', icon: Building2 },
        { label: 'Team Members', href: '/settings/users', icon: Users2 },
        { label: 'Roles & Access', href: '/settings/roles', icon: ShieldCheck },
        { label: 'Customization', href: '/settings/customization', icon: SlidersHorizontal },
      ],
    },
  ];
  // Platform superadmins have tenant ERP sections removed and manage platform portals.
  // Tenant admins (BUSINESS_OWNER, BUSINESS_ADMIN, etc.) and tenant users have ALL tenant ERP sections intact.
  const isPlatformSuperAdmin = Boolean(
    user?.platformAdmin ||
    user?.roles?.some((r) => r === 'SUPER_ADMIN' || r.startsWith('PLATFORM_'))
  );

  const platformNavGroups = [
    {
      title: 'PLATFORM MANAGEMENT',
      items: [
        {
          label: 'Business Registration',
          href: '/platform/business-registration',
          icon: Building2,
        },
        {
          label: 'System-Level Roles',
          href: '/platform/system-roles',
          icon: ShieldCheck,
        },
        {
          label: 'Platform Administrators',
          href: '/platform/administrators',
          icon: Users2,
        },
      ],
    },
  ];

  const navGroups = isPlatformSuperAdmin ? platformNavGroups : tenantNavGroups;

  return (
    <aside className="w-56 h-screen flex flex-col macos-vibrancy border-r border-border/80 shrink-0 select-none transition-colors duration-200">
      {/* App Header / Workspace Switcher */}
      <div className="h-12 px-3.5 flex items-center gap-2.5 border-b border-border/70">
        <div className="w-7 h-7 rounded-lg bg-accent text-white flex items-center justify-center font-bold text-xs shadow-sm">
          {isPlatformSuperAdmin ? 'P' : 'N'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-text-primary truncate tracking-[-0.01em]">
            {isPlatformSuperAdmin ? 'PLATFORM ADMIN' : (activeBusiness?.tradeName || tenant?.name || 'NIRVAGAM')}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-text-secondary truncate">
            {isPlatformSuperAdmin ? (
              <span className="truncate">SaaS Multi-Tenant Core</span>
            ) : (
              <>
                <Store className="w-3 h-3 shrink-0 stroke-[1.5]" />
                <span className="truncate">{activeBusiness?.branchName || 'Head Office'}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        {navGroups.map((group, idx) => (
          <div key={idx}>
            <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-text-secondary">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={clsx(
                      'flex items-center gap-2.5 px-2.5 h-8 rounded-lg text-[13px] transition-all duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)]',
                      isActive
                        ? 'bg-accent/12 text-accent font-medium shadow-none'
                        : 'text-text-primary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.99]'
                    )}
                  >
                    <Icon
                      className={clsx(
                        'w-4 h-4 shrink-0 stroke-[1.5] transition-colors',
                        isActive ? 'text-accent' : 'text-text-secondary'
                      )}
                    />
                    <span className="truncate tracking-[-0.01em]">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Workspace Footer Info */}
      <div className="p-3 border-t border-border/70 bg-surface-secondary/30">
        <div className="flex items-center justify-between text-[11px] text-text-secondary">
          <span className="font-mono tracking-tight">v1.0.0-PROD</span>
          <span className="flex items-center gap-1.5 text-text-primary font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-[11px] text-text-secondary">Online</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
