'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { Lock, Mail, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const authData = await login({ email, password });
      toast({ type: 'success', title: 'Welcome back', message: 'Successfully authenticated' });
      const isPlatform =
        Boolean(authData?.user?.platformAdmin) ||
        Boolean(authData?.user?.roles?.some((r: string) => r === 'SUPER_ADMIN' || r.startsWith('PLATFORM_')));

      if (isPlatform) {
        router.push('/platform/business-registration');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const fillTenantAdminCredentials = () => {
    setEmail('admin@nirvagam.com');
    setPassword('Password@123');
    setError(null);
  };

  const fillSuperAdminCredentials = () => {
    setEmail('superadmin@nirvagam.com');
    setPassword('Password@123');
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-app-frame">
      <div className="w-full max-w-sm bg-background border border-border rounded-lg shadow-modal p-6">
        {/* App Title Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-9 h-9 rounded bg-accent flex items-center justify-center text-white font-bold text-sm mb-3 shadow-subtle">
            N
          </div>
          <h1 className="text-lg font-semibold text-text-primary">Sign in to Nirvagam</h1>
          <p className="text-xs text-text-secondary mt-1">Universal Business Billing & Accounting Platform</p>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            prefixIcon={<Mail className="w-3.5 h-3.5" />}
            autoFocus
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            prefixIcon={<Lock className="w-3.5 h-3.5" />}
          />

          <Button type="submit" variant="primary" loading={loading} className="w-full mt-2">
            Sign In <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </form>

        {/* 1-Click Demo Login Helpers */}
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wider text-center">Quick Demo Credentials</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={fillTenantAdminCredentials}
              className="w-full text-xs"
              icon={<Sparkles className="w-3.5 h-3.5 text-accent" />}
            >
              Tenant Admin
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={fillSuperAdminCredentials}
              className="w-full text-xs"
              icon={<ShieldCheck className="w-3.5 h-3.5 text-accent" />}
            >
              Super Admin
            </Button>
          </div>
        </div>

        {/* Footer Link */}
        <p className="text-center text-xs text-text-tertiary mt-5">
          New business?{' '}
          <Link href="/register" className="text-accent hover:underline font-medium">
            Register workspace
          </Link>
        </p>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-text-tertiary mt-4">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Enterprise RBAC & Double-Entry Accounting Core</span>
      </div>
    </div>
  );
}
