import { auth } from '../firebase';

const configuredApiBaseUrl = (import.meta as any).env?.VITE_API_URL || '';

export function resolveApiBaseUrl(configuredBaseUrl: string, hostname: string): string {
  const normalizedHostname = hostname.toLowerCase();
  if (normalizedHostname === 'localhost' || normalizedHostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  if (normalizedHostname === 'academiazen.app' || normalizedHostname === 'www.academiazen.app') {
    return '';
  }

  return configuredBaseUrl || 'http://localhost:3001';
}

const API_BASE_URL = resolveApiBaseUrl(
  configuredApiBaseUrl,
  typeof window === 'undefined' ? '' : window.location.hostname,
);

let _requestCounter = 0;

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = 2,
  delay: number = 500,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Don't retry on client errors (4xx) — these are intentional
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // Server error (5xx) — retry if we have attempts left
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delay * Math.pow(2, attempt)));
        continue;
      }

      return response;
    } catch (err) {
      // Network error — retry if we have attempts left
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delay * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }

  // Fallback (shouldn't reach here)
  return fetch(url, options);
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);

  // Attach correlation ID for request tracing across frontend ↔ backend
  headers.set('X-Request-ID', `fe-${Date.now()}-${++_requestCounter}`);

  const response = await fetchWithRetry(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // Global 401 interceptor: if token was revoked or expired, redirect to login
  if (response.status === 401 && auth.currentUser) {
    try {
      // Force refresh the token — if it fails, the user's session is truly expired
      await auth.currentUser.getIdToken(true);
    } catch {
      // Token refresh failed — sign out and redirect
      await auth.signOut();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  }

  return response;
}

export async function apiFetchWithTimeout(
  path: string,
  options: RequestInit = {},
  timeoutMs: number = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await apiFetch(path, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
