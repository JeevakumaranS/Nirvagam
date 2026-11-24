'use client';

import Link from 'next/link';
import { Building2 } from 'lucide-react';

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-app-frame">
      <section className="w-full max-w-md rounded-lg border border-border bg-background p-6 text-center shadow-modal">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded bg-accent text-white">
          <Building2 className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-semibold text-text-primary">Business registration</h1>
        <p className="mt-2 text-sm text-text-secondary">
          New workspaces are created by a platform administrator. Contact your administrator to register
          your business and receive owner sign-in credentials.
        </p>
        <Link href="/login" className="mt-5 inline-block text-sm font-medium text-accent hover:underline">
          Return to sign in
        </Link>
      </section>
    </main>
  );
}
