'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { LockKeyhole } from 'lucide-react';

export default function ChangePasswordPage() {
  const { user, login } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ type: 'warning', title: 'Passwords do not match', message: 'Enter the same new password twice.' });
      return;
    }

    try {
      setSaving(true);
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: user?.mustChangePassword ? undefined : currentPassword,
          newPassword,
        }),
      });
      if (user) {
        await login({ email: user.email, password: newPassword });
      }
      toast({ type: 'success', title: 'Password changed', message: 'Your new password is ready to use.' });
      router.replace('/dashboard');
    } catch (error: any) {
      toast({ type: 'error', title: 'Could not change password', message: error.message || 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-app-frame p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-background p-6 shadow-modal">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-white">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold text-text-primary">Change your password</h1>
          <p className="mt-1 text-xs text-text-secondary">
            {user?.mustChangePassword
              ? 'Set a new password before continuing to your workspace.'
              : 'Choose a new password for your account.'}
          </p>
        </div>

        {!user?.mustChangePassword && (
          <Input
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            required
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        )}
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        <Button type="submit" variant="primary" loading={saving} className="w-full">
          Save new password
        </Button>
      </form>
    </main>
  );
}
