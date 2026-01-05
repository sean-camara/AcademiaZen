import React, { useEffect, useRef } from 'react';
import { ZenProvider } from './context/ZenContext';
import Layout from './components/Layout';

const App: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element for notification sound
    audioRef.current = new Audio('/sounds/notification.mp3');
    audioRef.current.volume = 0.7;

    // Listen for messages from Service Worker
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PLAY_NOTIFICATION_SOUND') {
        playNotificationSound();
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
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
      <Layout />
    </ZenProvider>
  );
};

export default App;