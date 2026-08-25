import { describe, expect, it } from 'vitest';
import { isChunkLoadError, shouldAttemptChunkRecovery } from '../../utils/chunkRecovery';

describe('chunk recovery', () => {
  it.each([
    'Failed to fetch dynamically imported module: /assets/ZenAI-old.js',
    'Importing a module script failed.',
    'ChunkLoadError: Loading chunk settings failed',
    'error loading dynamically imported module',
    'Unable to preload CSS for /assets/index-old.css',
  ])('recognizes an obsolete build asset error: %s', (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true);
  });

  it('does not treat ordinary application failures as obsolete chunks', () => {
    expect(isChunkLoadError(new Error('Request failed with status 500'))).toBe(false);
  });

  it('allows one recovery attempt per cooldown window', () => {
    const error = new Error('Failed to fetch dynamically imported module');
    expect(shouldAttemptChunkRecovery(error, null, 100_000)).toBe(true);
    expect(shouldAttemptChunkRecovery(error, '90000', 100_000)).toBe(false);
    expect(shouldAttemptChunkRecovery(error, '60000', 100_000)).toBe(true);
  });
});
