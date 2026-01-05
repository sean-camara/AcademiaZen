import { useState, useEffect, useCallback } from 'react';
import {
  isPushSupported,
  getPermissionStatus,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription,
  showLocalNotification,
  sendZenNotification,
  ZenNotificationType,
} from '../utils/pushNotifications';

export interface UsePushNotificationsReturn {
  // State
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  showNotification: (title: string, options?: NotificationOptions) => Promise<boolean>;
  sendZenNotification: (type: ZenNotificationType, data?: Record<string, unknown>) => Promise<boolean>;
  refreshStatus: () => Promise<void>;
}

/**
 * React hook for managing push notifications
 */
export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported] = useState(() => isPushSupported());
  const [permission, setPermission] = useState<NotificationPermission>(() => getPermissionStatus());
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check current subscription status
  const refreshStatus = useCallback(async () => {
    if (!isSupported) {
      setIsLoading(false);
      return;
    }

    try {
      setPermission(getPermissionStatus());
      const subscription = await getCurrentSubscription();
      setIsSubscribed(!!subscription);
      setError(null);
    } catch (err) {
      console.error('[usePushNotifications] Error checking status:', err);
      setError('Failed to check notification status');
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  // Initialize on mount
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Push notifications are not supported in this browser');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const subscription = await subscribeToPush();
      
      if (subscription) {
        setIsSubscribed(true);
        setPermission('granted');
        return true;
      } else {
        // Check if permission was denied
        const currentPermission = getPermissionStatus();
        setPermission(currentPermission);
        
        if (currentPermission === 'denied') {
          setError('Notification permission was denied. Please enable it in your browser settings.');
        } else {
          setError('Failed to subscribe to notifications');
        }
        return false;
      }
    } catch (err) {
      console.error('[usePushNotifications] Subscribe error:', err);
      setError('An error occurred while enabling notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const success = await unsubscribeFromPush();
      if (success) {
        setIsSubscribed(false);
      }
      return success;
    } catch (err) {
      console.error('[usePushNotifications] Unsubscribe error:', err);
      setError('Failed to disable notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Show a local notification
  const showNotificationFn = useCallback(async (
    title: string,
    options?: NotificationOptions
  ): Promise<boolean> => {
    if (permission !== 'granted') {
      setError('Notification permission not granted');
      return false;
    }
    return showLocalNotification(title, options);
  }, [permission]);

  // Send a typed ZEN notification
  const sendZenNotificationFn = useCallback(async (
    type: ZenNotificationType,
    data?: Record<string, unknown>
  ): Promise<boolean> => {
    return sendZenNotification(type, data);
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    showNotification: showNotificationFn,
    sendZenNotification: sendZenNotificationFn,
    refreshStatus,
  };
}

export default usePushNotifications;
