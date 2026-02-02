import React, { useState, useEffect } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';

const PROMPT_DISMISSED_KEY = 'zen_notification_prompt_dismissed';
const PROMPT_DELAY_MS = 3000; // Show after 3 seconds

interface NotificationPromptProps {
  onClose?: () => void;
}

const NotificationPrompt: React.FC<NotificationPromptProps> = ({ onClose }) => {
  const [show, setShow] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const { 
    isSupported, 
    permission, 
    isSubscribed, 
    subscribe,
    isLoading 
  } = usePushNotifications();

  useEffect(() => {
    // Don't show if:
    // - Still loading
    // - Not supported
    // - Already subscribed
    // - Permission denied (can't ask again)
    // - Already dismissed by user
    if (isLoading) return;
    if (!isSupported) return;
    if (isSubscribed) return;
    if (permission === 'denied') return;
    
    const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY);
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      // Show again after 7 days
      if (daysSinceDismissed < 7) return;
    }

    // Show prompt after delay
    const timer = setTimeout(() => setShow(true), PROMPT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isLoading, isSupported, isSubscribed, permission]);

  const handleEnable = async () => {
    setIsEnabling(true);
    try {
      const success = await subscribe();
      if (success) {
        localStorage.setItem(PROMPT_DISMISSED_KEY, new Date().toISOString());
        setShow(false);
        onClose?.();
      }
    } catch (err) {
      console.error('Failed to enable notifications:', err);
    } finally {
      setIsEnabling(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(PROMPT_DISMISSED_KEY, new Date().toISOString());
    setShow(false);
    onClose?.();
  };

  const handleLater = () => {
    // Don't save to localStorage - will show again next session
    setShow(false);
    onClose?.();
  };

  if (!show) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-fade-in"
        onClick={handleLater}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 animate-fade-in">
        <div 
          className="w-full max-w-sm bg-zen-card border border-zen-surface rounded-2xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header with illustration */}
          <div className="bg-gradient-to-br from-zen-primary/20 to-zen-primary/5 p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-3 bg-zen-primary/20 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-zen-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-zen-text-primary">
              Stay on Track! 🎯
            </h2>
            <p className="text-sm text-zen-text-secondary mt-1">
              Enable notifications for a better experience
            </p>
          </div>

          {/* Content */}
          <div className="p-5">
            <ul className="space-y-3 mb-5">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-sm text-zen-text-secondary">
                  <strong className="text-zen-text-primary">Task reminders</strong> before deadlines
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-sm text-zen-text-secondary">
                  <strong className="text-zen-text-primary">Focus session</strong> alerts when timer ends
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-sm text-zen-text-secondary">
                  <strong className="text-zen-text-primary">Study reminders</strong> to keep you consistent
                </span>
              </li>
            </ul>

            {/* Buttons */}
            <div className="space-y-2">
              <button
                onClick={handleEnable}
                disabled={isEnabling}
                className="w-full py-3 rounded-xl bg-zen-primary text-zen-bg font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isEnabling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-zen-bg/30 border-t-zen-bg rounded-full animate-spin" />
                    Enabling...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                    </svg>
                    Enable Notifications
                  </>
                )}
              </button>
              
              <div className="flex gap-2">
                <button
                  onClick={handleLater}
                  className="flex-1 py-2.5 rounded-xl bg-zen-surface text-zen-text-secondary hover:text-zen-text-primary transition-colors text-sm"
                >
                  Maybe Later
                </button>
                <button
                  onClick={handleDismiss}
                  className="flex-1 py-2.5 rounded-xl border border-zen-surface text-zen-text-secondary hover:text-zen-text-primary transition-colors text-sm"
                >
                  Don't Ask Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotificationPrompt;
