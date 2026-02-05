import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Firebase
vi.mock('../firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn(),
  },
  googleProvider: {},
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: MockResizeObserver,
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock Audio
window.HTMLMediaElement.prototype.play = vi.fn();
window.HTMLMediaElement.prototype.pause = vi.fn();
window.HTMLMediaElement.prototype.load = vi.fn();

// Mock Notification API
Object.defineProperty(window, 'Notification', {
  value: {
    permission: 'default',
    requestPermission: vi.fn().mockResolvedValue('granted'),
  },
});

// Mock Service Worker
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    ready: Promise.resolve({
      pushManager: {
        subscribe: vi.fn(),
        getSubscription: vi.fn().mockResolvedValue(null),
      },
    }),
    register: vi.fn().mockResolvedValue({}),
  },
});
