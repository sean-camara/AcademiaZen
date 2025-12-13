// src/hooks/useNotifications.jsx
import { useEffect, useRef } from 'react';

export function useNotifications(tasks) {
  // Store the timestamp of the LAST notification for each task
  const lastNotifiedRef = useRef({});

  useEffect(() => {
    // 1. Request Permission immediately
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
    
    // 2. Register the Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .catch(err => console.error('SW Reg Failed', err));
    }
  }, []);

  useEffect(() => {
    const checkTasks = () => {
      if (Notification.permission !== 'granted') return;

      const now = Date.now();
      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000; // 3 Days window
      const TWO_HOURS_MS = 2 * 60 * 60 * 1000;       // 2 Hours cooldown

      tasks.forEach(task => {
        const taskDueTime = new Date(task.date).getTime();
        const timeUntilDue = taskDueTime - now;

        // Logic: Due within 3 days AND in the future
        if (timeUntilDue > 0 && timeUntilDue <= THREE_DAYS_MS) {
          
          const lastTime = lastNotifiedRef.current[task.id] || 0;

          // Check if 2 hours have passed since last notify
          if (now - lastTime >= TWO_HOURS_MS) {
            
            sendNotification(task, timeUntilDue);
            
            // Remember we just notified them
            lastNotifiedRef.current[task.id] = now;
          }
        }
      });
    };

    // Check every minute
    const interval = setInterval(checkTasks, 60000); 
    return () => clearInterval(interval);
  }, [tasks]);

  const sendNotification = (task, timeLeftMs) => {
    if ('serviceWorker' in navigator) {
      // Calculate readable time
      const daysLeft = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24));
      const hoursLeft = Math.floor((timeLeftMs / (1000 * 60 * 60)) % 24);
      const timeString = daysLeft > 0 
        ? `${daysLeft} days and ${hoursLeft} hours` 
        : `${hoursLeft} hours`;

      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(`⚠️ Don't miss your due: ${task.title}`, {
          body: `Time is running out! Only ${timeString} left.`,
          icon: '/pwa-192x192.png', // Ensure this icon exists in public/
          badge: '/pwa-192x192.png',
          vibrate: [500, 200, 500],
          tag: `reminder-${task.id}`,
          data: { url: '/' }
        });

        // Play the sound
        const audio = new Audio('/notify.wav');
        audio.play().catch(e => console.log("Audio waiting for interaction"));
      });
    }
  };
}