import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'admin-1', email: 'admin123@admin.com' },
    role: 'admin',
    signOut: vi.fn(),
  }),
}));

vi.mock('../../../utils/api', () => ({
  apiFetch: vi.fn().mockImplementation((path: string) => {
    if (path === '/api/admin/overview') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            totalUsers: 142,
            activeUsersToday: 38,
            premiumUsers: 19,
            freeUsers: 123,
            promptsToday: 240,
            promptsMonth: 4800,
            totalFocusMinutes: 12500,
            totalFocusSessions: 450,
            estimatedMRR: 2831,
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }),
}));

import Admin from '../../../pages/Admin';

describe('Admin Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders control center title and overview statistics tab', async () => {
    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /AcademiaZen/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('142')).toBeInTheDocument(); // Total users
      expect(screen.getByText('₱2,831')).toBeInTheDocument(); // Estimated MRR
    });
  });
});
