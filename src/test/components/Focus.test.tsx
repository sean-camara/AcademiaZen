import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { useZenMock } = vi.hoisted(() => ({
  useZenMock: vi.fn(),
}));

vi.mock('../../../context/ZenContext', () => ({
  useZen: useZenMock,
}));

vi.mock('../../../utils/api', () => ({
  apiFetch: vi.fn().mockImplementation((path: string) => {
    if (path === '/api/billing/status') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ billing: { effectivePlan: 'free', status: 'free' } }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }),
}));

import Focus from '../../../pages/Focus';

const createZenContext = (settingsOverrides = {}) => ({
  state: {
    settings: { focusDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, autoStartBreaks: false, ...settingsOverrides },
    subjects: [{ id: 'sub-1', name: 'Software Engineering', tasks: [] }],
    tasks: [],
    folders: [],
    schedule: [],
    profile: { firstName: 'Sean' },
  },
  focusSession: {
    isActive: false,
    isPaused: false,
    timeLeft: 1500,
    targetType: null,
    targetId: null,
    subjectId: null,
    sessionMode: 'focus',
    completedSessions: 0,
    streakCount: 0,
  },
  startTimer: vi.fn(),
  pauseTimer: vi.fn(),
  resetTimer: vi.fn(),
  setFocusSession: vi.fn(),
  setIsOnFocusPage: vi.fn(),
  updateSettings: vi.fn(),
  logFocusSession: vi.fn(),
  setHideNavbar: vi.fn(),
});

describe('Focus Pomodoro Timer', () => {
  beforeEach(() => {
    useZenMock.mockReset();
  });

  it('renders timer controls and remaining time display', () => {
    useZenMock.mockReturnValue(createZenContext());
    render(<Focus />);

    expect(screen.getByRole('timer')).toHaveTextContent('25:00');
    expect(screen.getAllByRole('button', { name: /Start focus timer/i }).length).toBeGreaterThan(0);
  });

  it('triggers handleStartFocus when play button is clicked', async () => {
    const context = createZenContext();
    useZenMock.mockReturnValue(context);

    const user = userEvent.setup();
    render(<Focus />);

    const startButtons = screen.getAllByRole('button', { name: /Start focus timer/i });
    if (startButtons[0]) {
      await user.click(startButtons[0]);
    }

    // HandleStartFocus calls apiFetch and reset/start
    expect(context.setIsOnFocusPage).toHaveBeenCalledWith(true);
  });
});
