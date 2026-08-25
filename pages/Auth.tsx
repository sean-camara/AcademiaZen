import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IconCheck, IconChevronLeft, IconEye, IconEyeOff } from '../components/Icons';

const getAuthErrorCode = (error: unknown): string => (
  typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : ''
);

export const getGoogleSignInErrorMessage = (error: unknown): string => {
  const code = getAuthErrorCode(error);

  switch (code) {
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window. Allow pop-ups for AcademiaZen and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled. Please try again when you are ready.';
    case 'auth/network-request-failed':
      return 'Google could not be reached. Check your internet connection and try again.';
    case 'auth/unauthorized-domain':
      return 'Google sign-in is not available on this domain. Please contact support.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is temporarily unavailable. Please use email sign-in or try again later.';
    default:
      return 'Google sign-in could not be completed. Please try again.';
  }
};

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const { signInWithGoogle: signInWithGoogleAuth, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>(() => new URLSearchParams(window.location.search).get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  const checkStrength = (value: string) => {
    const minLength = value.length >= 8;
    const hasNum = /\d/.test(value);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value);
    const hasUpper = /[A-Z]/.test(value);
    const score = [minLength, hasNum, hasSpecial, hasUpper].filter(Boolean).length;
    return { score, label: score === 4 ? 'Strong' : score >= 2 ? 'Medium' : 'Weak', minLength, hasNum, hasSpecial, hasUpper };
  };

  const strength = checkStrength(password);
  const isStrong = strength.score === 4;

  useEffect(() => {
    if (lockoutUntil && Date.now() > lockoutUntil) {
      setLockoutUntil(null);
      setFailedAttempts(0);
    }
  }, [loading, lockoutUntil]);

  const handleBack = () => window.history.length > 1 ? navigate(-1) : navigate('/');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (lockoutUntil && Date.now() < lockoutUntil) return setMessage(`Too many attempts. Please wait ${Math.ceil((lockoutUntil - Date.now()) / 60000)} minutes.`);
    if (!email || !password) return setMessage('Please fill in all fields.');
    if (mode === 'signup') {
      if (!firstName.trim()) return setMessage('Please enter your first name.');
      if (!isStrong) return setMessage('Password does not meet security requirements.');
      if (password !== confirm) return setMessage('Passwords do not match.');
    }
    try {
      setLoading(true);
      if (mode === 'signup') {
        localStorage.setItem('zen_pending_profile', JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }));
        await signUpWithEmail(email, password);
        setMessage('Registration successful. Check your email to verify your account.');
      } else await signInWithEmail(email, password);
    } catch (error: any) {
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      if (attempts >= 5) {
        setLockoutUntil(Date.now() + 5 * 60 * 1000);
        setMessage('Too many failed attempts. Please wait 5 minutes.');
      } else setMessage(error?.message || 'Authentication error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) return setMessage('Please enter your email for recovery.');
    try {
      setLoading(true);
      await resetPassword(email);
      setMessage('Password reset email sent. Check your inbox.');
    } catch (error: any) {
      setMessage(error?.message || 'Could not send reset link.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setMessage(null);
    setLoading(true);
    try {
      await signInWithGoogleAuth();
    } catch (error: unknown) {
      console.error('[Auth] Google sign-in failed:', getAuthErrorCode(error) || 'unknown');
      setMessage(getGoogleSignInErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = handleGoogleSignIn;

  const inputClass = 'auth-input w-full rounded-xl border border-white/[.09] bg-[#121b27] px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-300/60 focus:bg-[#152230] sm:py-3.5';
  const labelClass = 'text-[9px] font-bold uppercase tracking-[.2em] text-slate-500 sm:text-[10px]';

  return (
    <div className="landing-shell auth-scroll h-screen w-full overflow-x-hidden overflow-y-auto bg-[#071019] text-slate-100">
      <header className="relative z-20 flex h-16 items-center justify-between border-b border-white/[.06] px-5 sm:px-8 lg:h-auto lg:px-10 lg:py-4">
        <Link to="/" className="flex items-center gap-3"><img src="/icons/academiazen-mark.svg" alt="AcademiaZen" className="h-10 w-10 rounded-xl" /><span className="font-semibold tracking-tight text-white">AcademiaZen</span></Link>
        <button type="button" onClick={handleBack} className="inline-flex items-center gap-2 rounded-xl border border-white/[.08] bg-white/[.03] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-emerald-300/30 hover:text-emerald-200"><IconChevronLeft className="h-4 w-4" /> Back</button>
      </header>

      <div className="relative mx-auto grid min-h-[calc(100dvh-64px)] max-w-[1540px] lg:min-h-[calc(100dvh-73px)] lg:grid-cols-[1fr_.92fr]">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-50 [background-image:linear-gradient(rgba(148,163,184,.055)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.055)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="pointer-events-none absolute left-[-15%] top-[15%] -z-10 h-[440px] w-[440px] rounded-full bg-emerald-500/10 blur-[145px]" />
        <section className="relative hidden overflow-hidden border-r border-white/[.06] px-10 py-16 lg:flex lg:flex-col lg:justify-between xl:px-16">
          <div className="absolute right-[-10%] top-[14%] h-[420px] w-[420px] rounded-full border border-emerald-300/10 shadow-[0_0_0_50px_rgba(52,211,153,.018),0_0_0_110px_rgba(139,92,246,.016)]" />
          <div className="relative max-w-xl"><p className="text-xs font-bold uppercase tracking-[.24em] text-emerald-300">A quieter way to keep up</p><h1 className="landing-display mt-6 text-6xl font-semibold leading-[.98] tracking-[-.07em] text-white xl:text-7xl">Study with a sense of <span className="text-emerald-300">direction.</span></h1><p className="mt-7 max-w-md text-lg leading-8 text-slate-400">Tasks, deadlines, focus time, and the material you need—kept within reach when your study day gets busy.</p></div>
          <div className="relative max-w-md rounded-2xl border border-white/[.08] bg-[#0e1822]/75 p-5 shadow-2xl backdrop-blur-sm"><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-300">Today&apos;s direction</span><span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,1)]" /></div><p className="mt-4 text-xl font-medium text-white">One workspace for your next useful step.</p><div className="mt-5 space-y-3 border-t border-white/[.06] pt-5 text-sm text-slate-400"><p className="flex items-center gap-3"><span className="text-emerald-300"><IconCheck className="h-4 w-4" /></span>Keep deadlines visible</p><p className="flex items-center gap-3"><span className="text-emerald-300"><IconCheck className="h-4 w-4" /></span>Focus on a real target</p><p className="flex items-center gap-3"><span className="text-emerald-300"><IconCheck className="h-4 w-4" /></span>Review from your own material</p></div></div>
        </section>

        <main className="flex items-start justify-center px-6 py-6 sm:px-10 sm:py-10 lg:items-center lg:px-16">
          <div className="w-full max-w-[420px]">
            <p className="text-[10px] font-bold uppercase tracking-[.24em] text-emerald-300">{mode === 'signin' ? 'Welcome back' : 'Create your space'}</p>
            <h2 className="landing-display mt-3 text-[2.45rem] font-semibold leading-[.95] tracking-[-.07em] text-white sm:mt-4 sm:text-5xl">{mode === 'signin' ? <>Ready when<br />you are.</> : <>Start with<br />your next step.</>}</h2>
            <p className="mt-5 hidden max-w-sm text-sm leading-6 text-slate-400 sm:block">{mode === 'signin' ? 'Sign in to return to your focused academic workspace.' : 'Build one calm place for your workload and study materials.'}</p>

            <div className="mt-6 flex gap-6 border-b border-white/[.09] sm:mt-10"><button type="button" onClick={() => setMode('signin')} className={`relative pb-3 text-xs font-bold uppercase tracking-[.16em] transition ${mode === 'signin' ? 'text-white after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-emerald-300' : 'text-slate-600 hover:text-slate-300'}`}>Log in</button><button type="button" onClick={() => setMode('signup')} className={`relative pb-3 text-xs font-bold uppercase tracking-[.16em] transition ${mode === 'signup' ? 'text-white after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-emerald-300' : 'text-slate-600 hover:text-slate-300'}`}>Sign up</button></div>

            <div className="mt-5"><button type="button" onClick={() => signInWithGoogle()} disabled={loading} className="flex w-full items-center justify-center gap-3 rounded-xl bg-white py-3 text-sm font-semibold text-[#111827] transition hover:bg-emerald-50 active:scale-[.99] sm:py-3.5"><svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>Continue with Google</button><div className="relative my-5 h-px bg-white/[.08] sm:my-7"><span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#071019] px-4 text-[10px] font-bold uppercase tracking-[.22em] text-slate-600">or use email</span></div></div>

            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-5">
              {mode === 'signup' && <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5 sm:space-y-2"><label className={labelClass}>First name</label><input className={inputClass} type="text" autoComplete="given-name" value={firstName} onChange={event => setFirstName(event.target.value)} placeholder="First name" /></div><div className="space-y-1.5 sm:space-y-2"><label className={labelClass}>Last name</label><input className={inputClass} type="text" autoComplete="family-name" value={lastName} onChange={event => setLastName(event.target.value)} placeholder="Last name" /></div></div>}
              <div className="space-y-1.5 sm:space-y-2"><label className={labelClass}>Email address</label><input className={inputClass} type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></div>
              <div className="space-y-1.5 sm:space-y-2"><label className={labelClass}>Password</label><div className="relative"><input className={`${inputClass} pr-12`} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="Your password" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)} onMouseDown={event => event.preventDefault()} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 transition hover:text-white">{showPassword ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}</button></div></div>
              {mode === 'signup' && password.length > 0 && <div className="hidden border-l border-emerald-300/50 pl-4 sm:block"><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Password strength</span><span className={`text-[10px] font-bold uppercase tracking-[.18em] ${strength.score === 4 ? 'text-emerald-300' : strength.score >= 2 ? 'text-amber-300' : 'text-rose-300'}`}>{strength.label}</span></div><div className="mt-3 flex gap-1">{[1, 2, 3, 4].map(step => <i key={step} className={`h-1 flex-1 rounded-full ${step <= strength.score ? (strength.score === 4 ? 'bg-emerald-300' : strength.score >= 2 ? 'bg-amber-300' : 'bg-rose-300') : 'bg-white/[.08]'}`} />)}</div></div>}
              {mode === 'signup' && <div className="space-y-1.5 sm:space-y-2"><label className={labelClass}>Confirm password</label><div className="relative"><input className={`${inputClass} pr-12`} type={showConfirm ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} placeholder="Repeat your password" /><button type="button" aria-label={showConfirm ? 'Hide confirmed password' : 'Show confirmed password'} onClick={() => setShowConfirm(value => !value)} onMouseDown={event => event.preventDefault()} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 transition hover:text-white">{showConfirm ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}</button></div></div>}
              {message && <p className="border-l-2 border-emerald-300 bg-emerald-300/[.05] px-3 py-2.5 text-xs leading-5 text-emerald-100">{message}</p>}
              <button type="submit" disabled={loading || (mode === 'signup' && !isStrong)} className={`flex w-full items-center justify-center rounded-xl py-3.5 text-xs font-bold uppercase tracking-[.18em] transition active:scale-[.99] sm:py-4 ${mode === 'signup' && !isStrong ? 'cursor-not-allowed bg-white/[.08] text-slate-600' : 'bg-emerald-300 text-[#06211b] hover:bg-emerald-200'}`}>{loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : mode === 'signup' ? 'Create account' : 'Enter your workspace'}</button>
              {mode === 'signin' && <button type="button" onClick={handleResetPassword} disabled={loading} className="block w-full pt-1 text-center text-[10px] font-bold uppercase tracking-[.16em] text-slate-600 transition hover:text-emerald-300">Forgot password?</button>}
            </form>
            <p className="mt-10 hidden text-center text-xs text-slate-600 sm:block">By continuing, you&apos;re returning to your personal study workspace.</p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Auth;
