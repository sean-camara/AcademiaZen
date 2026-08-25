import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export const CHUNK_RECOVERY_QUERY = 'az-chunk-recovery';

const CHUNK_RECOVERY_STORAGE_KEY = 'academiazen:chunk-recovery-at';
const CHUNK_RECOVERY_COOLDOWN_MS = 30_000;
const SERVICE_WORKER_UPDATE_TIMEOUT_MS = 1_500;

const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /chunkloaderror/i,
  /loading chunk [\w-]+ failed/i,
  /unable to preload css/i,
];

let reloadScheduled = false;

const errorText = (error: unknown): string => {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return typeof error === 'string' ? error : '';
};

export const isChunkLoadError = (error: unknown): boolean =>
  CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(errorText(error)));

export const shouldAttemptChunkRecovery = (
  error: unknown,
  lastAttempt: string | null,
  now = Date.now(),
): boolean => {
  if (!isChunkLoadError(error)) return false;

  const lastAttemptAt = Number(lastAttempt);
  const elapsed = now - lastAttemptAt;
  return !lastAttempt || !Number.isFinite(lastAttemptAt) || elapsed < 0 || elapsed >= CHUNK_RECOVERY_COOLDOWN_MS;
};

const requestLatestApp = (error: unknown): boolean => {
  if (typeof window === 'undefined' || reloadScheduled) return false;

  let lastAttempt: string | null = null;
  try {
    lastAttempt = window.sessionStorage.getItem(CHUNK_RECOVERY_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }

  if (!shouldAttemptChunkRecovery(error, lastAttempt)) return false;

  reloadScheduled = true;
  try {
    window.sessionStorage.setItem(CHUNK_RECOVERY_STORAGE_KEY, String(Date.now()));
  } catch {
    // The in-memory guard still prevents duplicate reloads in this document.
  }

  const recoveryUrl = new URL(window.location.href);
  recoveryUrl.searchParams.set(CHUNK_RECOVERY_QUERY, String(Date.now()));

  let navigationStarted = false;
  const navigateOnce = (): void => {
    if (navigationStarted) return;
    navigationStarted = true;
    window.location.replace(recoveryUrl.toString());
  };

  const timeoutId = window.setTimeout(navigateOnce, SERVICE_WORKER_UPDATE_TIMEOUT_MS);
  const serviceWorker = navigator.serviceWorker;

  if (serviceWorker && typeof serviceWorker.getRegistration === 'function') {
    void serviceWorker
      .getRegistration()
      .then((registration) => registration?.update())
      .catch(() => undefined)
      .finally(() => {
        window.clearTimeout(timeoutId);
        navigateOnce();
      });
  } else {
    window.clearTimeout(timeoutId);
    queueMicrotask(navigateOnce);
  }

  return true;
};

export const lazyWithChunkRecovery = <T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
): LazyExoticComponent<T> =>
  lazy(async () => {
    try {
      return await importer();
    } catch (error) {
      if (requestLatestApp(error)) {
        // Keep Suspense mounted while the browser navigates to the current build.
        return await new Promise<never>(() => undefined);
      }
      throw error;
    }
  });

export const installChunkRecovery = (): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;

  const handlePreloadError = (event: Event): void => {
    const preloadEvent = event as Event & { payload?: unknown };
    const error = preloadEvent.payload ?? new Error('Failed to fetch dynamically imported module');
    if (requestLatestApp(error)) event.preventDefault();
  };

  window.addEventListener('vite:preloadError', handlePreloadError);

  const cleanupTimer = window.setTimeout(() => {
    try {
      window.sessionStorage.removeItem(CHUNK_RECOVERY_STORAGE_KEY);
    } catch {
      // Nothing to clean up when storage is unavailable.
    }

    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has(CHUNK_RECOVERY_QUERY)) {
      currentUrl.searchParams.delete(CHUNK_RECOVERY_QUERY);
      window.history.replaceState(window.history.state, '', currentUrl.toString());
    }
  }, CHUNK_RECOVERY_COOLDOWN_MS);

  return () => {
    window.removeEventListener('vite:preloadError', handlePreloadError);
    window.clearTimeout(cleanupTimer);
  };
};
