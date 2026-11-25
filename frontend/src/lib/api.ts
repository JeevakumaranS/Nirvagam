const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
}

export async function apiFetch<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  let url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('nirvagam_access_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      cache: options.cache ?? 'no-store',
      headers,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      // Handle 401 Unauthorized
      if (res.status === 401 && typeof window !== 'undefined' && !endpoint.includes('/auth/login')) {
        localStorage.removeItem('nirvagam_access_token');
        localStorage.removeItem('nirvagam_refresh_token');
        window.location.href = '/login';
      }
      const errorMsg = data?.message || data?.errors?.[0] || `Request failed with status ${res.status}`;
      throw new Error(errorMsg);
    }

    // Keep paginated envelopes intact so callers can access both data and meta.
    if (data?.meta !== undefined && data?.data !== undefined) {
      return data;
    }

    // Unpack non-paginated ApiResponse envelopes.
    return data?.data !== undefined ? data.data : data;
  } catch (err: any) {
    throw new Error(err.message || 'Network error occurred');
  }
}
