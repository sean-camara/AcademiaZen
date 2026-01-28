import React, { useState, useEffect } from 'react';
import { Tab, ZenState } from '../types';
import { IconHome, IconCalendar, IconReview, IconFocus, IconLibrary, IconSettings, IconBot, IconLogOut } from './Icons';
import Home from '@/pages/Home';
import Calendar from '@/pages/Calendar';
import Review from '@/pages/Review';
import Focus from '@/pages/Focus';
import Library from '@/pages/Library';
import Settings from '@/pages/Settings';
import ZenAI from '@/pages/ZenAI';
import { useZen } from '../context/ZenContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import ConfirmModal from './ConfirmModal';

interface LayoutProps {}

const Layout: React.FC<LayoutProps> = () => {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const stored = window.localStorage.getItem('zen_active_tab') as Tab | null;
    if (stored && Object.values(Tab).includes(stored)) {
      return stored;
    }
    return Tab.Home;
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'focus' | 'profile' | 'notifications' | 'billing' | 'data' | null>(null);
  const { focusSession, hideNavbar, setHideNavbar } = useZen();
  const { signOut, user } = useAuth();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user) {
      setIsPremium(false);
      return;
    }

    (async () => {
      try {
        const res = await apiFetch('/api/billing/status');
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          const plan = data?.billing?.effectivePlan || 'free';
          setIsPremium(plan === 'premium');
        } else {
          setIsPremium(false);
        }
      } catch {
        if (active) setIsPremium(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const plan = detail?.plan || 'free';
      setIsPremium(plan === 'premium');
    };
    window.addEventListener('billing-updated', handler as EventListener);
    return () => window.removeEventListener('billing-updated', handler as EventListener);
  }, []);

  // Detect keyboard visibility using visualViewport API
  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        const keyboardOpen = window.visualViewport.height < window.innerHeight * 0.75;
        setKeyboardVisible(keyboardOpen);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }
  }, []);

  // Hide navbar when modals are open
  useEffect(() => {
    setHideNavbar(showSettings || showAI);
  }, [showSettings, showAI, setHideNavbar]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail?.tab) {
        setSettingsTab(detail.tab);
      } else {
        setSettingsTab(null);
      }
      setShowSettings(true);
    };
    window.addEventListener('open-settings', handler as EventListener);
    return () => window.removeEventListener('open-settings', handler as EventListener);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page');
    const subjectId = params.get('subject');

    if (page) {
      const pageMap: Record<string, Tab> = {
        home: Tab.Home,
        calendar: Tab.Calendar,
        review: Tab.Review,
        focus: Tab.Focus,
        library: Tab.Library,
      };
      const nextTab = pageMap[page];
      if (nextTab) setActiveTab(nextTab);
    }

    if (subjectId) {
      setActiveTab(Tab.Home);
      window.dispatchEvent(new CustomEvent('open-subject', { detail: { id: subjectId } }));
    }

    if (page || subjectId) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('zen_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!(import.meta as any).env?.PROD) return;
    let lastTag: string | null = null;
    let stopped = false;

    const checkForUpdate = async () => {
      if (stopped) return;
      try {
        const res = await fetch('/index.html', { method: 'HEAD', cache: 'no-store' });
        const tag = res.headers.get('ETag') || res.headers.get('Last-Modified');
        if (!tag) return;
        if (lastTag && tag !== lastTag) {
          window.location.reload();
          return;
        }
        lastTag = tag;
      } catch {
        // Ignore transient network errors
      }
    };

    checkForUpdate();
    const interval = window.setInterval(checkForUpdate, 60000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, []);

  const navItems = [
    { tab: Tab.Home, icon: IconHome, label: 'Home' },
    { tab: Tab.Calendar, icon: IconCalendar, label: 'Calendar' },
    { tab: Tab.Review, icon: IconReview, label: 'Review' },
    { tab: Tab.Focus, icon: IconFocus, label: 'Focus' },
    { tab: Tab.Library, icon: IconLibrary, label: 'Library' },
  ];

  return (
    <div className="flex h-screen w-full bg-zen-bg text-zen-text-primary overflow-hidden font-sans selection:bg-zen-primary/30">
      
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden lg:flex flex-col w-72 h-full border-r border-zen-surface bg-zen-bg z-30 transition-all duration-300">
        <div className="p-8 pb-4">
          <div className="flex items-center gap-3">
             <h1 className="text-2xl font-bold tracking-wide text-zen-primary">ZEN</h1>
          </div>
          {isPremium && (
            <p className="text-[9px] text-zen-primary/80 mt-1 ml-1 tracking-[0.3em] uppercase font-black">Premium</p>
          )}
          <p className="text-xs text-zen-text-disabled mt-2 ml-1 tracking-wider uppercase">Student Dashboard</p>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const isActive = activeTab === item.tab;
            const isFocusRunning = item.tab === Tab.Focus && focusSession.isActive;

            return (
              <button
                key={item.tab}
                onClick={() => setActiveTab(item.tab)}
                className={`flex items-center gap-4 px-4 py-3.5 w-full rounded-xl transition-all duration-200 group relative overflow-hidden ${
                  isActive 
                    ? 'bg-zen-surface text-zen-primary shadow-lg shadow-black/20' 
                    : 'text-zen-text-secondary hover:bg-zen-surface/50 hover:text-zen-text-primary'
                }`}
              >
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-zen-primary rounded-r-full shadow-[0_0_10px_2px_rgba(99,255,218,0.3)]"></div>}
                <item.icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'} ${isFocusRunning && !isActive ? 'animate-pulse text-zen-primary' : ''}`} />
                <span className="font-medium tracking-wide text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zen-surface/50 space-y-2 bg-gradient-to-t from-zen-bg to-transparent">
             <button 
               onClick={() => setShowAI(true)}
               className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-zen-surface/80 transition-all text-zen-secondary group border border-transparent hover:border-zen-surface"
             >
               <div className="p-1.5 bg-zen-secondary/10 rounded-lg group-hover:bg-zen-secondary/20 transition-colors">
                   <IconBot className="w-5 h-5" />
               </div>
               <div className="flex flex-col items-start">
                   <span className="text-sm font-medium">Zen AI Guide</span>
                   <span className="text-[10px] text-zen-text-disabled group-hover:text-zen-text-secondary">Ready to help</span>
               </div>
             </button>

             <button 
               onClick={() => setShowSettings(true)}
               className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-zen-surface/80 transition-all text-zen-text-secondary hover:text-zen-text-primary"
             >
               <IconSettings className="w-5 h-5" />
               <span className="text-sm font-medium">Settings</span>
             </button>

             <button 
               onClick={() => setShowLogoutConfirm(true)}
               className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-red-500/10 transition-all text-zen-text-secondary hover:text-red-400 group"
             >
               <IconLogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
               <span className="text-sm font-medium">Logout</span>
             </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT WRAPPER --- */}
      <div className="flex-1 flex flex-col h-full relative min-w-0">
        
        {/* Mobile Header (Hidden on Desktop) */}
        <header className="lg:hidden flex justify-between items-center px-6 py-4 bg-zen-bg z-10 sticky top-0 border-b border-zen-surface/20 backdrop-blur-md bg-zen-bg/90">
          <div className="flex items-center gap-2 group cursor-pointer">
             <div className="flex flex-col leading-tight">
                <h1 className="text-xl font-medium tracking-wide text-zen-primary/90">ZEN</h1>
                {isPremium && (
                  <span className="text-[9px] uppercase tracking-[0.3em] text-zen-primary/80 font-black">
                    Premium
                  </span>
                )}
             </div>
          </div>
          
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setShowAI(true)}
               className="p-2 rounded-full hover:bg-zen-surface transition-all text-zen-secondary relative active:scale-90"
             >
               <IconBot className="w-6 h-6" />
             </button>
             <button 
               onClick={() => setShowSettings(true)}
               className="p-2 rounded-full hover:bg-zen-surface transition-all text-zen-text-secondary active:scale-90"
             >
               <IconSettings className="w-6 h-6" />
             </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar relative desktop-scroll-area pb-24 lg:pb-0 scroll-smooth">
           <div className={`h-full w-full mx-auto max-w-7xl lg:px-8 lg:py-8 transition-opacity duration-300 ${activeTab === Tab.Home ? 'block animate-reveal' : 'hidden'}`}><Home /></div>
           <div className={`h-full w-full mx-auto max-w-7xl lg:px-8 lg:py-8 transition-opacity duration-300 ${activeTab === Tab.Calendar ? 'block animate-reveal' : 'hidden'}`}><Calendar /></div>
           <div className={`h-full w-full mx-auto max-w-7xl lg:px-8 lg:py-8 transition-opacity duration-300 ${activeTab === Tab.Review ? 'block animate-reveal' : 'hidden'}`}><Review /></div>
           <div className={`h-full w-full mx-auto max-w-7xl lg:px-8 lg:py-8 transition-opacity duration-300 ${activeTab === Tab.Focus ? 'block animate-reveal' : 'hidden'}`}><Focus /></div>
           <div className={`h-full w-full mx-auto max-w-7xl lg:px-8 lg:py-8 transition-opacity duration-300 ${activeTab === Tab.Library ? 'block animate-reveal' : 'hidden'}`}><Library /></div>
        </main>

        {/* Mobile Bottom Navigation (Hidden on Desktop) */}
        <nav className={`lg:hidden fixed bottom-0 left-0 right-0 bg-zen-bg/95 backdrop-blur-md border-t border-zen-surface px-4 py-2 pb-6 flex justify-around items-center z-20 transition-transform duration-300 ${hideNavbar || keyboardVisible ? 'translate-y-full' : 'translate-y-0'}`}>
          {navItems.map((item) => {
            const isActive = activeTab === item.tab;
            const isFocusRunning = item.tab === Tab.Focus && focusSession.isActive;
            
            return (
              <button
                key={item.tab}
                onClick={() => setActiveTab(item.tab)}
                className={`flex flex-col items-center gap-1 p-2 transition-all duration-300 relative ${
                  isActive ? 'text-zen-primary transform -translate-y-1' : 'text-zen-text-disabled hover:text-zen-text-secondary'
                }`}
              >
                <item.icon className={`w-6 h-6 transition-transform duration-300 ${isActive ? 'scale-110' : ''} ${isFocusRunning && !isActive ? 'animate-pulse text-zen-primary' : ''}`} />
                <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
                {isActive && (
                  <div className="absolute -bottom-1 w-1 h-1 bg-zen-primary rounded-full animate-scale-in" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Overlays */}
      {showSettings && (
        <Settings
          onClose={() => {
            setShowSettings(false);
            setSettingsTab(null);
          }}
          initialTab={settingsTab || undefined}
        />
      )}

      <ConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => signOut()}
        title="Sign out?"
        message="Are you sure you want to log out of your account?"
        confirmText="Log Out"
        cancelText="Stay"
        isDangerous
      />
      {showAI && <ZenAI onClose={() => setShowAI(false)} />}
    </div>
  );
};

export default Layout;
