import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

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
    render(<Admin />);

    expect(screen.getByRole('heading', { name: /AcademiaZen Control Center/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('142')).toBeInTheDocument(); // Total users
      expect(screen.getByText('PHP 2,831')).toBeInTheDocument(); // Estimated MRR
    });
  });
});
