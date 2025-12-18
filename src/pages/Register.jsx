import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '../components/UI';

export default function Register() {
  const { registerEmail, loginGoogle } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
        await registerEmail(email, password);
        setIsSuccess(true);
    } catch (err) {
        setError("Failed to create account. Email might be taken.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
      try {
          await loginGoogle();
          navigate('/'); // Redirect to dashboard on success
      } catch (err) {
          setError("Google sign-up failed.");
      }
  };

  if (isSuccess) {
      return (
        <div className="min-h-screen bg-[#1c2128] flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                <CheckCircle size={32} className="text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Verify your email</h2>
            <p className="text-stone-400 max-w-xs mb-8">We've sent a verification link to <strong>{email}</strong>. Please check your inbox.</p>
            <Link to="/login">
                <Button className="w-full bg-[#4a7a7d] text-white">Back to Login</Button>
            </Link>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#1c2128] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link to="/login" className="flex items-center text-stone-400 hover:text-white mb-6 text-sm">
            <ArrowLeft size={16} className="mr-1" /> Back
        </Link>
        <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-stone-400">Join AcademiaZen today.</p>
        </div>

        <div className="bg-[#2c333e] p-6 rounded-2xl border border-stone-700/50 shadow-xl">
            {error && <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm rounded-lg text-center">{error}</div>}
            
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-3 text-stone-500" size={18} />
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full bg-[#1c2128] text-white pl-10 pr-4 py-2.5 rounded-xl border border-stone-700 focus:border-[#4a7a7d] outline-none transition-colors"
                            placeholder="student@example.com"
                        />
                    </div>
                </div>
                
                <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 text-stone-500" size={18} />
                        <input 
                            type="password" 
                            required
                            minLength={6}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full bg-[#1c2128] text-white pl-10 pr-4 py-2.5 rounded-xl border border-stone-700 focus:border-[#4a7a7d] outline-none transition-colors"
                            placeholder="At least 6 characters"
                        />
                    </div>
                </div>

                <Button disabled={isSubmitting} className="w-full py-3 bg-[#4a7a7d] hover:bg-[#3b6366] text-white mt-2">
                    {isSubmitting ? <Loader2 className="animate-spin" /> : "Create Account"}
                </Button>
            </form>

            <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-700"></div></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#2c333e] px-2 text-stone-500">Or sign up with</span></div>
            </div>

            <button onClick={handleGoogle} className="w-full py-2.5 bg-white text-stone-900 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-stone-200 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Google
            </button>
        </div>

        <p className="text-center mt-6 text-stone-400 text-sm">
            Already have an account? <Link to="/login" className="text-[#4a7a7d] font-bold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}