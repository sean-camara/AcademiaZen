import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ZenAIWelcome } from '../../../components/ZenAIWelcome';

const STARTER_LABELS = ['Plan my week', 'Break down a task', 'Build a study plan'] as const;

describe('ZenAIWelcome', () => {
  it('renders the approved welcome copy and starter actions', () => {
    render(<ZenAIWelcome onSelectPrompt={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'What can I help you study?' })).toBeInTheDocument();
    expect(screen.getByText('Ask a question, attach your notes, or turn your week into a focused plan.')).toBeInTheDocument();

    for (const label of STARTER_LABELS) {
      expect(screen.getByRole('button', { name: label })).toBeEnabled();
    }
  });

  it('passes the selected starter prompt to the composer', async () => {
    const onSelectPrompt = vi.fn();
    const user = userEvent.setup();
    render(<ZenAIWelcome onSelectPrompt={onSelectPrompt} />);

    await user.click(screen.getByRole('button', { name: 'Plan my week' }));

    expect(onSelectPrompt).toHaveBeenCalledOnce();
    expect(onSelectPrompt).toHaveBeenCalledWith(
      'What tasks, exams, projects, and study sessions are scheduled this week, and how should I prioritize them?',
    );
  });

  it('disables starter actions when Zen AI is locked', () => {
    render(<ZenAIWelcome disabled onSelectPrompt={vi.fn()} />);

    for (const label of STARTER_LABELS) {
      expect(screen.getByRole('button', { name: label })).toBeDisabled();
    }
  });
});
