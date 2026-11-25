'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [workspaceSelectionRequired, setWorkspaceSelectionRequired] = useState(false);
  const [workspaces, setWorkspaces] = useState<Array<{ slug: string; displayName: string }>>([]);
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
      const authData = await login({
        email,
        password,
        tenantSlug: workspaceSelectionRequired ? tenantSlug : undefined,
      });
      if (authData.workspaceSelectionRequired) {
        setWorkspaces(authData.workspaces || []);
        setWorkspaceSelectionRequired(true);
        return;
      }
      if (authData.user?.mustChangePassword) {
        router.push('/change-password');
        return;
      }
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

        {workspaceSelectionRequired && (
          <p className="mb-4 rounded border border-accent/20 bg-accent/5 p-2.5 text-xs text-text-secondary">
            These credentials match more than one workspace. Select the workspace you want to open.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
              setWorkspaceSelectionRequired(false);
              setWorkspaces([]);
              setTenantSlug('');
            }}
            placeholder="name@company.com"
            prefixIcon={<Mail className="w-3.5 h-3.5" />}
            autoFocus
          />

          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
              setWorkspaceSelectionRequired(false);
              setWorkspaces([]);
              setTenantSlug('');
            }}
            placeholder="Enter your Nirvagam account password"
            prefixIcon={<Lock className="w-3.5 h-3.5" />}
          />

          {workspaceSelectionRequired && (
            <Select
              label="Workspace"
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value)}
              required
              options={[
                { value: '', label: 'Choose a workspace' },
                ...workspaces.map((workspace) => ({
                  value: workspace.slug,
                  label: `${workspace.displayName} (${workspace.slug})`,
                })),
              ]}
            />
          )}

          <Button type="submit" variant="primary" loading={loading} className="w-full mt-2">
            {workspaceSelectionRequired ? 'Continue' : 'Sign In'} <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </form>

        <p className="text-center text-xs text-text-tertiary mt-5">
          New workspaces are created by a platform administrator.
        </p>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-text-tertiary mt-4">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Enterprise RBAC & Double-Entry Accounting Core</span>
      </div>
    </div>
  );
}
