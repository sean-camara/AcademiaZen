import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn() }));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'admin-1', email: 'admin123@admin.com' },
    role: 'admin',
    signOut: signOutMock,
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

  it('requires explicit confirmation before signing out', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );

    await user.click(screen.getAllByRole('button', { name: 'Sign Out' })[0]!);

    expect(signOutMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Sign out of AcademiaZen?' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Sign out of AcademiaZen?' })).not.toBeInTheDocument();
    expect(signOutMock).not.toHaveBeenCalled();

    await user.click(screen.getAllByRole('button', { name: 'Sign Out' })[0]!);
    await user.click(screen.getByRole('button', { name: /^Sign out$/ }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
  });
});
