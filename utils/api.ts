import { auth } from '../firebase';

const configuredApiBaseUrl = (import.meta as any).env?.VITE_API_URL || '';

export function resolveApiBaseUrl(configuredBaseUrl: string, hostname: string): string {
  const normalizedHostname = hostname.toLowerCase();
  if (normalizedHostname === 'academiazen.app' || normalizedHostname === 'www.academiazen.app') {
    return '';
  }

  return configuredBaseUrl || 'http://localhost:3001';
}

const API_BASE_URL = resolveApiBaseUrl(
  configuredApiBaseUrl,
  typeof window === 'undefined' ? '' : window.location.hostname,
);

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
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
