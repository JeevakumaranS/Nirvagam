'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { CommandPalette } from '../ui/command-palette';
import { useAuth } from '@/lib/auth-context';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, tenant, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isAuthPage = pathname === '/login' || pathname === '/register';
  // Only platform superadmins are locked to platform routes
  const isPlatformAdmin = Boolean(
    user?.platformAdmin ||
    user?.roles?.some((r) => r === 'SUPER_ADMIN' || r.startsWith('PLATFORM_'))
  );
  const platformHome = '/platform/business-registration';

  useEffect(() => {
    if (!loading && !user && !isAuthPage) {
      router.push('/login');
    }
    if (!loading && isPlatformAdmin && !pathname.startsWith('/platform')) {
      router.replace(platformHome);
    }
    if (!loading && user && !isPlatformAdmin && pathname.startsWith('/platform')) {
      router.replace('/dashboard');
    }
  }, [loading, user, tenant, isAuthPage, isPlatformAdmin, pathname, router]);

  if (isAuthPage) {
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
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6 page-transition">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
