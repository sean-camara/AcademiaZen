import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth, googleProvider } from '../lib/firebase';
import api from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Backend user
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUnverified, setIsUnverified] = useState(false);

  // 🔴 FIX: accessToken MUST be state
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem('accessToken')
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);

      if (currentUser) {
        if (!currentUser.emailVerified) {
          setIsUnverified(true);
          setLoading(false);
          return;
        }

        try {
          const idToken = await currentUser.getIdToken(true);
          const res = await api.post('/auth/firebase-login', { idToken });

          setUser(res.data.user);

          // 🔴 FIX: update BOTH localStorage and state
          localStorage.setItem('accessToken', res.data.token);
          setAccessToken(res.data.token);

          setIsUnverified(false);
        } catch (err) {
          console.error("Backend login failed:", err);
          setUser(null);
        }
      } else {
        setUser(null);
        setFirebaseUser(null);
        setIsUnverified(false);

        localStorage.removeItem('accessToken');
        setAccessToken(null); // 🔴 FIX
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // --- ACTIONS ---

  const loginEmail = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (!cred.user.emailVerified) {
      setIsUnverified(true);
      throw new Error("Email not verified");
    }

    const idToken = await cred.user.getIdToken(true);
    const res = await api.post('/auth/firebase-login', { idToken });

    setUser(res.data.user);
    localStorage.setItem('accessToken', res.data.token);
    setAccessToken(res.data.token); // 🔴 FIX
  };

  const registerEmail = async (email, password) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(cred.user);
    setIsUnverified(true);
  };

  const loginGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();

    const res = await api.post('/auth/firebase-login', { idToken });

    setUser(res.data.user);
    localStorage.setItem('accessToken', res.data.token);
    setAccessToken(res.data.token); // 🔴 FIX
  };

  const resetPassword = async (email) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem('accessToken');
    setAccessToken(null); // 🔴 FIX
    setUser(null);
    setFirebaseUser(null);
    setIsUnverified(false);
  };

  const resendVerification = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      firebaseUser,
      accessToken, // 🔴 FIX: EXPOSE IT
      loading,
      isUnverified,
      loginEmail,
      registerEmail,
      loginGoogle,
      resetPassword,
      logout,
      resendVerification
    }}>
      {loading ? (
        <div className="min-h-screen bg-[#1c2128] flex items-center justify-center text-slate-500">
          <div className="animate-spin h-8 w-8 border-2 border-[#4a7a7d] border-t-transparent rounded-full mr-3"></div>
          Connecting...
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
