'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { CommandPalette } from '../ui/command-palette';
import { useAuth } from '@/lib/auth-context';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, tenant, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isChangePasswordPage = pathname === '/change-password';
  // Only platform superadmins are locked to platform routes
  const isPlatformAdmin = Boolean(
    user?.platformAdmin ||
    user?.roles?.some((r) => r === 'SUPER_ADMIN' || r.startsWith('PLATFORM_'))
  );
  const platformHome = user?.roles?.some((role) => role === 'SUPER_ADMIN' || role === 'PLATFORM_SUPER_ADMIN')
    ? '/platform/dashboard'
    : user?.permissions?.includes('support_requests:view')
      ? '/platform/dashboard'
      : user?.permissions?.some((permission) => ['payments:view', 'subscriptions:view'].includes(permission))
        ? '/platform/finance'
        : '/platform/business-registration';
  const isPlatformSuperAdmin = Boolean(
    user?.roles?.some((role) => role === 'SUPER_ADMIN' || role === 'PLATFORM_SUPER_ADMIN')
  );
  const platformPathPermission: Record<string, string> = {
    '/platform/dashboard': 'platform_dashboard:view',
    '/platform/business-registration': 'platform_tenants:view',
    '/platform/support': 'support_requests:view',
    '/platform/subscriptions': 'subscriptions:view',
    '/platform/finance': 'payments:view',
    '/platform/audit-logs': 'activity_logs:view',
    '/platform/system-roles': 'platform_roles:view',
    '/platform/administrators': 'platform_users:manage',
  };

  useEffect(() => {
    if (!loading && !user && !isAuthPage) {
      router.push('/login');
    }
    if (!loading && user?.mustChangePassword && !isChangePasswordPage) {
      router.replace('/change-password');
    }
    if (!loading && user && !user.mustChangePassword && isChangePasswordPage) {
      router.replace('/dashboard');
    }
    if (!loading && isPlatformAdmin && !pathname.startsWith('/platform')) {
      router.replace(platformHome);
    }
    if (!loading && user && !isPlatformAdmin && pathname.startsWith('/platform')) {
      router.replace('/dashboard');
    }
    if (!loading && isPlatformAdmin && pathname.startsWith('/platform')) {
      const matched = Object.keys(platformPathPermission).find((path) => pathname === path || pathname.startsWith(`${path}/`));
      const permission = matched ? platformPathPermission[matched] : undefined;
      const superAdminOnly = matched === '/platform/system-roles' || matched === '/platform/administrators';
      const hasAccess = superAdminOnly
        ? isPlatformSuperAdmin
        : !permission || isPlatformSuperAdmin || user?.permissions?.includes(permission);
      if (!hasAccess) router.replace(platformHome);
    }
  }, [loading, user, tenant, isAuthPage, isChangePasswordPage, isPlatformAdmin, pathname, router, platformHome]);

  if (isAuthPage || isChangePasswordPage) {
    return <main className="min-h-screen bg-background">{children}</main>;
  }

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-accent animate-pulse" />
          <p className="text-[12px] text-text-tertiary font-mono tracking-tight">Initializing Nirvagam workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (isPlatformAdmin && !pathname.startsWith('/platform')) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 lg:p-6 page-transition">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
