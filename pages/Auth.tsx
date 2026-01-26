import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { IconEye, IconEyeOff, IconCheck, IconX } from '../components/Icons';

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
  
  // Password Visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Rate Limiting
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  // Password Strength Logic
  const checkStrength = (pwd: string) => {
    const minLength = pwd.length >= 8;
    const hasNum = /\d/.test(pwd);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    
    const score = [minLength, hasNum, hasSpecial, hasUpper].filter(Boolean).length;
    
    let label = 'Weak';
    if (score === 4) label = 'Strong';
    else if (score >= 2) label = 'Medium';
    
    return { score, label, minLength, hasNum, hasSpecial, hasUpper };
  };

  const strength = checkStrength(password);
  const isStrong = strength.score === 4;

  useEffect(() => {
    if (lockoutUntil && Date.now() > lockoutUntil) {
        setLockoutUntil(null);
        setFailedAttempts(0);
    }
  }, [loading]); // Check on re-render/interaction

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Rate Limit Check
    if (lockoutUntil) {
        if (Date.now() < lockoutUntil) {
            const mins = Math.ceil((lockoutUntil - Date.now()) / 60000);
            setMessage(`Too many attempts. Please wait ${mins} minutes.`);
            return;
        } else {
            setLockoutUntil(null);
            setFailedAttempts(0);
        }
    }

    if (!email || !password) {
      setMessage('Please fill in all fields.');
      return;
    }

    if (mode === 'signup') {
        if (!isStrong) {
            setMessage('Password does not meet security requirements.');
            return;
        }
        if (password !== confirm) {
           setMessage('Passwords do not match.');
           return;
        }
    }

    try {
      setLoading(true);
      if (mode === 'signup') {
        await signUpWithEmail(email, password);
        setMessage('Registration successful. Verifying identity via email.');
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      // Increment failed attempts on error
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      
      if (newAttempts >= 5) {
          const lockoutTime = Date.now() + 5 * 60 * 1000; // 5 minutes
          setLockoutUntil(lockoutTime);
          setMessage('Too many failed attempts. Account creation suspended for 5 minutes.');
      } else {
          setMessage(err?.message || 'Authentication error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setMessage('Please enter your email for recovery.');
      return;
    }
    try {
      setLoading(true);
      await resetPassword(email);
      setMessage('Password reset email sent. Check your inbox.');
    } catch (err: any) {
      setMessage(err?.message || 'Could not send reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-zen-bg flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      
      {/* Background Orchestration */}
      <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-zen-primary/10 blur-[150px] rounded-full animate-float" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-zen-secondary/5 blur-[150px] rounded-full animate-float [animation-delay:2s]" />
      </div>

      <div className="w-full max-w-[440px] relative z-20">
        <div className="bg-zen-card/80 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl animate-reveal">
          
          <div className="mb-8 text-center space-y-2">
             <div className="inline-block px-3 py-1 rounded-full bg-zen-primary/10 border border-zen-primary/20 text-zen-primary text-[9px] font-black uppercase tracking-[0.3em] mb-2">
                AcademiaZen
             </div>
             <h1 className="text-4xl font-extralight text-zen-text-primary tracking-tighter">Welcome</h1>
             <p className="text-xs text-zen-text-secondary font-light">
               Sign in to continue your journey.
             </p>
          </div>

          <div className="flex p-1 bg-zen-surface/30 rounded-xl mb-8 border border-zen-surface">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] rounded-lg transition-all ${
                mode === 'signin' ? 'bg-white text-black shadow-xl' : 'text-zen-text-disabled hover:text-zen-text-primary'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] rounded-lg transition-all ${
                mode === 'signup' ? 'bg-white text-black shadow-xl' : 'text-zen-text-disabled hover:text-zen-text-primary'
              }`}
            >
              Sign Up
            </button>
          </div>

          <button
            onClick={() => signInWithGoogle()}
            disabled={loading}
            className="group w-full py-3.5 rounded-xl bg-zen-card border border-zen-surface text-zen-text-primary hover:border-zen-primary hover:bg-zen-surface transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg mb-6"
          >
            <svg className="w-4 h-4 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Sign in with Google</span>
          </button>

          <div className="relative h-px bg-zen-surface mb-8">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 bg-zen-card text-[8px] font-black uppercase tracking-[0.2em] text-zen-text-disabled">
                Or Use Email
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[8px] text-zen-text-disabled uppercase font-black tracking-[0.2em] ml-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zen-surface/30 border border-zen-surface rounded-xl p-3.5 text-zen-text-primary focus:outline-none focus:border-zen-primary transition-all text-sm"
                placeholder="Enter your email"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[8px] text-zen-text-disabled uppercase font-black tracking-[0.2em] ml-1">Password</label>
              <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-zen-surface/30 border border-zen-surface rounded-xl p-3.5 pr-10 text-zen-text-primary focus:outline-none focus:border-zen-primary transition-all text-sm"
                    placeholder="Enter your password"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    onMouseDown={(e) => e.preventDefault()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zen-text-secondary hover:text-zen-text-primary p-1"
                  >
                    {showPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                  </button>
              </div>
            </div>

            {/* Password Strength UI (Sign Up Only) */}
            {mode === 'signup' && password.length > 0 && (
                <div className="bg-zen-surface/20 rounded-xl p-3 space-y-2 animate-reveal border border-zen-surface/50">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase font-black tracking-widest text-zen-text-secondary">Security Level</span>
                        <span className={`text-[9px] uppercase font-black tracking-widest ${
                            strength.score === 4 ? 'text-green-400' : strength.score >= 2 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                            {strength.label}
                        </span>
                    </div>
                    <div className="flex gap-1 h-1">
                        {[1, 2, 3, 4].map(s => (
                            <div key={s} className={`flex-1 rounded-full transition-all duration-300 ${
                                s <= strength.score 
                                ? (strength.score === 4 ? 'bg-green-400' : strength.score >= 2 ? 'bg-yellow-400' : 'bg-red-400') 
                                : 'bg-zen-surface'
                            }`} />
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-y-1.5 pt-1">
                        {[
                            { label: '8+ Characters', met: strength.minLength },
                            { label: 'Number', met: strength.hasNum },
                            { label: 'Symbol', met: strength.hasSpecial },
                            { label: 'Uppercase', met: strength.hasUpper },
                        ].map(rule => (
                            <div key={rule.label} className={`flex items-center gap-1.5 text-[8px] uppercase font-bold tracking-wider ${rule.met ? 'text-zen-primary' : 'text-zen-text-disabled'}`}>
                                {rule.met ? <IconCheck className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-zen-text-disabled/30" />}
                                {rule.label}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {mode === 'signup' && (
              <div className="space-y-1.5 animate-reveal">
                <label className="text-[8px] text-zen-text-disabled uppercase font-black tracking-[0.2em] ml-1">Confirm Password</label>
                <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="w-full bg-zen-surface/30 border border-zen-surface rounded-xl p-3.5 pr-10 text-zen-text-primary focus:outline-none focus:border-zen-primary transition-all text-sm"
                      placeholder="Confirm your password"
                    />
                    <button 
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        onMouseDown={(e) => e.preventDefault()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zen-text-secondary hover:text-zen-text-primary p-1"
                    >
                        {showConfirm ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                    </button>
                </div>
              </div>
            )}

            {message && (
              <div className="text-[9px] font-medium text-zen-primary bg-zen-primary/5 border border-zen-primary/20 rounded-xl p-3 animate-reveal">
                <div className="flex items-center gap-2">
                    <div className="w-1 rounded-full bg-zen-primary" />
                    {message}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (mode === 'signup' && !isStrong)}
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[9px] shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 ${
                  mode === 'signup' && !isStrong ? 'bg-zen-surface text-zen-text-disabled cursor-not-allowed' : 'bg-white text-black'
              }`}
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                    {mode === 'signup' ? 'Create Account' : 'Log In'}
                </>
              )}
            </button>

            {mode === 'signin' && (
              <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={loading}
                    className="text-[8px] text-zen-text-disabled uppercase font-black tracking-[0.2em] hover:text-zen-primary transition-colors"
                  >
                    Forgot Password?
                  </button>
              </div>
            )}
          </form>
        </div>
        
        <div className="mt-8 text-center">
            <p className="text-[8px] text-zen-text-disabled uppercase font-black tracking-[0.4em] opacity-30">
                Zen Infrastructure &bull; v2.4
            </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
