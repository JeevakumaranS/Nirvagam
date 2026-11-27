const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface RequestOptions extends RequestInit { params?: Record<string, any>; }
export interface DownloadedFile { blob: Blob; fileName: string; contentType: string; }
let refreshPromise: Promise<string | null> | null = null;

function makeUrl(endpoint: string, params?: Record<string, any>) {
  let url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  if (params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') query.append(key, String(value)); });
    const encoded = query.toString();
    if (encoded) url += (url.includes('?') ? '&' : '?') + encoded;
  }
  return url;
}

function accessToken() { return typeof window !== 'undefined' ? localStorage.getItem('nirvagam_access_token') : null; }

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (refreshPromise) return refreshPromise;
  const refreshToken = localStorage.getItem('nirvagam_refresh_token');
  if (!refreshToken) return null;
  refreshPromise = fetch(`${API_BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }), cache: 'no-store' })
    .then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!response.ok) return null;
      const data = payload?.data ?? payload;
      if (!data?.accessToken) return null;
      localStorage.setItem('nirvagam_access_token', data.accessToken);
      if (data.refreshToken) localStorage.setItem('nirvagam_refresh_token', data.refreshToken);
      return data.accessToken;
    }).catch(() => null).finally(() => { refreshPromise = null; });
  return refreshPromise;
}

function expireSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('nirvagam_access_token');
  localStorage.removeItem('nirvagam_refresh_token');
  window.location.href = '/login';
}

function headersFor(options: RequestOptions, token: string | null) {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

async function request(endpoint: string, options: RequestOptions, retry = true) {
  const response = await fetch(makeUrl(endpoint, options.params), { ...options, cache: options.cache ?? 'no-store', headers: headersFor(options, accessToken()) });
  if (response.status === 401 && retry && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    const token = await refreshAccessToken();
    if (token) return request(endpoint, options, false);
    expireSession();
  }
  return response;
}

async function errorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  return payload?.message || payload?.errors?.[0] || `Request failed with status ${response.status}`;
}

export async function apiFetch<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  try {
    const response = await request(endpoint, options);
    if (!response.ok) throw new Error(await errorMessage(response));
    const data = await response.json().catch(() => null);
    if (data?.meta !== undefined && data?.data !== undefined) return data;
    return data?.data !== undefined ? data.data : data;
  } catch (error: any) { throw new Error(error?.message || 'Network error occurred'); }
}

function dispositionFileName(value: string | null, fallback: string) {
  const encoded = value?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) return decodeURIComponent(encoded.replace(/^"|"$/g, ''));
  return value?.match(/filename="?([^";]+)"?/i)?.[1] || fallback;
}

export async function apiDownload(endpoint: string, options: RequestOptions = {}, fallbackFileName = 'download'): Promise<DownloadedFile> {
  try {
    const response = await request(endpoint, options);
    if (!response.ok) throw new Error(await errorMessage(response));
    const blob = await response.blob();
    return { blob, fileName: dispositionFileName(response.headers.get('Content-Disposition'), fallbackFileName), contentType: response.headers.get('Content-Type') || blob.type || 'application/octet-stream' };
  } catch (error: any) { throw new Error(error?.message || 'Download failed'); }
}

export function saveDownloadedFile(file: DownloadedFile) {
  const url = URL.createObjectURL(file.blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = file.fileName; anchor.style.display = 'none';
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}
