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
  apiFetch: vi.fn().mockRejectedValue(new Error('Billing unavailable in test')),
}));

import Library from '../../../pages/Library';

const createZenContext = (folders: Array<{ id: string; name: string; items: unknown[] }>, deleteFolder = vi.fn()) => ({
  state: { folders },
  addFolder: vi.fn(),
  updateFolder: vi.fn(),
  deleteFolder,
  addItemToFolder: vi.fn(),
  deleteItemFromFolder: vi.fn(),
  setHideNavbar: vi.fn(),
});

describe('Library collection deletion', () => {
  beforeEach(() => {
    useZenMock.mockReset();
  });

  it('deletes an empty collection directly from its card', async () => {
    const deleteFolder = vi.fn();
    useZenMock.mockReturnValue(createZenContext([
      { id: 'empty-folder', name: 'Empty Collection', items: [] },
    ], deleteFolder));

    const user = userEvent.setup();
    render(<Library />);

    await user.click(screen.getByRole('button', { name: 'Delete Empty Collection collection' }));

    expect(deleteFolder).toHaveBeenCalledOnce();
    expect(deleteFolder).toHaveBeenCalledWith('empty-folder');
    expect(screen.queryByRole('heading', { name: 'Delete Collection' })).not.toBeInTheDocument();
  });

  it('requires confirmation before deleting a collection that contains items', async () => {
    const deleteFolder = vi.fn();
    useZenMock.mockReturnValue(createZenContext([
      {
        id: 'filled-folder',
        name: 'Course Notes',
        items: [{ id: 'note-1', title: 'Week 1.txt', type: 'note', content: 'Notes' }],
      },
    ], deleteFolder));

    const user = userEvent.setup();
    render(<Library />);

    await user.click(screen.getByRole('button', { name: 'Delete Course Notes collection' }));

    expect(deleteFolder).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Delete Collection' })).toBeInTheDocument();
    expect(screen.getByText(/all 1 item inside it/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deleteFolder).toHaveBeenCalledOnce();
    expect(deleteFolder).toHaveBeenCalledWith('filled-folder');
  });
});
