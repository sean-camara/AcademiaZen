import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readOverlayHistoryEntry, useOverlayHistory } from '../../hooks/useOverlayHistory';

describe('useOverlayHistory', () => {
  beforeEach(() => {
    window.history.replaceState({ idx: 0 }, document.title, '/calendar');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds a same-page entry when Zen AI opens', () => {
    const { result } = renderHook(() => useOverlayHistory('calendar'));

    act(() => result.current.openAI());

    expect(result.current.showAI).toBe(true);
    expect(window.location.pathname).toBe('/calendar');
    expect(readOverlayHistoryEntry(window.history.state)).toEqual({ name: 'zen-ai' });
  });

  it('dismisses the active overlay when mobile back emits popstate', () => {
    const { result } = renderHook(() => useOverlayHistory('calendar'));

    act(() => result.current.openSettings('notifications'));
    expect(result.current.showSettings).toBe(true);

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { idx: 0 } }));
    });

    expect(result.current.showSettings).toBe(false);
    expect(result.current.showAI).toBe(false);
    expect(window.location.pathname).toBe('/calendar');
  });

  it('restores the previous overlay when Settings was opened over Zen AI', () => {
    const { result } = renderHook(() => useOverlayHistory('calendar'));

    act(() => result.current.openAI());
    const aiHistoryState = window.history.state;
    act(() => result.current.openSettings('profile'));

    expect(result.current.showSettings).toBe(true);
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: aiHistoryState }));
    });

    expect(result.current.showSettings).toBe(false);
    expect(result.current.showAI).toBe(true);
  });

  it('uses browser back when an explicit close button dismisses the overlay', () => {
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    const { result } = renderHook(() => useOverlayHistory('calendar'));

    act(() => result.current.openAI());
    act(() => result.current.closeAI());

    expect(backSpy).toHaveBeenCalledOnce();
  });
});
