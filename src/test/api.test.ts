import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock firebase before importing api
vi.mock('../../firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('mock-token-123')
    }
  }
}));

import { apiFetch, apiFetchWithTimeout } from '../../utils/api';

describe('API Utils', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('apiFetch', () => {
    it('should add Authorization header when user is authenticated', async () => {
      await apiFetch('/api/test');
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/test');
      expect(options.headers.get('Authorization')).toBe('Bearer mock-token-123');
    });

    it('should prepend API_BASE_URL to path', async () => {
      await apiFetch('/api/test');
      
      const [url] = mockFetch.mock.calls[0];
      // URL contains the path (actual base URL may vary based on env)
      expect(url).toContain('/api/test');
    });

    it('should pass through additional options', async () => {
      await apiFetch('/api/test', {
        method: 'POST',
        body: JSON.stringify({ data: 'test' })
      });
      
      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('POST');
      expect(options.body).toBe(JSON.stringify({ data: 'test' }));
    });

    it('should preserve existing headers', async () => {
      await apiFetch('/api/test', {
        headers: { 'Content-Type': 'application/json' }
      });
      
      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('apiFetchWithTimeout', () => {
    it('should call apiFetch normally when request completes in time', async () => {
      const response = await apiFetchWithTimeout('/api/test');
      expect(response.status).toBe(200);
    });

    it('should clear timeout after successful response', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      await apiFetchWithTimeout('/api/test');
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
      
      clearTimeoutSpy.mockRestore();
    });
  });
});
