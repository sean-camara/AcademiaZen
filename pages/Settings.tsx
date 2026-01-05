import React, { useState } from 'react';
import { useZen } from '../context/ZenContext';
import { IconX } from '../components/Icons';
import { AMBIENCE_OPTIONS, FOCUS_DURATIONS } from '../constants';
import { usePushNotifications } from '../hooks/usePushNotifications';

interface SettingsProps {
    onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { state, updateSettings, updateProfile, clearData } = useZen();
  const [activeTab, setActiveTab] = useState<'focus' | 'profile' | 'notifications' | 'data'>('focus');
  
  // Push notifications hook
  const { 
    isSupported: pushSupported,
    permission: pushPermission,
    isSubscribed: isPushSubscribed,
    isLoading: pushLoading,
    error: pushError,
    subscribe: subscribeToPush,
    unsubscribe: unsubscribeFromPush,
    showNotification: testNotification
  } = usePushNotifications();

  // Handle push notification toggle
  const handlePushToggle = async () => {
    console.log('[Settings] Toggle clicked, isPushSubscribed:', isPushSubscribed);
    try {
      if (isPushSubscribed) {
        console.log('[Settings] Unsubscribing...');
        await unsubscribeFromPush();
        updateSettings({ notifications: false });
        console.log('[Settings] Unsubscribed successfully');
      } else {
        console.log('[Settings] Subscribing...');
        const success = await subscribeToPush();
        console.log('[Settings] Subscribe result:', success);
        if (success) {
          updateSettings({ notifications: true });
        }
      }
    } catch (err) {
      console.error('[Settings] Toggle error:', err);
    }
  };

  // Test notification
  const handleTestNotification = async () => {
    await testNotification('🧪 Test Notification', {
      body: 'Push notifications are working correctly!',
      icon: '/icons/icon-192x192.svg'
    });
  };

  const tabs = [
      { id: 'focus', label: 'Focus' },
      { id: 'notifications', label: 'Notifs' },
      { id: 'profile', label: 'Profile' },
      { id: 'data', label: 'Data' }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in p-4">
        <div className="bg-zen-bg w-full max-w-md max-h-[90vh] rounded-3xl overflow-hidden border border-zen-surface shadow-2xl flex flex-col">
            
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-zen-surface">
                <h2 className="text-xl font-medium text-zen-text-primary">Settings</h2>
                <button onClick={onClose} className="text-zen-text-secondary hover:text-zen-text-primary">
                    <IconX className="w-6 h-6" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zen-surface">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 py-4 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.id ? 'border-zen-primary text-zen-primary' : 'border-transparent text-zen-text-secondary hover:text-zen-text-primary'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
                
                {/* Focus Settings */}
                {activeTab === 'focus' && (
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-sm text-zen-text-secondary uppercase tracking-wide">Default Duration</label>
                            <div className="flex gap-3">
                                {FOCUS_DURATIONS.map(dur => (
                                    <button
                                        key={dur}
                                        onClick={() => updateSettings({ focusDuration: dur })}
                                        className={`flex-1 py-2 rounded-lg border ${state.settings.focusDuration === dur ? 'bg-zen-surface border-zen-primary text-zen-primary' : 'border-zen-surface text-zen-text-secondary'}`}
                                    >
                                        {dur} min
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                            <span className="text-zen-text-primary">Auto-start Breaks</span>
                            <button 
                                onClick={() => updateSettings({ autoBreak: !state.settings.autoBreak })}
                                className={`w-12 h-6 rounded-full p-1 transition-colors ${state.settings.autoBreak ? 'bg-zen-primary' : 'bg-zen-surface'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${state.settings.autoBreak ? 'translate-x-6' : ''}`} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Profile Settings */}
                {activeTab === 'profile' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                             <label className="text-xs text-zen-text-secondary">Name</label>
                             <input 
                                type="text" 
                                value={state.profile.name}
                                onChange={e => updateProfile({ name: e.target.value })}
                                className="w-full bg-zen-card rounded-lg p-3 text-zen-text-primary border border-zen-surface focus:border-zen-primary focus:outline-none"
                             />
                        </div>
                        <div className="space-y-2">
                             <label className="text-xs text-zen-text-secondary">University / School</label>
                             <input 
                                type="text" 
                                value={state.profile.university}
                                onChange={e => updateProfile({ university: e.target.value })}
                                className="w-full bg-zen-card rounded-lg p-3 text-zen-text-primary border border-zen-surface focus:border-zen-primary focus:outline-none"
                             />
                        </div>
                        <div className="flex items-center justify-between pt-2">
                            <span className="text-zen-text-primary text-sm">Daily Quote</span>
                            <button 
                                onClick={() => updateProfile({ quoteEnabled: !state.profile.quoteEnabled })}
                                className={`w-12 h-6 rounded-full p-1 transition-colors ${state.profile.quoteEnabled ? 'bg-zen-primary' : 'bg-zen-surface'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${state.profile.quoteEnabled ? 'translate-x-6' : ''}`} />
                            </button>
                        </div>
                    </div>
                )}

                 {/* Notifications Settings */}
                 {activeTab === 'notifications' && (
                    <div className="space-y-6">
                        {/* Push Notification Status */}
                        {!pushSupported ? (
                          <div className="p-4 rounded-xl bg-zen-destructive/10 border border-zen-destructive/30">
                            <p className="text-zen-destructive text-sm">
                              Push notifications are not supported in this browser.
                            </p>
                          </div>
                        ) : pushPermission === 'denied' ? (
                          <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                            <p className="text-yellow-400 text-sm">
                              Notifications are blocked. Please enable them in your browser settings.
                            </p>
                          </div>
                        ) : null}
                        
                        {pushError && (
                          <div className="p-3 rounded-lg bg-zen-destructive/10 text-zen-destructive text-sm">
                            {pushError}
                          </div>
                        )}

                        {/* Loading hint when toggle is in progress */}
                        {pushLoading && (
                          <div className="p-3 rounded-lg bg-zen-primary/10 border border-zen-primary/30">
                            <p className="text-zen-primary text-sm">
                              ⏳ Connecting to server... This may take a moment.
                            </p>
                          </div>
                        )}

                        {/* Main Push Toggle */}
                        <div className="flex items-center justify-between">
                            <div>
                              <span className="text-zen-text-primary text-sm block">Push Notifications</span>
                              <span className="text-zen-text-disabled text-xs">
                                {pushLoading ? 'Connecting...' : isPushSubscribed ? 'Subscribed' : 'Not subscribed'}
                              </span>
                            </div>
                            <button 
                                onClick={handlePushToggle}
                                disabled={pushLoading || !pushSupported || pushPermission === 'denied'}
                                className={`w-12 h-6 rounded-full p-1 transition-colors disabled:opacity-50 ${isPushSubscribed ? 'bg-zen-primary' : 'bg-zen-surface'}`}
                            >
                                {pushLoading ? (
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                                ) : (
                                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isPushSubscribed ? 'translate-x-6' : ''}`} />
                                )}
                            </button>
                        </div>

                        {/* Test Notification Button */}
                        {isPushSubscribed && (
                          <button 
                            onClick={handleTestNotification}
                            className="w-full py-2 rounded-lg bg-zen-surface text-zen-text-secondary text-sm hover:bg-zen-card transition-colors"
                          >
                            🧪 Send Test Notification
                          </button>
                        )}

                        <div className="border-t border-zen-surface pt-4">
                          <p className="text-xs text-zen-text-disabled mb-4">Notification Types</p>
                          
                          {[
                             { key: 'deadlineAlerts', label: 'Deadline Alerts', desc: 'Get reminded before tasks are due' },
                             { key: 'dailyBriefing', label: 'Daily Briefing (08:00)', desc: 'Morning summary of your day' },
                             { key: 'studyReminders', label: 'Study Reminders (18:00)', desc: 'Evening reminder to study' },
                         ].map(item => (
                            <div key={item.key} className="flex items-center justify-between py-3">
                                <div>
                                  <span className="text-zen-text-primary text-sm block">{item.label}</span>
                                  <span className="text-zen-text-disabled text-xs">{item.desc}</span>
                                </div>
                                <button 
                                    onClick={() => updateSettings({ [item.key]: !state.settings[item.key as keyof typeof state.settings] })}
                                    disabled={!isPushSubscribed}
                                    className={`w-12 h-6 rounded-full p-1 transition-colors disabled:opacity-50 ${(state.settings as any)[item.key] ? 'bg-zen-primary' : 'bg-zen-surface'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${(state.settings as any)[item.key] ? 'translate-x-6' : ''}`} />
                                </button>
                            </div>
                         ))}
                        </div>
                    </div>
                )}

                {/* Data Settings */}
                {activeTab === 'data' && (
                    <div className="space-y-4">
                        <button className="w-full py-3 rounded-xl bg-zen-card text-zen-text-primary border border-zen-surface hover:bg-zen-surface transition-colors text-sm">
                            Export Data (JSON)
                        </button>
                         <button className="w-full py-3 rounded-xl bg-zen-card text-zen-text-primary border border-zen-surface hover:bg-zen-surface transition-colors text-sm">
                            Clear Cache
                        </button>
                        <div className="pt-4 border-t border-zen-surface">
                             <button 
                                onClick={() => { if(window.confirm('Are you sure? This cannot be undone.')) clearData(); }}
                                className="w-full py-3 rounded-xl bg-zen-destructive/10 text-zen-destructive border border-zen-destructive/30 hover:bg-zen-destructive/20 transition-colors text-sm font-medium"
                             >
                                Delete Account & Data
                            </button>
                            <p className="text-xs text-zen-text-disabled text-center mt-2">
                                Warning: This action is irreversible.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default Settings;