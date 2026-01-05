import React, { useEffect, useRef, useState } from 'react';
import { ZenProvider } from './context/ZenContext';
import Layout from './components/Layout';

const App: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    // Create audio element for notification sound
    audioRef.current = new Audio('/sounds/phone-alert-marimba-bubble-om-fx-1-00-01.mp3');
    audioRef.current.volume = 0.7;

    // Listen for messages from Service Worker
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PLAY_NOTIFICATION_SOUND') {
        playNotificationSound();
      }
    };

    // Listen for online/offline events
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

  return (
    <ZenProvider>
      {/* Offline Indicator */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500/90 text-black text-xs font-medium py-1 px-4 text-center z-50 animate-fade-in">
          📴 You're offline — Some features may be limited
        </div>
      )}
      <Layout />
    </ZenProvider>
  );
};

export default App;