'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
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
  ScrollText,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

type SidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
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
  const isPlatformAdmin = Boolean(
    user?.platformAdmin ||
      user?.roles?.some((role) => role === 'SUPER_ADMIN' || role.startsWith('PLATFORM_'))
  );
  const isSuperAdmin = Boolean(
    user?.roles?.some((role) => role === 'SUPER_ADMIN' || role === 'PLATFORM_SUPER_ADMIN')
  );
  const can = (permission: string) =>
    isSuperAdmin || user?.permissions?.includes(permission);
  const platformNavGroups = [
    {
      title: 'PLATFORM MANAGEMENT',
      items: [
        { label: 'Dashboard', href: '/platform/dashboard', icon: LayoutDashboard, permission: 'platform_dashboard:view' },
        { label: 'Business Registration', href: '/platform/business-registration', icon: Building2, permission: 'platform_tenants:view' },
        { label: 'Support Requests', href: '/platform/support', icon: Users2, permission: 'support_requests:view' },
        { label: 'Subscriptions', href: '/platform/subscriptions', icon: Receipt, permission: 'subscriptions:view' },
        { label: 'Payments & Revenue', href: '/platform/finance', icon: CreditCard, permission: 'payments:view' },
        { label: 'Activity Logs', href: '/platform/audit-logs', icon: ScrollText, permission: 'activity_logs:view' },
        ...(isSuperAdmin ? [
          { label: 'System-Level Roles', href: '/platform/system-roles', icon: ShieldCheck, permission: 'platform_roles:view' },
          { label: 'Platform Administrators', href: '/platform/administrators', icon: Users2, permission: 'platform_users:manage' },
        ] : []),
      ],
    },
  ];
  const navGroups = isPlatformAdmin ? platformNavGroups : tenantNavGroups;

  const content = (
    <>
      <div className="h-12 px-3.5 flex items-center gap-2.5 border-b border-border/70 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-accent text-white flex items-center justify-center font-bold text-xs shadow-sm">
          {isPlatformAdmin ? 'P' : 'N'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-text-primary truncate tracking-[-0.01em]">
            {isPlatformAdmin
              ? 'PLATFORM ADMIN'
              : activeBusiness?.tradeName || tenant?.name || 'NIRVAGAM'}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-text-secondary truncate">
            {isPlatformAdmin ? (
              <span className="truncate">SaaS Multi-Tenant Core</span>
            ) : (
              <>
                <Store className="w-3 h-3 shrink-0 stroke-[1.5]" />
                <span className="truncate">{activeBusiness?.branchName || 'No branch selected'}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        {navGroups.map((group) => (
          <div key={group.title}>
            <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-text-secondary">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {group.items.filter((item: any) => !item.permission || can(item.permission)).map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onMobileClose}
                    className={clsx(
                      'flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-[13px] transition-all duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)]',
                      isActive
                        ? 'bg-accent/12 text-accent font-medium shadow-none'
                        : 'text-text-primary hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.99]'
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

      <div className="p-3 border-t border-border/70 bg-surface-secondary/30 shrink-0">
        <div className="flex items-center justify-between text-[11px] text-text-secondary">
          <span className="font-mono tracking-tight">v1.0.0-PROD</span>
          <span className="flex items-center gap-1.5 text-text-primary font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-[11px] text-text-secondary">Online</span>
          </span>
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden lg:flex w-56 h-screen flex-col macos-vibrancy border-r border-border/80 shrink-0 select-none transition-colors duration-200">
        {content}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onMobileClose}
            className="absolute inset-0 bg-black/40"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col macos-vibrancy border-r border-border/80 shadow-2xl select-none">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
