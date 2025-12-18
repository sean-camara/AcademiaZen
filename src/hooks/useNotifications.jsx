// src/hooks/useNotifications.jsx
import { useEffect, useRef } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { firebaseApp } from '../lib/firebase';

export function useNotifications(tasks, accessToken) {
  const lastNotifiedRef = useRef({});

  // 1) register SW (only if not already registered)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then(reg => console.log('✅ Firebase messaging SW registered:', reg.scope))
        .catch(err => console.error('❌ SW registration failed', err));
    }
  }, []);

  // 2) Request permission + get FCM token (ensure service worker is ready/active)
  useEffect(() => {
    if (!accessToken) return; // wait for backend auth token
    let mounted = true;

    const setupFCM = async () => {
      if (!('Notification' in window)) return;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Notifications not granted');
        return;
      }

      try {
        const messaging = getMessaging(firebaseApp);

        // WAIT for a service worker to be active for this scope
        const registration = await navigator.serviceWorker.ready;
        console.log('ServiceWorker ready (used for FCM):', registration);

        const fcmToken = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: registration
        });

        console.log('🔑 VAPID:', import.meta.env.VITE_FIREBASE_VAPID_KEY);
        console.log('🔥 FCM TOKEN:', fcmToken);

        if (!fcmToken) {
          console.warn('getToken returned null — no token obtained');
          return;
        }

        // prevent duplicate registration
        const stored = localStorage.getItem('fcmToken');
        if (stored === fcmToken) {
          console.log('FCM token already stored');
          return;
        }

        // send to backend
        const res = await fetch('http://localhost:5000/push/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({ token: fcmToken })
        });

        if (!res.ok) {
          console.warn('Backend push/register failed', await res.text());
        } else {
          localStorage.setItem('fcmToken', fcmToken);
          console.log('✅ FCM token registered with backend and saved locally');
        }

        // foreground messages
        onMessage(messaging, payload => {
          console.log('📩 Foreground FCM message:', payload);
        });
      } catch (err) {
        console.error('Error setting up FCM:', err);
      }
    };

    setupFCM();

    return () => { mounted = false; };
  }, [accessToken]);

  // 3) local fallback notifications (no change)
  useEffect(() => {
    if (Notification.permission !== 'granted') return;

    const checkTasks = () => {
      const now = Date.now();
      const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
      const TWO_HOURS = 2 * 60 * 60 * 1000;

      tasks.forEach(task => {
        if (!task?.date) return;
        const due = new Date(task.date).getTime();
        const remaining = due - now;
        if (remaining > 0 && remaining <= THREE_DAYS) {
          const last = lastNotifiedRef.current[task.id] || 0;
          if (now - last >= TWO_HOURS) {
            new Notification(`⚠️ ${task.title}`, {
              body: 'Upcoming deadline',
              icon: '/pwa-192x192.png'
            });
            lastNotifiedRef.current[task.id] = now;
          }
        }
      });
    };

    const interval = setInterval(checkTasks, 60000);
    return () => clearInterval(interval);
  }, [tasks]);
}
