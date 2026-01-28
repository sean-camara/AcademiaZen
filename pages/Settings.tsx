import React, { useState, useEffect } from 'react';
import { useZen } from '../context/ZenContext';
import { IconX, IconLogOut, IconCheck, IconSettings, IconBot, IconFocus, IconLibrary, IconCreditCard } from '../components/Icons';
import { AMBIENCE_OPTIONS, FOCUS_DURATIONS } from '../constants';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { auth } from '../firebase';
import ConfirmModal from '../components/ConfirmModal';

interface SettingsProps {
    onClose: () => void;
    initialTab?: 'focus' | 'profile' | 'notifications' | 'billing' | 'data';
}

interface BillingIntervalPlan {
  amount: number;
  currency: string;
  label: string;
  description?: string;
  interval: string;
}

interface BillingPlans {
  free: { id: string; label: string; amount: number; currency: string; interval: string };
  premium: {
    monthly: BillingIntervalPlan;
    yearly: BillingIntervalPlan;
  };
}

interface BillingInfo {
  plan: string;
  interval: string;
  status: string;
  currentPeriodEnd: string | null;
  autoRenew: boolean;
  isActive: boolean;
  effectivePlan: string;
  pendingCheckoutId: string;
}

const Settings: React.FC<SettingsProps> = ({ onClose, initialTab }) => {
  const { state, updateSettings, updateProfile, clearData } = useZen();
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'focus' | 'profile' | 'notifications' | 'billing' | 'data'>(initialTab || 'focus');
  
  // Local state for profile form
  const [localName, setLocalName] = useState(state.profile.name || '');
  const [localUni, setLocalUni] = useState(state.profile.university || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Billing state
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [billingPlans, setBillingPlans] = useState<BillingPlans | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState('');
  const [billingNotice, setBillingNotice] = useState('');
  const [billingMethodLoading, setBillingMethodLoading] = useState<'gcash' | 'bank' | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [billingCancelLoading, setBillingCancelLoading] = useState(false);
  
  // Confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelSubscription, setShowCancelSubscription] = useState(false);

  useEffect(() => {
    if (state.profile) {
        setLocalName(state.profile.name || '');
        setLocalUni(state.profile.university || '');
    }
  }, [state.profile]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

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

  const formatDate = (value: string | null) => {
    if (!value) return '-';
    try {
      return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
    } catch {
      return value;
    }
  };

  const updateBillingState = (nextBilling: BillingInfo | null) => {
    setBilling(nextBilling);
    const plan = nextBilling?.effectivePlan || 'free';
    window.dispatchEvent(new CustomEvent('billing-updated', { detail: { plan } }));
  };

  const loadBilling = async () => {
    setBillingLoading(true);
    setBillingError('');
    try {
      const [statusRes, plansRes] = await Promise.all([
        apiFetch('/api/billing/status'),
        apiFetch('/api/billing/plans'),
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        updateBillingState(statusData.billing);
        if (statusData.billing?.interval === 'yearly') {
          setSelectedInterval('yearly');
        } else if (statusData.billing?.interval === 'monthly') {
          setSelectedInterval('monthly');
        }
      }

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setBillingPlans(plansData.plans);
      }
    } catch (err) {
      console.error('[Billing] Load failed:', err);
      setBillingError('Unable to load billing details.');
    } finally {
      setBillingLoading(false);
    }
  };

  const refreshBilling = async () => {
    setBillingLoading(true);
    setBillingError('');
    try {
      const res = await apiFetch('/api/billing/refresh', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.billing) updateBillingState(data.billing);
      }
    } catch (err) {
      console.error('[Billing] Refresh failed:', err);
      setBillingError('Unable to refresh billing.');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleCheckout = async (method: 'gcash' | 'bank') => {
    setBillingMethodLoading(method);
    setBillingError('');
    try {
      const res = await apiFetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'premium',
          interval: selectedInterval,
          method,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || 'Checkout failed');
      }

      const data = await res.json();
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('Missing checkout URL');
      }
    } catch (err) {
      console.error('[Billing] Checkout error:', err);
      setBillingError('Unable to start checkout.');
    } finally {
      setBillingMethodLoading(null);
    }
  };

  const handleAutoRenewToggle = async () => {
    if (!billing) return;
    const nextValue = !billing.autoRenew;
    setBillingLoading(true);
    setBillingError('');
    try {
      const res = await apiFetch('/api/billing/auto-renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoRenew: nextValue }),
      });
      if (!res.ok) throw new Error('Update failed');
      setBilling(prev => prev ? { ...prev, autoRenew: nextValue } : prev);
    } catch (err) {
      console.error('[Billing] Auto-renew error:', err);
      setBillingError('Unable to update auto-renew.');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setBillingCancelLoading(true);
    setBillingError('');
    try {
      const res = await apiFetch('/api/billing/cancel', { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || 'Unable to cancel subscription');
      }
      const data = await res.json();
      if (data.billing) updateBillingState(data.billing);
      setBillingNotice('Subscription canceled. You will retain access until the period ends.');
    } catch (err) {
      console.error('[Billing] Cancel failed:', err);
      setBillingError('Unable to cancel subscription.');
    } finally {
      setBillingCancelLoading(false);
      setShowCancelSubscription(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billingParam = params.get('billing');
    if (!billingParam) return;

    setActiveTab('billing');
    if (billingParam === 'success') {
      setBillingNotice('Payment completed. Refreshing your plan...');
      refreshBilling();
    } else if (billingParam === 'cancel') {
      setBillingNotice('Payment canceled. You can try again anytime.');
    }

    setTimeout(() => setBillingNotice(''), 6000);
    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  useEffect(() => {
    if (activeTab !== 'billing') return;
    loadBilling();
  }, [activeTab]);

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
      { id: 'billing', label: 'Billing', icon: <IconCreditCard className="w-5 h-5" />, desc: 'Upgrade your plan' },
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

                        {/* Billing Settings */}
                        {activeTab === 'billing' && (
                            <div className="space-y-6 md:space-y-10">
                                {billingNotice && (
                                  <div className="p-4 md:p-5 rounded-2xl md:rounded-[2rem] bg-zen-primary/10 border border-zen-primary/30 text-zen-primary text-xs md:text-sm font-medium">
                                    {billingNotice}
                                  </div>
                                )}
                                {billingError && (
                                  <div className="p-4 md:p-5 rounded-2xl md:rounded-[2rem] bg-red-400/5 border border-red-400/20 text-red-400 text-xs md:text-sm font-medium">
                                    {billingError}
                                  </div>
                                )}

                                <div className="grid gap-4 md:gap-6 md:grid-cols-2">
                                    <div className="p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] bg-zen-card border border-zen-surface space-y-3 md:space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-zen-text-disabled font-black">Freemium</span>
                                            {billing?.effectivePlan === 'free' && (
                                                <span className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-zen-primary font-black">Current</span>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="text-2xl md:text-3xl font-light text-zen-text-primary">Free</h3>
                                            <p className="text-xs md:text-sm text-zen-text-secondary mt-2">Core planning, focus tools, and basic library features.</p>
                                        </div>
                                        <div className="text-[10px] md:text-[11px] text-zen-text-disabled uppercase tracking-[0.3em] font-black">
                                            Ideal for light usage
                                        </div>
                                    </div>

                                    <div className={`p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] border space-y-5 md:space-y-6 ${billing?.effectivePlan === 'premium' ? 'bg-zen-primary/5 border-zen-primary/30' : 'bg-zen-card border-zen-surface'}`}>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] md:text-[10px] uppercase tracking-[0.35em] text-zen-text-disabled font-black">Premium</span>
                                            {billing?.effectivePlan === 'premium' && (
                                                <span className="px-2.5 py-1 rounded-full bg-zen-primary/15 text-zen-primary text-[9px] md:text-[10px] uppercase tracking-[0.25em] font-black">Active</span>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-end gap-2">
                                                <span className="text-3xl md:text-4xl font-light text-zen-text-primary">
                                                  {billingPlans
                                                    ? `PHP ${Math.round((billingPlans.premium[selectedInterval].amount || 0) / 100)}`
                                                    : selectedInterval === 'yearly' ? 'PHP 1490' : 'PHP 149'}
                                                </span>
                                                <span className="text-[10px] md:text-xs text-zen-text-disabled uppercase tracking-[0.25em] font-black">
                                                    / {selectedInterval === 'yearly' ? 'year' : 'month'}
                                                </span>
                                            </div>
                                            <p className="text-xs md:text-sm text-zen-text-secondary">
                                                Full access to Zen Intelligence and advanced study workflows.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <button
                                                onClick={() => setSelectedInterval('monthly')}
                                                className={`p-4 rounded-2xl border text-left transition-all ${selectedInterval === 'monthly' ? 'bg-zen-primary/10 border-zen-primary/40 text-zen-primary shadow-glow-sm' : 'bg-zen-surface/70 border-zen-surface text-zen-text-secondary hover:border-zen-primary/30'}`}
                                            >
                                                <p className="text-[9px] uppercase tracking-[0.3em] font-black">Monthly</p>
                                                <p className="mt-2 text-xl font-light text-zen-text-primary">PHP 149</p>
                                                <p className="text-[9px] uppercase tracking-[0.3em] font-black mt-1 text-zen-text-disabled">per month</p>
                                            </button>
                                            <button
                                                onClick={() => setSelectedInterval('yearly')}
                                                className={`p-4 rounded-2xl border text-left transition-all ${selectedInterval === 'yearly' ? 'bg-zen-primary/10 border-zen-primary/40 text-zen-primary shadow-glow-sm' : 'bg-zen-surface/70 border-zen-surface text-zen-text-secondary hover:border-zen-primary/30'}`}
                                            >
                                                <p className="text-[9px] uppercase tracking-[0.3em] font-black">Yearly</p>
                                                <p className="mt-2 text-xl font-light text-zen-text-primary">PHP 1490</p>
                                                <p className="text-[9px] uppercase tracking-[0.3em] font-black mt-1 text-zen-text-disabled">per year</p>
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <button
                                                onClick={() => handleCheckout('gcash')}
                                                disabled={billingMethodLoading === 'gcash'}
                                                className="py-3.5 rounded-2xl bg-zen-primary text-zen-bg text-[10px] md:text-xs font-black uppercase tracking-[0.25em] transition-all hover:shadow-glow-sm disabled:opacity-60"
                                            >
                                                {billingMethodLoading === 'gcash' ? 'Starting...' : 'Pay with GCash'}
                                            </button>
                                            <button
                                                onClick={() => handleCheckout('bank')}
                                                disabled={billingMethodLoading === 'bank'}
                                                className="py-3.5 rounded-2xl bg-zen-surface/80 text-zen-text-primary text-[10px] md:text-xs font-black uppercase tracking-[0.25em] border border-zen-surface transition-all hover:border-zen-primary/30 disabled:opacity-60"
                                            >
                                                {billingMethodLoading === 'bank' ? 'Starting...' : 'Pay with Bank'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-5 md:p-8 rounded-3xl md:rounded-[2.5rem] bg-zen-card border border-zen-surface space-y-4 md:space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-zen-text-disabled font-black">Current Plan</p>
                                            <p className="text-lg md:text-xl font-light text-zen-text-primary mt-1">
                                                {billing?.effectivePlan === 'premium' ? 'Premium' : 'Freemium'}
                                            </p>
                                        </div>
                                        <button
                                            onClick={refreshBilling}
                                            disabled={billingLoading}
                                            className="px-4 py-2 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-[0.2em] bg-zen-surface text-zen-text-secondary border border-zen-surface hover:border-zen-primary/30 transition-all disabled:opacity-60"
                                        >
                                            {billingLoading ? 'Refreshing...' : 'Refresh'}
                                        </button>
                                    </div>

                                    <div className="grid gap-3 md:gap-4 md:grid-cols-2">
                                        <div className="p-4 md:p-5 rounded-2xl md:rounded-[2rem] bg-zen-surface border border-zen-surface">
                                            <p className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-zen-text-disabled font-black">Status</p>
                                            <p className="text-sm md:text-base font-light text-zen-text-primary mt-2 capitalize">{billing?.status || 'free'}</p>
                                        </div>
                                        <div className="p-4 md:p-5 rounded-2xl md:rounded-[2rem] bg-zen-surface border border-zen-surface">
                                            <p className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-zen-text-disabled font-black">{billing?.effectivePlan === 'premium' ? 'Renews / Expires' : 'Next Renewal'}</p>
                                            <p className="text-sm md:text-base font-light text-zen-text-primary mt-2">{formatDate(billing?.currentPeriodEnd || null)}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-4 md:p-6 rounded-2xl md:rounded-[2rem] bg-zen-surface border border-zen-surface">
                                        <div className="space-y-0.5">
                                            <p className="text-base md:text-lg font-light text-zen-text-primary">Auto Billing</p>
                                            <p className="text-[9px] md:text-[10px] text-zen-text-disabled uppercase font-black tracking-widest">
                                              Toggle to enable or disable auto renewal
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleAutoRenewToggle}
                                            disabled={billingLoading || (billing?.effectivePlan !== 'premium' && billing?.status !== 'pending')}
                                            className={`w-12 h-6 md:w-14 md:h-7 rounded-full p-1.5 transition-all ${billing?.autoRenew ? 'bg-zen-primary shadow-glow' : 'bg-zen-surface border border-zen-surface-brighter'}`}
                                        >
                                            <div className={`w-3.5 h-3.5 md:w-4 md:h-4 bg-white rounded-full transition-transform ${billing?.autoRenew ? 'translate-x-[140%] md:translate-x-[150%]' : ''}`} />
                                        </button>
                                    </div>

                                    {billing?.effectivePlan === 'premium' && billing?.status === 'active' && (
                                      <button
                                        onClick={() => setShowCancelSubscription(true)}
                                        disabled={billingCancelLoading}
                                        className="w-full py-3.5 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 text-[10px] md:text-xs font-black uppercase tracking-[0.25em] transition-all hover:bg-red-500/20 disabled:opacity-60"
                                      >
                                        {billingCancelLoading ? 'Canceling...' : 'Cancel Subscription'}
                                      </button>
                                    )}

                                    {billing?.status === 'pending' && (
                                      <div className="text-[10px] md:text-xs text-zen-text-disabled uppercase tracking-[0.3em] font-black">
                                        Payment pending. Use refresh to update your status.
                                      </div>
                                    )}
                                </div>
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

        <ConfirmModal
            isOpen={showCancelSubscription}
            onClose={() => setShowCancelSubscription(false)}
            onConfirm={handleCancelSubscription}
            title="Cancel subscription?"
            message="Your premium access will remain active until the end of your current billing period."
            confirmText="Cancel Subscription"
            cancelText="Keep Premium"
            isDangerous
        />
    </div>
  );
};

export default Settings;
