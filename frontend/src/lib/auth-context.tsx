'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from './api';

export interface UserSession {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  platformAdmin?: boolean;
}

export interface TenantSession {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface ActiveBusinessSession {
  id: string;
  legalName: string;
  tradeName: string;
  branchId: string;
  branchName: string;
}

interface AuthContextType {
  user: UserSession | null;
  tenant: TenantSession | null;
  activeBusiness: ActiveBusinessSession | null;
  token: string | null;
  loading: boolean;
  theme: 'light' | 'dark';
  login: (credentials: any) => Promise<any>;
  register: (payload: any) => Promise<void>;
  logout: () => void;
  toggleTheme: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [tenant, setTenant] = useState<TenantSession | null>(null);
  const [activeBusiness, setActiveBusiness] = useState<ActiveBusinessSession | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Check saved theme
    const savedTheme = localStorage.getItem('nirvagam_theme') as 'light' | 'dark' | null;
    const initialTheme = savedTheme || 'light';
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);

    // Check token and initialize profile
    const storedToken = localStorage.getItem('nirvagam_access_token');
    if (storedToken) {
      setToken(storedToken);
      apiFetch('/auth/me')
        .then((profile) => {
          if (profile) {
            setUser({
              id: profile.id,
              email: profile.email,
              firstName: profile.firstName,
              lastName: profile.lastName,
              roles: profile.userRoles?.map((ur: any) => ur.role?.name || ur.role || ur) || [],
              permissions: [],
              platformAdmin: Boolean(profile.platformAdmin),
            });
            setTenant(profile.tenant || null);
            if (profile.branchAssignments?.[0]?.branch) {
              const b = profile.branchAssignments[0].branch;
              setActiveBusiness({
                id: b.business.id,
                legalName: b.business.legalName,
                tradeName: b.business.tradeName,
                branchId: b.id,
                branchName: b.name,
              });
            } else {
              setActiveBusiness(null);
            }
          }
        })
        .catch(() => {
          localStorage.removeItem('nirvagam_access_token');
          localStorage.removeItem('nirvagam_refresh_token');
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('nirvagam_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const login = async (credentials: any) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    localStorage.setItem('nirvagam_access_token', data.accessToken);
    localStorage.setItem('nirvagam_refresh_token', data.refreshToken);
    setToken(data.accessToken);
    setUser(data.user);
    setTenant(data.tenant);
    setActiveBusiness(data.activeBusiness);
    return data;
  };

  const register = async (payload: any) => {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    localStorage.setItem('nirvagam_access_token', data.accessToken);
    localStorage.setItem('nirvagam_refresh_token', data.refreshToken);
    setToken(data.accessToken);
    setUser({
      ...data.user,
      roles: ['BUSINESS_OWNER'],
      permissions: ['*:*'],
    });
    setTenant(data.tenant);
    setActiveBusiness({
      id: data.business.id,
      legalName: data.business.legalName,
      tradeName: data.business.legalName,
      branchId: data.branch.id,
      branchName: data.branch.name,
    });
  };

  const logout = () => {
    localStorage.removeItem('nirvagam_access_token');
    localStorage.removeItem('nirvagam_refresh_token');
    setToken(null);
    setUser(null);
    setTenant(null);
    setActiveBusiness(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        activeBusiness,
        token,
        loading,
        theme,
        login,
        register,
        logout,
        toggleTheme,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
