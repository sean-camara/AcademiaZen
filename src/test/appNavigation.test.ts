import { describe, expect, it, vi } from 'vitest';
import { openSettings } from '../../utils/appNavigation';

describe('openSettings', () => {
  it('publishes a typed billing destination', () => {
    const listener = vi.fn();
    window.addEventListener('open-settings', listener);

    openSettings('billing');

    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ tab: 'billing' });
    window.removeEventListener('open-settings', listener);
  });
});
