/**
 * Push Notifications Service for AcademiaZen
 * 
 * This module handles:
 * - Requesting notification permissions
 * - Subscribing to push notifications via Service Worker
 * - Communicating with the backend server
 * - Managing local notifications
 */

// Backend API URL - uses env variable or falls back to production Render URL
const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'https://academiazen-backend-g6to.onrender.com';

// Cache the VAPID public key
let cachedVapidKey: string | null = null;

/**
 * Check if the device is online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Check if push notifications are supported in this browser
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 
         'PushManager' in window && 
         'Notification' in window;
}

/**
 * Get the current notification permission status
 */
export function getPermissionStatus(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  console.log('[Push] Permission status:', permission);
  return permission;
}

/**
 * Convert a base64 string to Uint8Array (required for applicationServerKey)
 */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

/**
 * Fetch with timeout helper
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get the VAPID public key from the backend
 */
async function getVapidPublicKey(): Promise<string> {
  if (cachedVapidKey) {
    console.log('[Push] Using cached VAPID key');
    return cachedVapidKey;
  }

  console.log('[Push] Fetching VAPID key from backend (may take a moment if server is waking up)...');
  
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/vapid-public-key`, {}, 30000);
    if (!response.ok) {
      throw new Error('Failed to get VAPID key');
    }
    const data = await response.json();
    cachedVapidKey = data.publicKey;
    console.log('[Push] VAPID key received successfully');
    return data.publicKey;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Push] Backend timeout - server may be sleeping');
      throw new Error('Backend server is waking up. Please try again in a moment.');
    }
    console.error('[Push] Failed to get VAPID key:', error);
    throw error;
  }
}

/**
 * Get the service worker registration with timeout
 */
async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  console.log('[Push] Waiting for service worker...');
  
  // Add timeout to prevent hanging forever
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Service worker not ready. Try refreshing the page.')), 10000);
  });
  
  try {
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      timeoutPromise
    ]);
    console.log('[Push] Service worker is ready');
    return registration;
  } catch (error) {
    console.error('[Push] Service worker timeout:', error);
    throw error;
  }
}

/**
 * Get the current push subscription (if any)
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  try {
    const registration = await getServiceWorkerRegistration();
    const subscription = await registration.pushManager.getSubscription();
    return subscription;
  } catch (error) {
    console.error('[Push] Failed to get subscription:', error);
    return null;
  }
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    console.warn('[Push] Push notifications not supported');
    return null;
  }

  // First, request permission if not already granted
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    console.warn('[Push] Notification permission not granted');
    return null;
  }

  try {
    console.log('[Push] Getting service worker registration...');
    const registration = await getServiceWorkerRegistration();
    console.log('[Push] Service worker ready');
    
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    console.log('[Push] Existing subscription:', subscription ? 'yes' : 'no');
    
    if (!subscription) {
      // Get VAPID key and subscribe
      console.log('[Push] Creating new subscription...');
      const vapidPublicKey = await getVapidPublicKey();
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      console.log('[Push] Subscribing to push manager...');
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // Required: notifications must be visible to user
        applicationServerKey
      });

      console.log('[Push] Successfully subscribed:', subscription.endpoint);
    }

    // Send subscription to backend
    await sendSubscriptionToServer(subscription);

    return subscription;
  } catch (error) {
    console.error('[Push] Subscription failed:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const subscription = await getCurrentSubscription();
    
    if (subscription) {
      // Notify backend
      await removeSubscriptionFromServer(subscription.endpoint);
      
      // Unsubscribe locally
      await subscription.unsubscribe();
      console.log('[Push] Successfully unsubscribed');
    }

    return true;
  } catch (error) {
    console.error('[Push] Unsubscribe failed:', error);
    return false;
  }
}

/**
 * Send the subscription to the backend server
 */
async function sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  console.log('[Push] Sending subscription to server...');
  
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
      }),
    }, 15000);

    if (!response.ok) {
      throw new Error('Failed to register subscription on server');
    }

    console.log('[Push] Subscription sent to server successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[Push] Server timeout, but subscription created locally');
    } else {
      console.error('[Push] Failed to send subscription to server:', error);
    }
    // Don't throw - subscription still works locally
  }
}

/**
 * Remove subscription from the backend server
 */
async function removeSubscriptionFromServer(endpoint: string): Promise<void> {
  console.log('[Push] Removing subscription from server...');
  
  try {
    await fetchWithTimeout(`${API_BASE_URL}/api/unsubscribe`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ endpoint }),
    }, 10000);
  } catch (error) {
    console.error('[Push] Failed to remove subscription from server:', error);
  }
}

/**
 * Show a local notification (doesn't require push subscription)
 */
export async function showLocalNotification(
  title: string,
  options?: NotificationOptions
): Promise<boolean> {
  if (getPermissionStatus() !== 'granted') {
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      return false;
    }
  }

  try {
    const registration = await getServiceWorkerRegistration();
    await registration.showNotification(title, {
      icon: '/icons/icon-192x192.svg',
      badge: '/icons/icon-72x72.svg',
      ...options,
    });
    return true;
  } catch (error) {
    console.error('[Push] Failed to show notification:', error);
    return false;
  }
}

/**
 * Request backend to send a push notification
 * (Useful for testing or for triggering notifications from frontend actions)
 */
export async function sendPushNotification(
  title: string,
  body: string,
  options?: {
    icon?: string;
    url?: string;
    data?: Record<string, unknown>;
  }
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
        ...options,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('[Push] Failed to send push notification:', error);
    return false;
  }
}

/**
 * Schedule a notification for a specific time
 */
export async function scheduleNotification(
  title: string,
  body: string,
  scheduledTime: Date,
  options?: {
    icon?: string;
    url?: string;
  }
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/schedule-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
        scheduledTime: scheduledTime.toISOString(),
        ...options,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('[Push] Failed to schedule notification:', error);
    return false;
  }
}

/**
 * Send immediate notification when a new task is added that's due within 3 days
 * @param task - The newly added task
 * @returns true if notification was sent, false otherwise
 */
export async function notifyNewTask(
  task: { id: string; title: string; dueDate?: string }
): Promise<boolean> {
  try {
    // Check if offline
    if (!isOnline()) {
      console.log('[Push] Offline, skipping server notification');
      // Still show local notification if possible
      if (getPermissionStatus() === 'granted') {
        const dueDate = new Date(task.dueDate || '');
        const now = new Date();
        const hoursUntilDue = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60));
        const daysUntilDue = Math.round(hoursUntilDue / 24);
        let timeText = daysUntilDue <= 1 ? 'tomorrow' : `in ${daysUntilDue} days`;
        
        await showLocalNotification('📋 New Task Added', {
          body: `"${task.title}" is due ${timeText}`,
          tag: `new-task-${task.id}`,
        });
      }
      return false;
    }

    // Check if task has a due date
    if (!task.dueDate) {
      console.log('[Push] Task has no due date, skipping notification');
      return false;
    }

    // Check if due within 3 days
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    if (dueDate <= now || dueDate > threeDaysFromNow) {
      console.log('[Push] Task not within 3-day window, skipping immediate notification');
      return false;
    }

    const subscription = await getCurrentSubscription();
    if (!subscription) {
      console.log('[Push] No subscription, skipping notification');
      return false;
    }

    const response = await fetch(`${API_BASE_URL}/api/notify-new-task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task,
        subscriptionEndpoint: subscription.endpoint,
      }),
    });

    if (response.ok) {
      console.log('[Push] Immediate notification sent for new task');
    }
    return response.ok;
  } catch (error) {
    console.error('[Push] Failed to send immediate task notification:', error);
    return false;
  }
}

/**
 * Sync tasks with backend for deadline reminders
 * Tasks due within 3 days will trigger notifications every 2 hours
 */
export async function syncTasksWithBackend(
  tasks: Array<{ id: string; title: string; dueDate: string; completed: boolean }>
): Promise<boolean> {
  try {
    const subscription = await getCurrentSubscription();
    if (!subscription) {
      console.log('[Push] No subscription, skipping task sync');
      return false;
    }

    const response = await fetch(`${API_BASE_URL}/api/sync-tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tasks,
        subscriptionEndpoint: subscription.endpoint,
      }),
    });

    if (response.ok) {
      console.log('[Push] Tasks synced with backend for deadline reminders');
    }
    return response.ok;
  } catch (error) {
    console.error('[Push] Failed to sync tasks:', error);
    return false;
  }
}

/**
 * Notification types for the app
 */
export type ZenNotificationType = 
  | 'task_reminder'
  | 'deadline_alert'
  | 'focus_complete'
  | 'daily_briefing'
  | 'study_reminder'
  | 'flashcard_review';

/**
 * Send a typed notification for the ZEN app
 */
export async function sendZenNotification(
  type: ZenNotificationType,
  data?: Record<string, unknown>
): Promise<boolean> {
  const notifications: Record<ZenNotificationType, { title: string; body: string; url: string }> = {
    task_reminder: {
      title: '📋 Task Reminder',
      body: 'You have tasks waiting to be completed!',
      url: '/?page=home',
    },
    deadline_alert: {
      title: '⚠️ Deadline Alert',
      body: 'A deadline is approaching soon!',
      url: '/?page=calendar',
    },
    focus_complete: {
      title: '🎉 Focus Session Complete!',
      body: 'Great work! Time for a well-deserved break.',
      url: '/?page=focus',
    },
    daily_briefing: {
      title: '☀️ Good Morning!',
      body: 'Here\'s your daily study briefing.',
      url: '/?page=home',
    },
    study_reminder: {
      title: '📚 Study Time',
      body: 'Time to hit the books! Your scheduled study session is starting.',
      url: '/?page=focus',
    },
    flashcard_review: {
      title: '🎴 Flashcard Review',
      body: 'You have flashcards ready for review!',
      url: '/?page=review',
    },
  };

  const notification = notifications[type];
  if (!notification) {
    console.error('[Push] Unknown notification type:', type);
    return false;
  }

  // For local notifications (like focus complete), show immediately
  if (type === 'focus_complete') {
    return showLocalNotification(notification.title, {
      body: notification.body,
      data: { url: notification.url, ...data },
    });
  }

  // For server-triggered notifications
  return sendPushNotification(notification.title, notification.body, {
    url: notification.url,
    data,
  });
}
