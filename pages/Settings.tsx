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
  const [showManageSubscription, setShowManageSubscription] = useState(false);
  const [showExtensionConfirm, setShowExtensionConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showClearCacheConfirm, setShowClearCacheConfirm] = useState(false);
  const [extensionLoading, setExtensionLoading] = useState(false);

  // ... (Hooks and effects remain largely same but simplified calls)
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
    window.dispatchEvent(new CustomEvent('billing-updated', { detail: { plan, billing: nextBilling } }));
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
        if (statusData.billing?.interval === 'yearly') setSelectedInterval('yearly');
        else if (statusData.billing?.interval === 'monthly') setSelectedInterval('monthly');
      }

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setBillingPlans(plansData.plans);
      }
    } catch (err) {
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
      setBillingError(err instanceof Error ? err.message : 'Unable to start checkout.');
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

  const isNearExpiry = (billing: BillingInfo | null): boolean => {
    if (!billing?.currentPeriodEnd) return false;
    const expiryDate = new Date(billing.currentPeriodEnd);
    const now = new Date();
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
  };

  const canExtend = (billing: BillingInfo | null): boolean => {
    if (!billing) return false;
    return billing.isActive && !billing.autoRenew && isNearExpiry(billing);
  };

  const handleExtension = async () => {
    setExtensionLoading(true);
    setBillingError('');
    try {
      const res = await apiFetch('/api/billing/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           interval: billing?.interval || 'monthly',
           method: 'gcash',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || 'Extension failed');
      }

      const data = await res.json();
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('Missing checkout URL');
      }
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : 'Unable to extend subscription.');
    } finally {
      setExtensionLoading(false);
      setShowExtensionConfirm(false);
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
      { id: 'focus', label: 'Focus', icon: IconFocus },
      { id: 'notifications', label: 'Alerts', icon: IconBot },
      { id: 'billing', label: 'Plans', icon: IconCreditCard },
      { id: 'profile', label: 'Me', icon: IconSettings },
      { id: 'data', label: 'Data', icon: IconLibrary }
  ];

  return (
    <div className="fixed inset-0 z-[150] flex flex-col items-center justify-end md:justify-center animate-fade-in">
        {/* Backdrop */}
        <div 
            className="absolute inset-0 bg-[#050505]/60 backdrop-blur-xl transition-all" 
            onClick={onClose}
        />
        
        {/* Main Panel - Zen Control Center */}
        <div className="relative w-full md:w-auto h-[92vh] md:h-auto md:max-h-[85vh] md:aspect-[1.3/1] md:min-w-[950px] flex flex-col bg-[#0D1117]/80 backdrop-blur-2xl border-t md:border border-white/5 rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up-mobile md:animate-scale-in">
            
            {/* Header & Navigation */}
            <div className="flex-none p-6 md:p-8 md:pb-6 flex flex-col gap-6 md:gap-8 z-10 border-b border-white/5 bg-[#0D1117]/50">
                <div className="flex items-center justify-between pl-2">
                    <h2 className="text-xl md:text-2xl font-light text-white tracking-tight flex items-center gap-3">
                        <IconSettings className="w-6 h-6 text-emerald-500" />
                        Settings
                    </h2>
                    <button 
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all transform hover:rotate-90"
                    >
                        <IconX className="w-5 h-5" />
                    </button>
                </div>

                {/* Pill Navigation */}
                <div className="flex items-center justify-center">
                    <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-[#000000]/30 border border-white/5 overflow-x-auto no-scrollbar max-w-full">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`relative px-5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2.5 ${
                                    activeTab === tab.id 
                                        ? 'bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-emerald-500' : 'opacity-70'}`} />
                                {tab.label}
                                {activeTab === tab.id && (
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500 opacity-50" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 bg-gradient-to-b from-transparent to-black/20">
                <div className="max-w-4xl mx-auto space-y-8 min-h-full pb-10">
                    
                    {/* Focus Settings */}
                    {activeTab === 'focus' && (
                        <div className="animate-reveal space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Focus Duration */}
                                <section className="p-8 rounded-[2rem] bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center"><IconFocus className="w-4 h-4 text-emerald-500" /></div>
                                        <h3 className="text-base font-medium text-white">Focus Duration</h3>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        {FOCUS_DURATIONS.map(dur => (
                                            <button
                                                key={dur}
                                                onClick={() => updateSettings({ focusDuration: dur })}
                                                className={`py-4 rounded-2xl text-sm font-bold transition-all ${
                                                    state.settings.focusDuration === dur 
                                                        ? 'bg-emerald-500 text-[#091510] shadow-lg shadow-emerald-500/20 scale-[1.02]' 
                                                        : 'bg-black/20 text-gray-400 hover:bg-white/10 hover:text-white'
                                                }`}
                                            >
                                                {dur}m
                                            </button>
                                        ))}
                                    </div>
                                </section>

                                {/* Auto Break */}
                                <section className={`p-8 rounded-[2rem] border transition-all flex flex-col justify-between ${
                                    state.settings.autoBreak 
                                        ? 'bg-emerald-500/5 border-emerald-500/20' 
                                        : 'bg-white/5 border-white/5'
                                }`}>
                                   <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className={`text-base font-medium ${state.settings.autoBreak ? 'text-emerald-400' : 'text-white'}`}>Auto-Break Mode</h3>
                                            <p className="text-xs text-gray-400 mt-2 leading-relaxed">Automatically start a break timer when your focus session completes.</p>
                                        </div>
                                        <button 
                                            onClick={() => updateSettings({ autoBreak: !state.settings.autoBreak })}
                                            className={`w-12 h-7 rounded-full p-1 transition-all flex-shrink-0 ${state.settings.autoBreak ? 'bg-emerald-500' : 'bg-white/10'}`}
                                        >
                                            <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${state.settings.autoBreak ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                   </div>
                                </section>
                            </div>

                             {/* Ambience */}
                             <section className="space-y-4 pt-4">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 ml-2">Soundscapes</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {AMBIENCE_OPTIONS.map(opt => (
                                        <button 
                                            key={opt.id}
                                            onClick={() => updateSettings({ ambience: opt.id as any })}
                                            className={`p-6 rounded-[2rem] border transition-all flex flex-col items-center gap-4 group ${
                                                state.settings.ambience === opt.id 
                                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                                                    : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white hover:-translate-y-1'
                                            }`}
                                        >
                                            <span className="text-3xl filter drop-shadow-lg group-hover:scale-110 transition-transform duration-300">{opt.icon}</span>
                                            <span className="text-[10px] font-bold uppercase tracking-widest">{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                             </section>
                        </div>
                    )}

                    {/* Notification Settings */}
                    {activeTab === 'notifications' && (
                        <div className="animate-reveal space-y-6 max-w-2xl mx-auto">
                            {!pushSupported ? (
                                <div className="p-8 rounded-[2rem] bg-red-500/5 border border-red-500/20 text-red-400 text-center">
                                    <IconX className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    Push notifications are not supported on this device.
                                </div>
                            ) : (
                                <button
                                    onClick={handlePushToggle}
                                    disabled={pushLoading || pushPermission === 'denied'}
                                    className={`w-full p-8 rounded-[2rem] border transition-all flex items-center justify-between group ${
                                        isPushSubscribed 
                                            ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)]' 
                                            : 'bg-white/5 border-white/5 hover:bg-white/10'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                                            isPushSubscribed ? 'bg-emerald-500 text-black' : 'bg-white/10 text-gray-400'
                                        }`}>
                                            <IconBot className="w-6 h-6" />
                                        </div>
                                        <div className="text-left">
                                            <h3 className={`text-lg font-medium ${isPushSubscribed ? 'text-white' : 'text-gray-300'}`}>
                                                Push Notifications
                                            </h3>
                                            <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-bold">
                                                {pushLoading ? 'Updating...' : isPushSubscribed ? 'Active' : 'Disabled'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`w-14 h-8 rounded-full p-1 transition-all ${isPushSubscribed ? 'bg-emerald-500' : 'bg-white/10'}`}>
                                        <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${isPushSubscribed ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>
                                </button>
                            )}
                            
                            {isPushSubscribed && (
                                <div className="grid gap-3 pt-2">
                                     {[
                                         { key: 'deadlineAlerts', label: 'Deadline Alerts', desc: 'Get notified before tasks are due' },
                                         { key: 'dailyBriefing', label: 'Morning Brief', desc: 'Daily agenda summary at 8:00 AM' },
                                         { key: 'studyReminders', label: 'Study Nudges', desc: 'Review reminders at 6:00 PM' },
                                     ].map(item => (
                                        <div key={item.key} className="flex items-center justify-between p-6 rounded-[2rem] bg-white/5 border border-white/5">
                                            <div>
                                                <h4 className="text-sm font-medium text-white">{item.label}</h4>
                                                <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                                            </div>
                                            <button 
                                                onClick={() => updateSettings({ [item.key]: !state.settings[item.key as keyof typeof state.settings] })}
                                                className={`w-10 h-6 rounded-full p-1 transition-all ${
                                                    (state.settings as any)[item.key] ? 'bg-emerald-500' : 'bg-white/10'
                                                }`}
                                            >
                                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                                    (state.settings as any)[item.key] ? 'translate-x-4' : 'translate-x-0'
                                                }`} />
                                            </button>
                                        </div>
                                     ))}
                                     
                                     <button 
                                        onClick={() => testNotification('System Check', { body: 'Notifications are working correctly.' })}
                                        className="mt-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-all"
                                     >
                                         Send Test Notification
                                     </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Billing Settings */}
                    {activeTab === 'billing' && (
                        <div className="animate-reveal space-y-8">
                             {/* Status Messages */}
                             {(billingNotice || billingError) && (
                                <div className={`p-4 rounded-2xl text-xs font-medium text-center ${
                                    billingError ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                }`}>
                                    {billingNotice || billingError}
                                </div>
                             )}

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[500px]">
                                {/* Free Plan Card */}
                                <div className="p-10 rounded-[2.5rem] bg-[#161B22] border border-white/5 flex flex-col justify-between relative overflow-hidden group">
                                    <div className="space-y-6 relative z-10">
                                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white"><IconLibrary className="w-6 h-6" /></div>
                                        <div>
                                            <h3 className="text-4xl font-light text-white">Free</h3>
                                            <p className="text-sm text-gray-400 mt-4 leading-relaxed">Essential tools for personal study planning and focus.</p>
                                        </div>
                                    </div>
                                    <div className="absolute top-0 right-0 p-10 opacity-10 grayscale group-hover:grayscale-0 transition-all duration-500">
                                        <IconFocus className="w-32 h-32" />
                                    </div>
                                </div>

                                {/* Premium Zen Card */}
                                <div className={`p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] relative overflow-hidden flex flex-col justify-between transition-all duration-500 ${
                                    billing?.effectivePlan === 'premium' 
                                        ? 'bg-gradient-to-br from-[#0D1117] to-emerald-900/20 border border-emerald-500/30 shadow-[0_0_50px_-10px_rgba(16,185,129,0.15)]' 
                                        : 'bg-gradient-to-br from-[#0D1117] to-black border border-white/10 hover:border-emerald-500/30'
                                }`}>
                                    {/* Background decorative glow */}
                                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full pointing-events-none" />
                                    
                                    {/* Header */}
                                    <div className="relative z-10 flex justify-between items-start">
                                        <div>
                                            <h3 className="text-lg font-medium text-white flex items-center gap-2">
                                                Premium
                                                {billing?.effectivePlan === 'premium' && (
                                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-black text-[10px] font-black uppercase tracking-wider">Active</span>
                                                )}
                                            </h3>
                                            <p className="text-xs text-gray-400 mt-1">Unlock Zen Intelligence</p>
                                        </div>
                                        {/* Toggle Year/Month */}
                                        <div className="flex bg-black/40 rounded-lg p-1">
                                            {(['monthly', 'yearly'] as const).map(interval => (
                                                <button
                                                    key={interval}
                                                    onClick={() => setSelectedInterval(interval)}
                                                    className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold transition-all ${
                                                        selectedInterval === interval ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-white'
                                                    }`}
                                                >
                                                    {interval === 'yearly' ? 'Year' : 'Mo'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Price */}
                                    <div className="relative z-10 py-6 md:py-8">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-4xl md:text-5xl font-light text-white tracking-tight">
                                                ₱{selectedInterval === 'yearly' ? '1490' : '149'}
                                            </span>
                                            <span className="text-lg md:text-xl text-gray-500 font-light">
                                                /{selectedInterval === 'yearly' ? 'yr' : 'mo'}
                                            </span>
                                        </div>
                                        {selectedInterval === 'yearly' && (
                                            <p className="text-xs text-emerald-400 mt-1">Save ₱298/year (2 months free!)</p>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="relative z-10">
                                        {billing?.isActive ? (
                                            <button
                                                onClick={() => setShowManageSubscription(true)}
                                                className="w-full py-4 rounded-xl bg-white/10 text-white hover:bg-white/20 text-xs font-bold uppercase tracking-widest transition-all backdrop-blur-md"
                                            >
                                                Manage Subscription
                                            </button>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-3">
                                                 <button
                                                    onClick={() => handleCheckout('gcash')}
                                                    className="py-4 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20"
                                                 >
                                                     {billingMethodLoading === 'gcash' ? '...' : 'GCash'}
                                                 </button>
                                                 <button
                                                    onClick={() => handleCheckout('bank')}
                                                    className="py-4 rounded-xl bg-white/10 text-white hover:bg-white/20 text-xs font-bold uppercase tracking-widest transition-all"
                                                 >
                                                     {billingMethodLoading === 'bank' ? '...' : 'Bank'}
                                                 </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Premium Benefits List */}
                                <div className="bg-zen-card/50 rounded-[2rem] p-6 border border-zen-surface/50">
                                    <h3 className="text-[10px] font-bold text-zen-text-disabled uppercase tracking-widest mb-4">Premium Includes</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {/* Zen AI */}
                                        <div className="flex items-start gap-3 bg-zen-surface/30 rounded-xl p-3">
                                            <span className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">🤖</span>
                                            <div>
                                                <span className="text-zen-text-primary text-sm font-medium">Zen AI Assistant</span>
                                                <p className="text-zen-text-disabled text-xs mt-0.5">Unlimited conversations, deep reasoning mode</p>
                                            </div>
                                        </div>
                                        
                                        {/* AI Reviewer */}
                                        <div className="flex items-start gap-3 bg-zen-surface/30 rounded-xl p-3">
                                            <span className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">📝</span>
                                            <div>
                                                <span className="text-zen-text-primary text-sm font-medium">AI Quiz Generator</span>
                                                <p className="text-zen-text-disabled text-xs mt-0.5">50 questions, all types & difficulties</p>
                                            </div>
                                        </div>
                                        
                                        {/* Library */}
                                        <div className="flex items-start gap-3 bg-zen-surface/30 rounded-xl p-3">
                                            <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">📚</span>
                                            <div>
                                                <span className="text-zen-text-primary text-sm font-medium">Unlimited Library</span>
                                                <p className="text-zen-text-disabled text-xs mt-0.5">Unlimited PDFs & folders, 15MB files</p>
                                            </div>
                                        </div>
                                        
                                        {/* Reviewers */}
                                        <div className="flex items-start gap-3 bg-zen-surface/30 rounded-xl p-3">
                                            <span className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">✨</span>
                                            <div>
                                                <span className="text-zen-text-primary text-sm font-medium">10 AI Reviewers</span>
                                                <p className="text-zen-text-disabled text-xs mt-0.5">Create more quizzes from your PDFs</p>
                                            </div>
                                        </div>
                                        
                                        {/* Focus */}
                                        <div className="flex items-start gap-3 bg-zen-surface/30 rounded-xl p-3">
                                            <span className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">🎯</span>
                                            <div>
                                                <span className="text-zen-text-primary text-sm font-medium">Focus Timer</span>
                                                <p className="text-zen-text-disabled text-xs mt-0.5">All durations, ambient sounds, stats</p>
                                            </div>
                                        </div>
                                        
                                        {/* Priority Support */}
                                        <div className="flex items-start gap-3 bg-zen-surface/30 rounded-xl p-3">
                                            <span className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">💎</span>
                                            <div>
                                                <span className="text-zen-text-primary text-sm font-medium">Priority Support</span>
                                                <p className="text-zen-text-disabled text-xs mt-0.5">Fast responses, early access to features</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Free vs Premium comparison */}
                                    <div className="mt-6 pt-6 border-t border-zen-surface/50">
                                        <h4 className="text-[10px] font-bold text-zen-text-disabled uppercase tracking-widest mb-3">Free Plan Limits</h4>
                                        <div className="space-y-2 text-xs text-zen-text-disabled">
                                            <div className="flex justify-between">
                                                <span>📚 PDF Storage</span>
                                                <span>3 PDFs (2MB max each)</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>📁 Folders</span>
                                                <span>1 folder only</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>📝 AI Reviewers</span>
                                                <span>3 reviewers, Easy only</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>❓ Quiz Questions</span>
                                                <span>10 max, MC & T/F only</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>🤖 Zen AI</span>
                                                <span>Limited access</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Profile Settings */}
                    {activeTab === 'profile' && (
                        <div className="animate-reveal space-y-8 max-w-2xl mx-auto">
                            <div className="flex flex-col items-center mb-8">
                                <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-indigo-400 mb-4 shadow-2xl">
                                    <IconSettings className="w-10 h-10" />
                                </div>
                                <h3 className="text-xl text-white font-light">Student Profile</h3>
                            </div>

                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-4">Full Name</label>
                                    <input 
                                        type="text" 
                                        value={localName}
                                        onChange={e => setLocalName(e.target.value)}
                                        className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all font-light"
                                        placeholder="Enter your name"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-4">University</label>
                                    <input 
                                        type="text" 
                                        value={localUni}
                                        onChange={e => setLocalUni(e.target.value)}
                                        className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all font-light"
                                        placeholder="Where do you study?"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-6 rounded-3xl bg-white/5 border border-white/5">
                                <div>
                                    <h3 className="text-sm font-medium text-white">Daily Inspiration</h3>
                                    <p className="text-xs text-gray-500 mt-1">Show me quotes on dashboard</p>
                                </div>
                                <button 
                                    onClick={() => updateProfile({ quoteEnabled: !state.profile.quoteEnabled })}
                                    className={`w-12 h-7 rounded-full p-1 transition-all ${state.profile.quoteEnabled ? 'bg-purple-500' : 'bg-white/10'}`}
                                >
                                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${state.profile.quoteEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            <button 
                                onClick={handleSaveProfile}
                                disabled={isSavingProfile}
                                className={`w-full py-5 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 ${
                                    profileSaved 
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                                        : 'bg-white text-black hover:bg-gray-200'
                                }`}
                            >
                                {isSavingProfile ? 'Saving...' : profileSaved ? <><IconCheck className="w-4 h-4" />Saved</> : 'Save Changes'}
                            </button>
                        </div>
                    )}

                    {/* Data Settings */}
                    {activeTab === 'data' && (
                        <div className="animate-reveal space-y-8 max-w-2xl mx-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    onClick={() => {
                                        const data = JSON.stringify(state, null, 2);
                                        const blob = new Blob([data], { type: 'application/json' });
                                        const link = document.createElement('a');
                                        link.href = URL.createObjectURL(blob);
                                        link.download = 'zen-backup.json';
                                        link.click();
                                    }}
                                    className="p-8 rounded-[2rem] bg-indigo-500/10 border border-indigo-500/20 hover:border-indigo-500/50 transition-all text-left group"
                                >
                                    <IconSettings className="w-8 h-8 text-indigo-400 mb-4 group-hover:scale-110 transition-transform" />
                                    <h3 className="text-lg font-medium text-indigo-200">Export Data</h3>
                                    <p className="text-xs text-indigo-400/60 mt-2 leading-relaxed">Download a JSON backup of your current session.</p>
                                </button>
                            </div>

                            <div className="pt-8 border-t border-white/5">
                                <button 
                                    onClick={() => setShowClearCacheConfirm(true)}
                                    className="w-full py-4 rounded-xl border border-red-500/20 text-red-500/80 hover:text-red-400 hover:bg-red-500/5 text-xs font-bold uppercase tracking-widest transition-all"
                                >
                                    Clear All Data
                                </button>
                                <p className="text-[10px] text-center text-gray-600 mt-4 max-w-xs mx-auto">
                                    This will remove all your data locally and from the server. Make a backup first.
                                </p>
                                <button 
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="w-full py-4 rounded-xl border border-red-500/20 text-red-500/80 hover:text-red-400 hover:bg-red-500/5 text-xs font-bold uppercase tracking-widest transition-all"
                                >
                                    Delete Account
                                </button>
                                <p className="text-[10px] text-center text-gray-600 mt-4 max-w-xs mx-auto">
                                    Irreversible action. All your documents and history will be wiped from our servers.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="flex-none p-6 md:p-8 pt-0 border-t border-white/5 bg-[#0D1117]/80 backdrop-blur-xl">
                 <div className="flex items-center justify-between max-w-4xl mx-auto w-full pt-4 opacity-50 hover:opacity-100 transition-opacity">
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">AcademiaZen v2.0 // Student OS</span>
                    <button 
                        onClick={() => setShowLogoutConfirm(true)}
                        className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-widest flex items-center gap-2"
                    >
                        Log Out
                        <IconLogOut className="w-3 h-3" />
                    </button>
                </div>
            </div>
        </div>

        {/* Existing Modals Reused */}
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
            isOpen={showClearCacheConfirm}
            onClose={() => setShowClearCacheConfirm(false)}
            onConfirm={() => {
                clearData();
                setShowClearCacheConfirm(false);
            }}
            title="Clear all data?"
            message="This will permanently delete your tasks, subjects, reviewers, and settings from this device and the server."
            confirmText="Clear All Data"
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

        <ConfirmModal
            isOpen={showLogoutConfirm}
            onClose={() => setShowLogoutConfirm(false)}
            onConfirm={signOut}
            title="Log out?"
            message="Are you sure you want to log out of your account?"
            confirmText="Log Out"
            isDangerous
        />

        {/* Manage Subscription Modal for Active Users */}
        {showManageSubscription && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowManageSubscription(false)}>
                <div className="relative w-full max-w-lg bg-[#0D1117] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
                    <div className="p-8 pb-6 border-b border-white/5 bg-gradient-to-br from-[#161B22] to-black">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl text-white font-medium">Subscription Details</h3>
                            <button onClick={() => setShowManageSubscription(false)} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                                <IconX className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                             <div className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider border border-emerald-500/30">Premium Active</div>
                             <div className="px-3 py-1 rounded-full bg-white/5 text-gray-400 text-xs font-medium border border-white/5">{billing?.interval === 'yearly' ? 'Yearly Plan' : 'Monthly Plan'}</div>
                        </div>
                    </div>

                    <div className="p-8 space-y-6">
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">
                                    {billing?.autoRenew ? 'Renews On' : 'Expires On'}
                                </p>
                                <p className="text-lg text-white font-light">{formatDate(billing?.currentPeriodEnd || null)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">State</p>
                                <p className={`text-lg font-medium capitalize ${billing?.status === 'active' ? 'text-emerald-400' : 'text-yellow-400'}`}>{billing?.status || '-'}</p>
                            </div>
                        </div>

                         <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                            <div>
                                <p className="text-sm font-medium text-white">Auto Renewal</p>
                                <p className="text-xs text-gray-500 mt-1">{billing?.autoRenew ? 'You will be charged automatically.' : 'Subscription will end on expiry.'}</p>
                            </div>
                            <button
                                onClick={handleAutoRenewToggle}
                                disabled={billingLoading}
                                className={`w-12 h-7 rounded-full p-1 transition-all ${billing?.autoRenew ? 'bg-emerald-500' : 'bg-gray-700'}`}
                            >
                                <div className={`w-5 h-5 rounded-full shadow-sm transition-transform bg-white ${billing?.autoRenew ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {canExtend(billing) && (
                            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                                <div className="text-emerald-400 text-sm font-medium">Extend for 1 Month</div>
                                <button
                                    onClick={() => setShowExtensionConfirm(true)}
                                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#091510] text-xs font-bold uppercase tracking-wider"
                                >
                                    Extend
                                </button>
                            </div>
                        )}

                        {billing?.status === 'active' && (
                            <button
                                onClick={() => { setShowManageSubscription(false); setShowCancelSubscription(true); }}
                                className="w-full py-4 text-xs font-bold text-red-500 hover:text-red-400 uppercase tracking-widest transition-colors"
                            >
                                Cancel Subscription
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Extension Confirm Modal */}
        {showExtensionConfirm && (
             <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[210] flex items-center justify-center p-4" onClick={() => setShowExtensionConfirm(false)}>
                <div className="w-full max-w-sm bg-[#0D1117] border border-white/10 rounded-[2rem] p-8 text-center space-y-6" onClick={e => e.stopPropagation()}>
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto text-emerald-500 border border-emerald-500/20">
                        <IconCreditCard className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-white">Confirm Extension</h3>
                        <p className="text-sm text-gray-400 mt-2">Charge <strong className="text-white">PHP {billing?.interval === 'yearly' ? '1490' : '149'}</strong> to extend by 1 month?</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setShowExtensionConfirm(false)} className="py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase">Cancel</button>
                        <button 
                            onClick={handleExtension}
                            disabled={extensionLoading} 
                            className="py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase"
                        >
                            {extensionLoading ? 'Processing' : 'Confirm'}
                        </button>
                    </div>
                </div>
             </div>
        )}
    </div>
  );
};

export default Settings;
