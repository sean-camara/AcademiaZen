import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '../../../components/ui/EmptyState';

describe('EmptyState', () => {
  it('explains the next step and exposes one primary action', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();

    render(
      <EmptyState
        icon={<span aria-hidden="true">+</span>}
        title="Create your first subject"
        description="Keep your work organized."
        actionLabel="Create subject"
        onAction={onAction}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Create your first subject' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create subject' }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
