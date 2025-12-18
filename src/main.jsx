import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import App from './App';
import './index.css';
import { CheckCircle, ArrowLeft } from 'lucide-react'; // Import icons for the verify screen
import { Button } from './components/UI'; // Import Button

const GOOGLE_CLIENT_ID = "248064186308-t6ar7gb0p7nf09o7nndd165o5v6qqlbr.apps.googleusercontent.com"; 

// --- VERIFY EMAIL SCREEN COMPONENT ---
// This acts as a "Gatekeeper" page
const VerifyEmailScreen = () => {
    const { logout, resendVerification, firebaseUser } = useAuth();
    
    return (
        <div className="min-h-screen bg-[#1c2128] flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                <CheckCircle size={32} className="text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Verify your email</h2>
            <p className="text-stone-400 max-w-xs mb-8">
                We've sent a verification link to <strong>{firebaseUser?.email}</strong>.<br/>
                Please check your inbox and click the link to continue.
            </p>
            
            <div className="flex flex-col gap-3 w-full max-w-xs">
                 <Button onClick={() => window.location.reload()} className="w-full bg-[#4a7a7d] text-white">
                    I've Verified It
                </Button>
                <button onClick={resendVerification} className="text-sm text-[#4a7a7d] hover:underline">
                    Resend Email
                </button>
                <button onClick={logout} className="text-sm text-stone-500 hover:text-stone-300 flex items-center justify-center gap-1">
                    <ArrowLeft size={14} /> Back to Login
                </button>
            </div>
        </div>
    );
};

// --- ERROR BOUNDARY ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("🚨 CRASH DETECTED:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#fff0f0', color: '#cc0000', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h1>⚠️ App Crashed</h1>
          <h3>{this.state.error && this.state.error.toString()}</h3>
          <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '10px' }}>Reload Page</button>
        </div>
      );
    }
    return this.props.children; 
  }
}

// --- ROOT COMPONENT ---
const Root = () => {
    const { firebaseUser, loading, isUnverified } = useAuth();
    const location = useLocation(); 

    if (loading) {
        return (
            <div className="min-h-screen bg-[#1c2128] flex flex-col items-center justify-center text-white">
                 <div className="animate-spin h-10 w-10 border-4 border-[#4a7a7d] border-t-transparent rounded-full mb-4"></div>
                 <p style={{ fontFamily: 'sans-serif' }}>Initializing...</p>
            </div>
        );
    }

    // 1. PUBLIC ROUTES 
    if (location.pathname === '/register') return <Register />;
    if (location.pathname === '/forgot-password') return <ForgotPassword />;

    // 2. VERIFICATION GUARD (New!)
    // If logged in BUT not verified, show the verify screen.
    if (isUnverified) {
        return <VerifyEmailScreen />;
    }

    // 3. AUTH GUARD
    // If verified user exists -> App
    // If no user -> Login
    return firebaseUser ? <App /> : <Login />;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <BrowserRouter>
                <AuthProvider>
                    <Root />
                </AuthProvider>
            </BrowserRouter>
        </GoogleOAuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);