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
    await user.click(screen.getByLabelText('Plan type'));
    await user.click(screen.getByRole('option', { name: 'Project' }));
    await user.click(screen.getByLabelText('Subject'));
    await user.click(screen.getByRole('option', { name: 'Programming Languages' }));
    await user.click(screen.getByLabelText('Date'));
    await user.click(screen.getByRole('button', { name: '15' }));
    await user.click(screen.getByLabelText('Time'));
    await user.click(screen.getByRole('button', { name: '02' }));
    await user.click(screen.getByRole('button', { name: '30' }));
    await user.click(screen.getByRole('button', { name: 'PM' }));
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
  }, 15000);
});
