import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { useZenMock } = vi.hoisted(() => ({
  useZenMock: vi.fn(),
}));

vi.mock('../../../context/ZenContext', () => ({
  useZen: useZenMock,
}));

import Calendar from '../../../pages/Calendar';

describe('Calendar planning', () => {
  beforeEach(() => {
    useZenMock.mockReset();
  });

  it('creates a categorized schedule entry without leaving the Calendar', async () => {
    const addTask = vi.fn();
    useZenMock.mockReturnValue({
      state: {
        tasks: [],
        subjects: [{ id: 'subject-1', name: 'Programming Languages', color: 'bg-blue-400' }],
      },
      addTask,
      toggleTask: vi.fn(),
      deleteTask: vi.fn(),
      setHideNavbar: vi.fn(),
    });

    const user = userEvent.setup();
    render(<Calendar />);

    await user.click(screen.getByRole('button', { name: 'Plan a task' }));
    expect(screen.getByRole('heading', { name: 'Schedule your next move' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Title'), 'Capstone presentation');
    await user.selectOptions(screen.getByLabelText('Plan type'), 'project');
    await user.selectOptions(screen.getByLabelText('Subject'), 'subject-1');
    await user.clear(screen.getByLabelText('Date'));
    await user.type(screen.getByLabelText('Date'), '2026-08-15');
    await user.clear(screen.getByLabelText('Time'));
    await user.type(screen.getByLabelText('Time'), '14:30');
    await user.type(screen.getByLabelText(/Notes/), 'Bring the final prototype.');
    await user.click(screen.getByRole('button', { name: 'Add to schedule' }));

    expect(addTask).toHaveBeenCalledOnce();
    expect(addTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Capstone presentation',
      completed: false,
      category: 'project',
      subjectId: 'subject-1',
      notes: 'Bring the final prototype.',
      dueDate: expect.stringContaining('2026-08-15T14:30:00'),
    }));
    expect(screen.queryByRole('heading', { name: 'Schedule your next move' })).not.toBeInTheDocument();
  });
});
