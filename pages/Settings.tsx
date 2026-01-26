import React, { useState, useEffect } from 'react';
import { useZen } from '../context/ZenContext';
import { IconX, IconLogOut, IconCheck, IconSettings, IconBot, IconFocus, IconLibrary } from '../components/Icons';
import { AMBIENCE_OPTIONS, FOCUS_DURATIONS } from '../constants';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { auth } from '../firebase';
import ConfirmModal from '../components/ConfirmModal';

interface SettingsProps {
    onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { state, updateSettings, updateProfile, clearData } = useZen();
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'focus' | 'profile' | 'notifications' | 'data'>('focus');
  
  // Local state for profile form
  const [localName, setLocalName] = useState(state.profile.name || '');
  const [localUni, setLocalUni] = useState(state.profile.university || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  
  // Confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (state.profile) {
        setLocalName(state.profile.name || '');
        setLocalUni(state.profile.university || '');
    }
  }, [state.profile]);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    setProfileSaved(false);
    
    updateProfile({ name: localName, university: localUni });
    
    try {
        await new Promise(resolve => setTimeout(resolve, 800)); 
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 3000);
    } catch (e) {
        console.error('Save failed', e);
    } finally {
        setIsSavingProfile(false);
    }
  };

  const { 
    isSupported: pushSupported,
    permission: pushPermission,
    isSubscribed: isPushSubscribed,
    isLoading: pushLoading,
    subscribe: subscribeToPush,
    unsubscribe: unsubscribeFromPush,
    showNotification: testNotification
  } = usePushNotifications();

  const handlePushToggle = async () => {
    try {
      if (isPushSubscribed) {
        await unsubscribeFromPush();
        updateSettings({ notifications: false });
      } else {
        const success = await subscribeToPush();
        if (success) {
          updateSettings({ notifications: true });
        }
      }
    } catch (err) {
      console.error('[Settings] Toggle error:', err);
    }
  };

  const tabs = [
      { id: 'focus', label: 'Focus Timer', icon: <IconFocus className="w-5 h-5" />, desc: 'Configure focus and sounds' },
      { id: 'notifications', label: 'Notifications', icon: <IconBot className="w-5 h-5" />, desc: 'Manage your alerts' },
      { id: 'profile', label: 'Profile', icon: <IconSettings className="w-5 h-5" />, desc: 'Update your personal info' },
      { id: 'data', label: 'Account', icon: <IconLibrary className="w-5 h-5" />, desc: 'Manage your data' }
  ];

  return (
    <div className="fixed inset-0 bg-zen-bg/80 backdrop-blur-2xl z-[150] flex items-center justify-center animate-fade-in md:p-10">
        <div className="bg-zen-bg w-full h-full md:max-w-6xl md:h-[80vh] md:rounded-[3rem] overflow-hidden border-none md:border border-zen-surface shadow-2xl flex flex-col md:flex-row animate-scale-in">
            
            {/* Navigation (Sidebar Desktop / Top Mobile) */}
            <div className="md:w-80 md:border-r border-zen-surface flex flex-col bg-zen-card/30">
                {/* Header (Always Visible) */}
                <div className="p-8 pb-4 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-zen-primary/20 flex items-center justify-center text-zen-primary">
                            <IconSettings className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-zen-text-primary tracking-tight">Settings</h2>
                     </div>
                     <button onClick={onClose} className="md:hidden p-2 text-zen-text-secondary bg-zen-surface rounded-full">
                        <IconX className="w-5 h-5" />
                     </button>
                </div>

                {/* Tabs Grid (Mobile) */}
                <div className="md:hidden grid grid-cols-2 gap-2 px-4 py-3 border-b border-zen-surface/30">
                     {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex flex-col items-center justify-center gap-1 py-2.5 px-3 rounded-xl transition-all ${activeTab === tab.id ? 'bg-zen-primary text-zen-bg shadow-glow' : 'bg-zen-surface text-zen-text-disabled uppercase text-[8px] font-black tracking-widest'}`}
                        >
                            <span className="text-[11px]">{tab.label}</span>
                        </button>
                     ))}
                </div>

                {/* Nav Items (Desktop) */}
                <nav className="hidden md:flex flex-col flex-1 p-6 space-y-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`group w-full flex flex-col items-start gap-1 px-6 py-5 rounded-[2rem] transition-all relative overflow-hidden ${activeTab === tab.id ? 'bg-zen-primary text-zen-bg shadow-lg shadow-zen-primary/10' : 'text-zen-text-secondary hover:bg-zen-surface hover:text-zen-text-primary'}`}
                        >
                            <span className={`text-base font-medium leading-none ${activeTab === tab.id ? 'text-zen-bg' : 'text-zen-text-primary group-hover:text-zen-primary'}`}>{tab.label}</span>
                            <span className={`text-[10px] font-medium opacity-60 leading-none ${activeTab === tab.id ? 'text-zen-bg' : 'text-zen-text-disabled'}`}>{tab.desc}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-6 md:p-8 border-t border-zen-surface/30">
                     <button 
                        onClick={signOut}
                        className="flex items-center gap-2.5 md:gap-3 w-full px-4 py-3 md:p-4 rounded-xl md:rounded-2xl bg-red-400/5 text-red-400 hover:bg-red-400/10 transition-all border border-red-400/20 group"
                     >
                        <IconLogOut className="w-4 h-4 md:w-5 md:h-5 group-hover:rotate-12 transition-transform" />
                        <span className="text-[10px] md:text-sm font-bold uppercase tracking-widest">Logout</span>
                     </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col p-6 md:p-12 lg:p-16">
                
                <div className="hidden md:flex justify-end mb-12 absolute top-10 right-10">
                    <button onClick={onClose} className="p-3 text-zen-text-secondary hover:text-zen-text-primary bg-zen-surface rounded-full transition-all hover:scale-110 active:scale-90">
                        <IconX className="w-6 h-6" />
                    </button>
                </div>

                <div className="max-w-2xl mx-auto w-full space-y-12">
                    
                    {/* Page Header (Desktop) */}
                    <div className="hidden md:block">
                         <h3 className="text-[10px] text-zen-primary font-black uppercase tracking-[0.4em] mb-3">Settings / Configuration</h3>
                         <h2 className="text-4xl lg:text-5xl font-extralight text-zen-text-primary tracking-tight">{tabs.find(t => t.id === activeTab)?.label}</h2>
                    </div>

                    {/* Content Switcher */}
                    <div className="animate-reveal">
                        
                        {/* Focus Settings */}
                        {activeTab === 'focus' && (
                            <div className="space-y-8 md:space-y-12">
                                <section>
                                    <h4 className="text-[9px] text-zen-text-disabled uppercase font-black tracking-[0.2em] mb-3 ml-2">Focus Duration</h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        {FOCUS_DURATIONS.map(dur => (
                                            <button
                                                key={dur}
                                                onClick={() => updateSettings({ focusDuration: dur })}
                                                className={`py-3 md:py-5 rounded-2xl md:rounded-[1.5rem] font-bold transition-all text-sm md:text-lg ${state.settings.focusDuration === dur ? 'bg-zen-primary text-zen-bg shadow-glow-sm scale-[1.02]' : 'bg-zen-card text-zen-text-secondary border border-zen-surface hover:border-zen-primary/30'}`}
                                            >
                                                {dur}m
                                            </button>
                                        ))}
                                    </div>
                                </section>

                                <section className="p-5 md:p-8 bg-zen-card rounded-3xl md:rounded-[2.5rem] border border-zen-surface flex items-center justify-between group hover:border-zen-primary/30 transition-all">
                                    <div className="space-y-0.5">
                                        <span className="text-base md:text-lg font-light text-zen-text-primary block">Auto-Break</span>
                                        <span className="text-[9px] md:text-[10px] text-zen-text-disabled uppercase font-black tracking-widest">Start break automatically after focus</span>
                                    </div>
                                    <button 
                                        onClick={() => updateSettings({ autoBreak: !state.settings.autoBreak })}
                                        className={`w-12 h-6 md:w-14 md:h-7 rounded-full p-1.5 transition-all ${state.settings.autoBreak ? 'bg-zen-primary shadow-glow' : 'bg-zen-surface border border-zen-surface-brighter'}`}
                                    >
                                        <div className={`w-3.5 h-3.5 md:w-4 md:h-4 bg-white rounded-full transition-transform ${state.settings.autoBreak ? 'translate-x-[140%] md:translate-x-[150%]' : ''}`} />
                                    </button>
                                </section>

                                <section>
                                    <h4 className="text-[9px] text-zen-text-disabled uppercase font-black tracking-[0.2em] mb-4 ml-2">Ambience Sounds</h4>
                                    <div className="grid grid-cols-4 gap-2 md:gap-4">
                                        {AMBIENCE_OPTIONS.map(opt => (
                                            <button 
                                                key={opt.id}
                                                onClick={() => updateSettings({ ambience: opt.id as any })}
                                                className={`aspect-square rounded-2xl md:rounded-[2rem] flex flex-col items-center justify-center gap-1.5 md:gap-2 transition-all group ${state.settings.ambience === opt.id ? 'bg-zen-primary/10 border border-zen-primary/50 text-zen-primary' : 'bg-zen-card border border-zen-surface text-zen-text-disabled hover:bg-zen-surface/50'}`}
                                            >
                                                <span className="text-xl md:text-2xl group-hover:scale-110 transition-transform">{opt.icon}</span>
                                                <span className="text-[8px] md:text-[9px] uppercase font-black tracking-widest opacity-60 px-1 text-center line-clamp-1">{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            </div>
                        )}

                        {/* Notifications Settings */}
                        {activeTab === 'notifications' && (
                            <div className="space-y-6 md:space-y-10">
                                {!pushSupported ? (
                                  <div className="p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] bg-red-400/5 border border-red-400/20 text-red-400 text-sm text-center font-light">
                                    Push notifications are not supported on this device.
                                  </div>
                                ) : (
                                    <div className={`p-5 md:p-8 rounded-3xl md:rounded-[2.5rem] border transition-all flex items-center justify-between ${isPushSubscribed ? 'bg-zen-primary/5 border-zen-primary/20 shadow-glow-sm' : 'bg-zen-card border-zen-surface'}`}>
                                        <div className="space-y-0.5">
                                            <p className="text-base md:text-lg font-light text-zen-text-primary">Push Notifications</p>
                                            <p className="text-[9px] md:text-[10px] text-zen-text-disabled uppercase font-black tracking-widest">{pushLoading ? 'Updating...' : isPushSubscribed ? 'Notifications Enabled' : 'Disabled'}</p>
                                        </div>
                                        <button 
                                            onClick={handlePushToggle}
                                            disabled={pushLoading || pushPermission === 'denied'}
                                            className={`w-12 h-6 md:w-14 md:h-7 rounded-full p-1.5 transition-all ${isPushSubscribed ? 'bg-zen-primary shadow-glow' : 'bg-zen-surface border border-zen-surface-brighter'}`}
                                        >
                                            {pushLoading ? (
                                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                                            ) : (
                                              <div className={`w-3.5 h-3.5 md:w-4 md:h-4 bg-white rounded-full transition-transform ${isPushSubscribed ? 'translate-x-[140%] md:translate-x-[150%]' : ''}`} />
                                            )}
                                        </button>
                                    </div>
                                )}

                                {isPushSubscribed && (
                                    <div className="space-y-3 md:space-y-4 pt-2 md:pt-4">
                                         {[
                                             { key: 'deadlineAlerts', label: 'Deadline Alerts', desc: 'Alerts before tasks are due' },
                                             { key: 'dailyBriefing', label: 'Morning Summary', desc: 'Daily agenda at 08:00' },
                                             { key: 'studyReminders', label: 'Study Reminders', desc: 'Evening recall reminder at 18:00' },
                                         ].map(item => (
                                            <div key={item.key} className="flex items-center justify-between p-4 md:p-6 rounded-2xl md:rounded-[2rem] bg-zen-card border border-zen-surface hover:border-zen-primary/20 transition-all">
                                                <div className="space-y-0.5">
                                                  <span className="text-sm md:text-base font-light text-zen-text-primary block">{item.label}</span>
                                                  <span className="text-[9px] md:text-[10px] text-zen-text-disabled uppercase font-black tracking-widest">{item.desc}</span>
                                                </div>
                                                <button 
                                                    onClick={() => updateSettings({ [item.key]: !state.settings[item.key as keyof typeof state.settings] })}
                                                    className={`w-12 h-6 md:w-14 md:h-7 rounded-full p-1.5 transition-all ${(state.settings as any)[item.key] ? 'bg-zen-primary shadow-glow' : 'bg-zen-surface border border-zen-surface-brighter'}`}
                                                >
                                                    <div className={`w-3.5 h-3.5 md:w-4 md:h-4 bg-white rounded-full transition-transform ${(state.settings as any)[item.key] ? 'translate-x-[140%] md:translate-x-[150%]' : ''}`} />
                                                </button>
                                            </div>
                                         ))}
                                         
                                         <button 
                                            onClick={() => testNotification('System Check', { body: 'Notifications are working correctly.' })}
                                            className="w-full mt-4 md:mt-8 py-3 md:py-4 rounded-xl md:rounded-2xl bg-zen-surface text-zen-text-disabled text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] border border-zen-surface hover:border-zen-primary/20 transition-all active:scale-95"
                                         >
                                             Send Test Notification
                                         </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Identity Settings */}
                        {activeTab === 'profile' && (
                            <div className="space-y-6 md:space-y-8">
                                <div className="grid grid-cols-1 gap-6 md:gap-8">
                                    <div className="space-y-3 md:space-y-4">
                                         <label className="text-[9px] md:text-[10px] text-zen-text-disabled uppercase tracking-[0.3em] font-black ml-4">Full Name</label>
                                         <input 
                                            type="text" 
                                            placeholder="Your Name"
                                            value={localName}
                                            onChange={e => setLocalName(e.target.value)}
                                            className="w-full bg-zen-card rounded-2xl md:rounded-[2rem] p-4 md:p-6 text-base md:text-lg text-zen-text-primary border border-zen-surface focus:border-zen-primary/50 transition-all outline-none"
                                         />
                                    </div>
                                    <div className="space-y-3 md:space-y-4">
                                         <label className="text-[9px] md:text-[10px] text-zen-text-disabled uppercase tracking-[0.3em] font-black ml-4">University / School</label>
                                         <input 
                                            type="text" 
                                            placeholder="Your University"
                                            value={localUni}
                                            onChange={e => setLocalUni(e.target.value)}
                                            className="w-full bg-zen-card rounded-2xl md:rounded-[2rem] p-4 md:p-6 text-base md:text-lg text-zen-text-primary border border-zen-surface focus:border-zen-primary/50 transition-all outline-none"
                                         />
                                    </div>
                                    <button 
                                        onClick={handleSaveProfile}
                                        disabled={isSavingProfile}
                                        className={`w-full py-4 md:py-6 rounded-2xl md:rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] md:text-xs transition-all flex items-center justify-center gap-3 relative overflow-hidden ${
                                            profileSaved 
                                            ? 'bg-zen-primary/10 text-zen-primary border border-zen-primary/50' 
                                            : 'bg-zen-primary text-zen-bg shadow-xl shadow-zen-primary/20 active:scale-[0.98]'
                                        }`}
                                    >
                                        {isSavingProfile ? (
                                            <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-zen-bg border-t-transparent rounded-full animate-spin" />
                                        ) : profileSaved ? (
                                            <>
                                                <IconCheck className="w-4 h-4 md:w-5 md:h-5" />
                                                Profile Saved Successfully
                                            </>
                                        ) : (
                                            'Save Profile'
                                        )}
                                    </button>
                                </div>
                                
                                <div className="p-5 md:p-8 bg-zen-card rounded-3xl md:rounded-[2.5rem] border border-zen-surface flex items-center justify-between hover:border-zen-primary/20 transition-all">
                                    <div className="space-y-0.5">
                                        <span className="text-base md:text-lg font-light text-zen-text-primary block">Daily Quotes</span>
                                        <span className="text-[9px] md:text-[10px] text-zen-text-disabled uppercase font-black tracking-widest">Show daily quotes on your dashboard</span>
                                    </div>
                                    <button 
                                        onClick={() => updateProfile({ quoteEnabled: !state.profile.quoteEnabled })}
                                        className={`w-12 h-6 md:w-14 md:h-7 rounded-full p-1.5 transition-all ${state.profile.quoteEnabled ? 'bg-zen-primary shadow-glow' : 'bg-zen-surface border border-zen-surface-brighter'}`}
                                    >
                                        <div className={`w-3.5 h-3.5 md:w-4 md:h-4 bg-white rounded-full transition-transform ${state.profile.quoteEnabled ? 'translate-x-[140%] md:translate-x-[150%]' : ''}`} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Core (Data) Settings */}
                        {activeTab === 'data' && (
                            <div className="space-y-6 md:space-y-8">
                                <div className="grid grid-cols-1 gap-4">
                                    <button
                                      onClick={() => {
                                        const data = JSON.stringify(state, null, 2);
                                        const blob = new Blob([data], { type: 'application/json' });
                                        const url = URL.createObjectURL(blob);
                                        const link = document.createElement('a');
                                        link.href = url;
                                        link.download = 'zen-backup.json';
                                        link.click();
                                        URL.revokeObjectURL(url);
                                      }}
                                      className="group flex flex-col items-start p-6 md:p-10 rounded-3xl md:rounded-[2.5rem] bg-zen-card border border-zen-surface hover:border-zen-primary/30 transition-all text-left relative overflow-hidden"
                                    >
                                      <span className="text-lg md:text-xl font-light text-zen-text-primary">Backup Data</span>
                                      <span className="text-[9px] md:text-[10px] text-zen-text-disabled uppercase font-black tracking-[0.2em] mt-1.5 md:mt-2">Export your app data as a JSON file</span>
                                      <div className="absolute right-6 md:right-10 top-1/2 -translate-y-1/2 opacity-5 md:opacity-10 group-hover:opacity-100 group-hover:translate-x-2 transition-all">
                                          <IconBot className="w-10 h-10 md:w-12 md:h-12" />
                                      </div>
                                    </button>
                                    
                                    <button
                                      onClick={() => clearData()}
                                      className="group flex flex-col items-start p-6 md:p-10 rounded-3xl md:rounded-[2.5rem] bg-zen-card border border-zen-surface hover:border-zen-secondary/30 transition-all text-left relative overflow-hidden"
                                    >
                                      <span className="text-lg md:text-xl font-light text-zen-text-primary">Clear App Cache</span>
                                      <span className="text-[9px] md:text-[10px] text-zen-text-disabled uppercase font-black tracking-[0.2em] mt-1.5 md:mt-2">Reset current session and clear local cache</span>
                                    </button>
                                </div>
                                
                                <div className="p-8 md:p-12 bg-red-400/5 rounded-3xl md:rounded-[3rem] border border-red-400/20 space-y-4 md:space-y-6">
                                     <div>
                                         <h4 className="text-red-400 font-black uppercase tracking-[0.3em] text-[9px] md:text-[10px]">Danger Zone</h4>
                                         <p className="text-xs md:text-sm text-zen-text-secondary mt-2 md:mt-3 font-light leading-relaxed">This will permanently delete your account and all data. This process cannot be undone.</p>
                                     </div>
                                     <button 
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl bg-red-400/10 text-red-400 font-bold text-[10px] md:text-xs uppercase tracking-widest hover:bg-red-400 hover:text-white transition-all border border-red-400/30"
                                     >
                                        Delete My Account
                                     </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        <ConfirmModal
            isOpen={showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(false)}
            onConfirm={async () => {
                try { await apiFetch('/api/account', { method: 'DELETE' }); } catch (err) {}
                try { await auth.currentUser?.delete(); } catch (err) {}
                await clearData();
                signOut();
            }}
            title="Delete Account"
            message="Are you sure you want to delete your account? This will permanently remove all your data and cannot be undone."
            confirmText="Delete Account"
            isDangerous
        />
    </div>
  );
};

export default Settings;
