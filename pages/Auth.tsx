import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const Auth: React.FC = () => {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!email || !password) {
      setMessage('Please enter email and password.');
      return;
    }
    if (mode === 'signup' && password !== confirm) {
      setMessage('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      if (mode === 'signup') {
        await signUpWithEmail(email, password);
        setMessage('Account created. Please verify your email.');
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      setMessage(err?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setMessage('Enter your email to reset password.');
      return;
    }
    try {
      setLoading(true);
      await resetPassword(email);
      setMessage('Password reset email sent.');
    } catch (err: any) {
      setMessage(err?.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-zen-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-zen-card border border-zen-surface rounded-3xl p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-zen-text-primary">Welcome to ZEN</h1>
          <p className="text-xs text-zen-text-secondary mt-1">
            Sign in to sync your data across devices
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('signin')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium border ${
              mode === 'signin' ? 'border-zen-primary text-zen-primary' : 'border-zen-surface text-zen-text-secondary'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium border ${
              mode === 'signup' ? 'border-zen-primary text-zen-primary' : 'border-zen-surface text-zen-text-secondary'
            }`}
          >
            Sign Up
          </button>
        </div>

        <button
          onClick={() => signInWithGoogle()}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-zen-surface text-zen-text-primary hover:bg-zen-surface/70 transition-colors text-sm font-medium"
        >
          Continue with Google
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="h-px bg-zen-surface flex-1" />
          <span className="text-xs text-zen-text-disabled">OR</span>
          <div className="h-px bg-zen-surface flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-zen-text-secondary">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zen-bg border border-zen-surface rounded-lg p-3 text-zen-text-primary focus:outline-none focus:border-zen-primary"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zen-text-secondary">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zen-bg border border-zen-surface rounded-lg p-3 text-zen-text-primary focus:outline-none focus:border-zen-primary"
              placeholder="••••••••"
            />
          </div>
          {mode === 'signup' && (
            <div className="space-y-2">
              <label className="text-xs text-zen-text-secondary">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-zen-bg border border-zen-surface rounded-lg p-3 text-zen-text-primary focus:outline-none focus:border-zen-primary"
                placeholder="••••••••"
              />
            </div>
          )}

          {message && (
            <div className="text-xs text-zen-primary bg-zen-surface/50 border border-zen-surface rounded-lg p-3">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-zen-primary text-zen-bg font-semibold hover:opacity-90 transition-opacity"
          >
            {mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>

          {mode === 'signin' && (
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={loading}
              className="w-full text-xs text-zen-text-secondary hover:text-zen-primary transition-colors"
            >
              Forgot password?
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default Auth;
