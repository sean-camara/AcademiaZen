import React, { Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Tab, ZenState } from '../types';
import { IconHome, IconCalendar, IconReview, IconFocus, IconLibrary, IconSettings, IconBot, IconLogOut, IconChevronRight } from './Icons';
import { useZen } from '../context/ZenContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import ConfirmModal from './ConfirmModal';
import type { OpenSettingsDetail } from '../utils/appNavigation';
import { lazyWithChunkRecovery } from '../utils/chunkRecovery';
import { useOverlayHistory } from '../hooks/useOverlayHistory';

const loadHome = () => import('@/pages/Home');
const loadCalendar = () => import('@/pages/Calendar');
const loadReview = () => import('@/pages/Review');
const loadFocus = () => import('@/pages/Focus');
const loadLibrary = () => import('@/pages/Library');
const loadSettings = () => import('@/pages/Settings');
const loadZenAI = () => import('@/pages/ZenAI');
const Home = lazyWithChunkRecovery(loadHome);
const Calendar = lazyWithChunkRecovery(loadCalendar);
const Review = lazyWithChunkRecovery(loadReview);
const Focus = lazyWithChunkRecovery(loadFocus);
const Library = lazyWithChunkRecovery(loadLibrary);
const Settings = lazyWithChunkRecovery(loadSettings);
const ZenAI = lazyWithChunkRecovery(loadZenAI);

const RouteLoading = () => (
  <div className="flex h-full min-h-64 items-center justify-center" role="status" aria-live="polite">
    <div className="flex items-center gap-3 text-sm text-zen-text-secondary">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-zen-primary border-t-transparent" aria-hidden="true" />
      Loading your study space…
    </div>
  </div>
);

const SettingsLoading = () => (
  <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/75 md:items-center" role="status" aria-live="polite">
    <div className="flex h-[92vh] w-full items-center justify-center rounded-t-[2rem] border border-white/10 bg-[#0D1117] md:h-[min(780px,calc(100vh-2rem))] md:w-[min(950px,calc(100vw-2rem))] md:rounded-[2rem]">
      <div className="flex items-center gap-3 text-sm text-zen-text-secondary">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-zen-primary border-t-transparent" aria-hidden="true" />
        Opening settings…
      </div>
    </div>
  </div>
);

const AIPanelLoading = () => (
  <aside
    id="zen-ai-panel"
    className="ai-workspace fixed inset-y-0 right-0 z-[110] flex w-full items-center justify-center sm:w-[min(520px,100vw)] min-[1180px]:relative min-[1180px]:inset-auto min-[1180px]:z-30 min-[1180px]:h-full min-[1180px]:w-[420px] min-[1180px]:shrink-0 xl:w-[440px] 2xl:w-[480px]"
    aria-label="Opening Zen AI"
    aria-live="polite"
  >
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-zen-secondary border-t-transparent" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-white">Opening Zen AI</p>
        <p className="mt-1 text-xs text-zen-text-disabled">Preparing your workspace context…</p>
      </div>
    </div>
  </aside>
);

interface LayoutProps {}

interface BillingUpdatedDetail {
  plan?: string;
  billing?: {
    plan?: string;
    effectivePlan?: string;
    isActive?: boolean;
    status?: string;
  };
}

const Layout: React.FC<LayoutProps> = () => {
  const { focusSession, hideNavbar, setHideNavbar, syncConflict } = useZen();
  const { signOut, user } = useAuth();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const {
    showSettings,
    showAI,
    settingsTab,
    openSettings,
    openAI,
    closeSettings,
    closeAI,
  } = useOverlayHistory(location.key);

  useEffect(() => {
    const preload = () => {
      void Promise.allSettled([
        loadHome(),
        loadCalendar(),
        loadReview(),
        loadFocus(),
        loadLibrary(),
        loadSettings(),
        loadZenAI(),
      ]);
    };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(preload, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = globalThis.setTimeout(preload, 500);
    return () => globalThis.clearTimeout(id);
  }, []);

  const tabPaths: Record<Tab, string> = {
    [Tab.Home]: '/',
    [Tab.Calendar]: '/calendar',
    [Tab.Review]: '/review',
    [Tab.Focus]: '/focus',
    [Tab.Library]: '/library',
  };

  const pathToTab: Record<string, Tab> = {
    '/': Tab.Home,
    '/calendar': Tab.Calendar,
    '/review': Tab.Review,
    '/focus': Tab.Focus,
    '/library': Tab.Library,
  };

  const activeTab = pathToTab[location.pathname] || Tab.Home;

  const [userRole, setUserRole] = useState<'user' | 'admin'>('user');
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setIsPremium(false);
      setUserRole('user');
      return;
    }

    (async () => {
      try {
        const res = await apiFetch('/api/billing/status');
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          const plan = data?.billing?.plan || data?.billing?.effectivePlan || 'free';
          const isActive = !!data?.billing?.isActive;
          const status = data?.billing?.status || 'free';
          setIsPremium(plan === 'premium' && (isActive || status === 'canceled'));
        } else {
          setIsPremium(false);
        }

        const roleRes = await apiFetch('/api/me/role');
        if (roleRes.ok && active) {
          const roleData = await roleRes.json();
          if (roleData?.role) setUserRole(roleData.role);
        }

        const annRes = await apiFetch('/api/announcements/active');
        if (annRes.ok && active) {
          const annData = await annRes.json();
          if (Array.isArray(annData?.announcements)) setAnnouncements(annData.announcements);
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
      const detail = (event as CustomEvent<BillingUpdatedDetail>).detail || {};
      const billing = detail?.billing;
      const plan = billing?.plan || detail?.plan || billing?.effectivePlan || 'free';
      const isActive = !!billing?.isActive;
      const status = billing?.status || 'free';
      setIsPremium(plan === 'premium' && (isActive || status === 'canceled'));
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
    return undefined;
  }, []);

  // Hide navbar when modals are open
  useEffect(() => {
    setHideNavbar(showSettings || showAI);
  }, [showSettings, showAI, setHideNavbar]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<OpenSettingsDetail>).detail || {};
      openSettings(detail?.tab);
    };
    window.addEventListener('open-settings', handler as EventListener);
    return () => window.removeEventListener('open-settings', handler as EventListener);
  }, [openSettings]);

  useEffect(() => {
    if (!location.search) return;
    const params = new URLSearchParams(location.search);
    const page = params.get('page');
    const subjectId = params.get('subject');
    let nextPath = location.pathname;
    const shouldOpenSettings = page === 'settings';

    const pageRoutes: Record<string, string> = {
      home: tabPaths[Tab.Home],
      calendar: tabPaths[Tab.Calendar],
      review: tabPaths[Tab.Review],
      focus: tabPaths[Tab.Focus],
      library: tabPaths[Tab.Library],
    };

    if (page) {
      if (pageRoutes[page]) {
        nextPath = pageRoutes[page];
      }
    }

    if (subjectId) {
      nextPath = tabPaths[Tab.Home];
    }

    if (nextPath !== location.pathname || location.search) {
      navigate(nextPath, { replace: true });
    }

    if (shouldOpenSettings) {
      queueMicrotask(() => openSettings());
    }

    if (subjectId) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-subject', { detail: { id: subjectId } }));
      }, 0);
    }
  }, [location.pathname, location.search, navigate, openSettings, tabPaths]);

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
    { tab: Tab.Home, icon: IconHome, label: 'Home', path: tabPaths[Tab.Home] },
    { tab: Tab.Calendar, icon: IconCalendar, label: 'Calendar', path: tabPaths[Tab.Calendar] },
    { tab: Tab.Review, icon: IconReview, label: 'Review', path: tabPaths[Tab.Review] },
    { tab: Tab.Focus, icon: IconFocus, label: 'Focus', path: tabPaths[Tab.Focus] },
    { tab: Tab.Library, icon: IconLibrary, label: 'Library', path: tabPaths[Tab.Library] },
  ];
  const activeNavItem = navItems.find((item) => item.tab === activeTab) ?? { label: 'Home' };

  return (
    <div
      className="app-shell flex h-screen w-full overflow-hidden font-sans text-zen-text-primary selection:bg-zen-primary/30"
      data-ai-open={showAI ? 'true' : 'false'}
    >
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[200] -translate-y-24 rounded-lg bg-zen-primary px-4 py-2 font-semibold text-zen-bg transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      {syncConflict && (
        <div
          role="alert"
          className="fixed left-1/2 top-4 z-[70] flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 items-center justify-between gap-4 rounded-xl border border-amber-400/40 bg-amber-950 px-4 py-3 text-sm text-amber-50 shadow-2xl"
        >
          <span>Your study data changed in another tab or device. Saving is paused to protect both versions.</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 shrink-0 rounded-lg bg-amber-300 px-4 font-semibold text-amber-950 hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
          >
            Load latest
          </button>
        </div>
      )}
      
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className={`app-sidebar z-30 hidden h-full w-[272px] flex-col lg:flex ${showAI ? 'ai-sidebar-compact' : ''}`}>
        <div className="px-5 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <div className="brand-mark" aria-hidden="true"><img className="brand-mark-image" src="/icons/academiazen-mark.svg" alt="" /></div>
            <div className="sidebar-brand-copy min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[15px] font-bold tracking-[-0.02em] text-white">AcademiaZen</h1>
                {isPremium && <span className="plan-chip">Pro</span>}
              </div>
              <p className="mt-0.5 text-[11px] text-zen-text-disabled">Your study operating system</p>
            </div>
          </div>
        </div>

        <nav className="no-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-label="Primary navigation">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zen-text-disabled">Workspace</p>
          {navItems.map((item) => {
            const isActive = activeTab === item.tab;
            const isFocusRunning = item.tab === Tab.Focus && focusSession.isActive;

            return (
              <button
                key={item.tab}
                onClick={() => navigate(item.path)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  isActive
                    ? 'nav-item-active text-white'
                    : 'text-zen-text-secondary hover:bg-white/[0.045] hover:text-white'
                }`}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${isActive ? 'border-zen-primary/20 bg-zen-primary/10 text-zen-primary' : 'border-white/5 bg-white/[0.025] group-hover:border-white/10'} ${isFocusRunning && !isActive ? 'animate-pulse text-zen-primary' : ''}`}>
                  <item.icon className="h-[18px] w-[18px]" />
                </span>
                <span className="sidebar-nav-label text-sm font-semibold tracking-[-0.01em]">{item.label}</span>
                {isActive && <span className="sidebar-active-dot ml-auto h-1.5 w-1.5 rounded-full bg-zen-primary shadow-[0_0_12px_rgba(100,255,218,0.8)]" aria-hidden="true" />}
              </button>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-white/[0.06] p-3">
             <button 
               onClick={openAI}
               aria-label="Open Zen AI"
               aria-expanded={showAI}
               aria-controls="zen-ai-panel"
               className="ai-launch-card group flex w-full items-center gap-3 rounded-2xl p-3.5 text-left text-zen-secondary transition-colors"
             >
               <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zen-secondary/20 bg-zen-secondary/10">
                   <IconBot className="w-5 h-5" />
               </div>
               <div className="sidebar-ai-copy flex flex-col items-start">
                   <span className="text-sm font-semibold text-white">Ask Zen AI</span>
                   <span className="text-[10px] text-zen-text-disabled group-hover:text-zen-text-secondary">DeepSeek V4 Flash</span>
               </div>
               <IconChevronRight className="sidebar-ai-chevron ml-auto h-4 w-4 text-zen-text-disabled transition-transform group-hover:translate-x-0.5" />
             </button>

              {userRole === 'admin' && (
                <button
                  onClick={() => navigate('/admin')}
                  aria-label="Open Admin Console"
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-amber-500/20 transition-all shadow-lg shadow-amber-500/5 mb-1"
                >
                  <span>👑 Admin Console</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => openSettings()} onPointerEnter={loadSettings} onFocus={loadSettings} aria-label="Open settings" className="sidebar-utility"><IconSettings className="h-4 w-4" /><span>Settings</span></button>
                <button onClick={() => setShowLogoutConfirm(true)} aria-label="Sign out" className="sidebar-utility hover:!border-red-400/20 hover:!text-red-300"><IconLogOut className="h-4 w-4" /><span>Sign out</span></button>
              </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT WRAPPER --- */}
      <div className="flex-1 flex flex-col h-full relative min-w-0">
        
        {/* System Broadcast Banner */}
        {announcements.length > 0 && (
          <div className="w-full bg-gradient-to-r from-emerald-500/20 via-violet-500/20 to-emerald-500/20 border-b border-emerald-500/30 px-4 py-2 text-center text-xs font-medium text-emerald-200 flex items-center justify-center gap-2 z-30">
            <span>📢 <strong>{announcements[0].title}:</strong> {announcements[0].message}</span>
          </div>
        )}
        
        {/* Mobile Header (Hidden on Desktop) */}
        <header className="mobile-app-header sticky top-0 z-10 flex items-center justify-between px-4 py-3 lg:hidden">
          <div className="flex min-w-0 items-center gap-3">
             <div className="brand-mark brand-mark-small" aria-hidden="true"><img className="brand-mark-image" src="/icons/academiazen-mark.svg" alt="" /></div>
             <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-bold text-white">{activeNavItem.label}</p>
                <p className="truncate text-[10px] text-zen-text-disabled">AcademiaZen{isPremium ? ' · Pro' : ''}</p>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
             <button 
               onClick={openAI}
               aria-label="Open Zen AI"
               aria-expanded={showAI}
               aria-controls="zen-ai-panel"
               className="mobile-header-action text-zen-secondary"
             >
               <IconBot className="w-6 h-6" />
             </button>
             <button 
               onClick={() => openSettings()}
               onPointerEnter={loadSettings}
               onFocus={loadSettings}
               aria-label="Open settings"
               className="mobile-header-action text-zen-text-secondary"
             >
               <IconSettings className="w-6 h-6" />
             </button>
          </div>
        </header>

        {/* Content Area */}
        <main id="main-content" tabIndex={-1} className="app-main desktop-scroll-area no-scrollbar relative flex-1 overflow-x-hidden overflow-y-auto pb-24 scroll-smooth lg:pb-0">
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<div className="app-route"><Home /></div>} />
              <Route path="/calendar" element={<div className="app-route"><Calendar /></div>} />
              <Route path="/review" element={<div className="app-route"><Review /></div>} />
              <Route path="/focus" element={<div className="app-route"><Focus /></div>} />
              <Route path="/library" element={<div className="app-route"><Library /></div>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>

        {/* Mobile Bottom Navigation (Hidden on Desktop) */}
        <nav aria-label="Mobile navigation" className={`mobile-nav-dock fixed bottom-3 left-3 right-3 z-20 flex items-center justify-around p-1.5 lg:hidden ${hideNavbar || keyboardVisible ? 'translate-y-[150%]' : 'translate-y-0'}`}>
          {navItems.map((item) => {
            const isActive = activeTab === item.tab;
            const isFocusRunning = item.tab === Tab.Focus && focusSession.isActive;
            
            return (
              <button
                key={item.tab}
                onClick={() => navigate(item.path)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
                className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors ${
                  isActive ? 'bg-zen-primary/10 text-zen-primary' : 'text-zen-text-disabled hover:text-zen-text-secondary'
                }`}
              >
                <item.icon className={`h-5 w-5 ${isFocusRunning && !isActive ? 'animate-pulse text-zen-primary' : ''}`} />
                <span className="truncate text-[9px] font-semibold">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Overlays */}
      {showSettings && (
        <Suspense fallback={<SettingsLoading />}>
          <Settings
            onClose={closeSettings}
            {...(settingsTab ? { initialTab: settingsTab } : {})}
          />
        </Suspense>
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
      {showAI && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[100] hidden cursor-default bg-black/55 backdrop-blur-[2px] sm:block min-[1180px]:hidden"
            onClick={closeAI}
            aria-label="Close Zen AI"
          />
          <Suspense fallback={<AIPanelLoading />}>
            <ZenAI contextLabel={activeNavItem.label} onClose={closeAI} />
          </Suspense>
        </>
      )}
    </div>
  );
};

export default Layout;
