import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ZenProvider } from './context/ZenContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import NotificationPrompt from './components/NotificationPrompt';

const Auth = lazy(() => import('./pages/Auth'));
const Landing = lazy(() => import('./pages/Landing'));
const Admin = lazy(() => import('./pages/Admin'));

const PageLoading = () => (
  <div className="min-h-screen w-full bg-zen-bg flex items-center justify-center" role="status" aria-live="polite">
    <span className="sr-only">Loading AcademiaZen</span>
    <div className="w-10 h-10 border-2 border-zen-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
  </div>
);

const VerifyEmail: React.FC = () => {
  const { user, resendVerification, signOut } = useAuth();
  const [message, setMessage] = useState<string | null>(null);

  const handleResend = async () => {
    try {
      await resendVerification();
      setMessage('Verification email sent. Please check your inbox.');
    } catch (err: any) {
      setMessage(err?.message || 'Failed to send verification email.');
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen w-full bg-zen-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-zen-card border border-zen-surface rounded-3xl p-8 shadow-2xl text-center">
        <h2 className="text-xl font-semibold text-zen-text-primary">Verify your email</h2>
        <p className="text-xs text-zen-text-secondary mt-2">
          We sent a verification link to <span className="text-zen-primary">{user.email}</span>.
        </p>
        {message && (
          <div className="text-xs text-zen-primary bg-zen-surface/50 border border-zen-surface rounded-lg p-3 mt-4">
            {message}
          </div>
        )}
        <div className="mt-6 space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-xl bg-zen-surface text-zen-text-primary hover:bg-zen-surface/70 transition-colors"
          >
            I have verified my email
          </button>
          <button
            onClick={handleResend}
            className="w-full py-3 rounded-xl bg-zen-primary text-zen-bg font-semibold hover:opacity-90 transition-opacity"
          >
            Resend verification email
          </button>
          <button
            onClick={signOut}
            className="w-full py-2 rounded-xl border border-zen-surface text-zen-text-secondary hover:text-zen-text-primary transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

const AppInner: React.FC = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    audioRef.current = new Audio('/sounds/phone-alert-marimba-bubble-om-fx-1-00-01.mp3');
    audioRef.current.volume = 0.7;

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PLAY_NOTIFICATION_SOUND') {
        playNotificationSound();
      }
    };

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.log('Could not play notification sound:', err);
      });
    }
  };

  if (loading) {
    return <PageLoading />;
  }

  if (!user) {
    if (location.pathname === '/') {
      return <Suspense fallback={<PageLoading />}><Landing /></Suspense>;
    }
    if (location.pathname === '/login') {
      return <Suspense fallback={<PageLoading />}><Auth /></Suspense>;
    }
    return <Navigate to="/" replace />;
  }

  if (!user.emailVerified) {
    return <VerifyEmail />;
  }

  if (location.pathname === '/admin') {
    return (
      <Suspense fallback={<PageLoading />}>
        <Admin />
      </Suspense>
    );
  }

  return (
    <ZenProvider>
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500/90 text-black text-xs font-medium py-1 px-4 text-center z-50 animate-fade-in">
          You're offline. Some features may be limited.
        </div>
      )}
      <Layout />
      <NotificationPrompt />
    </ZenProvider>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <AuthProvider>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </AuthProvider>
  </ErrorBoundary>
);

export default App;
