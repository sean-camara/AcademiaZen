import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { useZenMock, apiFetchMock } = vi.hoisted(() => ({
  useZenMock: vi.fn(),
  apiFetchMock: vi.fn(),
}));

vi.mock('../../../context/ZenContext', () => ({
  useZen: useZenMock,
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'test-user-123', email: 'test@example.com' },
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock('../../../utils/api', () => ({
  apiFetch: apiFetchMock,
}));

import Settings from '../../../pages/Settings';

const createZenContext = (profileOverrides = {}, settingsOverrides = {}) => ({
  state: {
    profile: { firstName: 'Sean', lastName: 'Camara', university: 'ADMU', ...profileOverrides },
    settings: { focusDuration: 25, breakDuration: 5, ...settingsOverrides },
    subjects: [],
    schedule: [],
  },
  updateProfile: vi.fn(),
  updateSettings: vi.fn(),
  deleteAccountData: vi.fn(),
});

describe('Settings Modal & Billing Tab', () => {
  beforeEach(() => {
    useZenMock.mockReset();
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((path: string) => {
      if (path === '/api/billing/status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ billing: { effectivePlan: 'free', status: 'free' }, aiUsage: null }),
        });
      }
      if (path === '/api/billing/plans') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ plans: {} }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it('renders control center header and all settings tabs', () => {
    useZenMock.mockReturnValue(createZenContext());
    render(<Settings isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Focus/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Alerts/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Plans/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Me/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Data/i })).toBeInTheDocument();
  });

  it('displays correct Premium pricing in Plans tab (PHP 149/mo)', async () => {
    useZenMock.mockReturnValue(createZenContext());
    const user = userEvent.setup();
    render(<Settings isOpen={true} onClose={vi.fn()} initialTab="billing" />);

    expect(screen.getByText(/PHP 149/i)).toBeInTheDocument();

    // Toggle to Weekly plan
    const wkButton = screen.getByRole('button', { name: 'Wk' });
    await user.click(wkButton);

    expect(screen.getByText(/PHP 49/i)).toBeInTheDocument();
  });
});
