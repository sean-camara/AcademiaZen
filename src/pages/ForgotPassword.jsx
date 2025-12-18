import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '../components/UI';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
        await resetPassword(email);
        setIsSent(true);
    } catch (err) {
        setError("Could not send reset email. Check if email is correct.");
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isSent) {
      return (
        <div className="min-h-screen bg-[#1c2128] flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                <CheckCircle size={32} className="text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Check your email</h2>
            <p className="text-stone-400 max-w-xs mb-8">We've sent a password reset link to <strong>{email}</strong>.</p>
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
            <ArrowLeft size={16} className="mr-1" /> Back to Login
        </Link>
        
        <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">Reset Password</h1>
            <p className="text-stone-400 text-sm">Enter your email and we'll send you a link to reset your password.</p>
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

                <Button disabled={isSubmitting} className="w-full py-3 bg-[#4a7a7d] hover:bg-[#3b6366] text-white">
                    {isSubmitting ? <Loader2 className="animate-spin" /> : "Send Reset Link"}
                </Button>
            </form>
        </div>
      </div>
    </div>
  );
}