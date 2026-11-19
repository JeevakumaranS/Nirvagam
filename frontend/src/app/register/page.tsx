'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { Building2, Mail, Lock, User, CheckCircle2, ArrowRight } from 'lucide-react';
import { BusinessType, IndustryType } from '@nirvagam/shared';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    companyName: '',
    slug: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    gstin: '',
    pan: '',
    state: 'Tamil Nadu',
    stateCode: '33',
    businessType: BusinessType.PRIVATE_LIMITED,
    industry: IndustryType.RETAIL,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const handleCompanyNameChange = (val: string) => {
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    setFormData((prev) => ({ ...prev, companyName: val, slug }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName || !formData.email || !formData.password || !formData.firstName) {
      setError('Please fill in all mandatory fields.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await register(formData);
      toast({
        type: 'success',
        title: 'Organization created',
        message: 'Your business workspace is ready with default Chart of Accounts and GST rules.',
      });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-app-frame">
      <div className="w-full max-w-xl bg-background border border-border rounded-lg shadow-modal p-6 my-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-9 h-9 rounded bg-accent flex items-center justify-center text-white font-bold text-sm mb-2">
            N
          </div>
          <h1 className="text-lg font-semibold text-text-primary">Create your Business Workspace</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            14-day full feature trial • Includes double-entry accounting & GST engine
          </p>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Business / Legal Name *"
              value={formData.companyName}
              onChange={(e) => handleCompanyNameChange(e.target.value)}
              placeholder="e.g. Durozen Technologies"
              prefixIcon={<Building2 className="w-3.5 h-3.5" />}
              required
            />

            <Input
              label="Workspace URL Slug *"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="e.g. durozen"
              hint="nirvagam.app/workspace"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="Business Legal Structure"
              value={formData.businessType}
              onChange={(e) => setFormData({ ...formData, businessType: e.target.value as any })}
            >
              <option value={BusinessType.PROPRIETORSHIP}>Sole Proprietorship</option>
              <option value={BusinessType.PARTNERSHIP}>Partnership Firm</option>
              <option value={BusinessType.LLP}>Limited Liability Partnership (LLP)</option>
              <option value={BusinessType.PRIVATE_LIMITED}>Private Limited Company</option>
              <option value={BusinessType.PUBLIC_LIMITED}>Public Limited Company</option>
              <option value={BusinessType.INDIVIDUAL}>Individual / Freelancer</option>
            </Select>

            <Select
              label="Primary Industry"
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value as any })}
            >
              <option value={IndustryType.RETAIL}>Retail Shop</option>
              <option value={IndustryType.WHOLESALE}>Wholesale Trader</option>
              <option value={IndustryType.SUPERMARKET}>Supermarket</option>
              <option value={IndustryType.TEXTILE}>Textile & Apparel</option>
              <option value={IndustryType.GROCERY}>Grocery Store</option>
              <option value={IndustryType.MANUFACTURING}>Manufacturing</option>
              <option value={IndustryType.SERVICE}>IT & Service Provider</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="GSTIN (Optional for Non-GST)"
              value={formData.gstin}
              onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
              placeholder="e.g. 33AAAAA0000A1Z5"
            />

            <Input
              label="State & State Code"
              value={`${formData.state} (${formData.stateCode})`}
              readOnly
              hint="Default state: Tamil Nadu (33)"
            />
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-xs font-semibold text-text-primary mb-3">Administrator Account Details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="First Name *"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="Jeeva"
                prefixIcon={<User className="w-3.5 h-3.5" />}
                required
              />

              <Input
                label="Last Name"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Kumar"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <Input
                label="Work Email *"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="admin@durozen.com"
                prefixIcon={<Mail className="w-3.5 h-3.5" />}
                required
              />

              <Input
                label="Password *"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="At least 8 characters"
                prefixIcon={<Lock className="w-3.5 h-3.5" />}
                required
              />
            </div>
          </div>

          <Button type="submit" variant="primary" loading={loading} className="w-full mt-4">
            Initialize Business Workspace <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </form>

        <p className="text-center text-xs text-text-tertiary mt-5">
          Already registered?{' '}
          <Link href="/login" className="text-accent hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
