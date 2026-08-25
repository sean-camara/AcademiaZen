import { describe, expect, it } from 'vitest';
import { getGoogleSignInErrorMessage } from '../../../pages/Auth';

describe('Google sign-in error messages', () => {
  it('explains how to recover when the browser blocks the popup', () => {
    expect(getGoogleSignInErrorMessage({ code: 'auth/popup-blocked' }))
      .toMatch(/allow pop-ups/i);
  });

  it('does not expose raw provider errors to users', () => {
    expect(getGoogleSignInErrorMessage({
      code: 'auth/internal-error',
      message: 'Firebase: Error (auth/internal-error).',
    })).toBe('Google sign-in could not be completed. Please try again.');
  });
});
