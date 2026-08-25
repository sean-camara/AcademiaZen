import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const firebaseAuthMocks = vi.hoisted(() => ({
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
}));

vi.mock('../../../firebase', () => ({
  auth: { currentUser: null },
  googleProvider: {},
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: firebaseAuthMocks.onAuthStateChanged,
  signInWithPopup: firebaseAuthMocks.signInWithPopup,
  signInWithRedirect: firebaseAuthMocks.signInWithRedirect,
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendEmailVerification: vi.fn(),
  signOut: vi.fn(),
}));

import { AuthProvider, useAuth } from '../../../context/AuthContext';

const GoogleSignInHarness = () => {
  const { signInWithGoogle } = useAuth();
  const [result, setResult] = useState('idle');

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      setResult('complete');
    } catch {
      setResult('failed');
    }
  };

  return (
    <>
      <button type="button" onClick={handleSignIn}>Sign in with Google</button>
      <output>{result}</output>
    </>
  );
};

describe('AuthProvider Google sign-in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseAuthMocks.onAuthStateChanged.mockImplementation((_auth, callback) => {
      void callback(null);
      return vi.fn();
    });
  });

  it('uses popup auth on mobile instead of the cross-origin redirect flow', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    });
    firebaseAuthMocks.signInWithPopup.mockResolvedValue({ user: { uid: 'google-user' } });

    render(
      <AuthProvider>
        <GoogleSignInHarness />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));

    await waitFor(() => expect(screen.getByText('complete')).toBeInTheDocument());
    expect(firebaseAuthMocks.signInWithPopup).toHaveBeenCalledTimes(1);
    expect(firebaseAuthMocks.signInWithRedirect).not.toHaveBeenCalled();
  });

  it('reports popup failures instead of falling back to the broken redirect flow', async () => {
    firebaseAuthMocks.signInWithPopup.mockRejectedValue({ code: 'auth/popup-blocked' });

    render(
      <AuthProvider>
        <GoogleSignInHarness />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));

    await waitFor(() => expect(screen.getByText('failed')).toBeInTheDocument());
    expect(firebaseAuthMocks.signInWithRedirect).not.toHaveBeenCalled();
  });
});
