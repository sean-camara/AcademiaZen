import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  Bot,
  CalendarDays,
  CheckCircle2,
  Command,
  CreditCard,
  Download,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Megaphone,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

import {
  AdminTab,
  OverviewMetrics,
  AdminUser,
  AcademicAnalytics,
  AILogEntry,
  PaymentLog,
  AnnouncementItem,
  FeedbackItem,
  SystemHealth,
  CollectionStats,
  AuditLogItem,
} from './admin/types';

import { AdminOverview } from './admin/AdminOverview';
import { AdminUsers } from './admin/AdminUsers';
import { AdminAI } from './admin/AdminAI';
import { AdminAcademics } from './admin/AdminAcademics';
import { AdminBilling } from './admin/AdminBilling';
import { AdminAnnouncements } from './admin/AdminAnnouncements';
import { AdminHealth } from './admin/AdminHealth';
import { AdminAudit } from './admin/AdminAudit';
import { SkeletonGrid, StatusPill, cx } from './admin/AdminUI';

interface NavItem {
  id: AdminTab;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

const navGroups: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Analytics',
    items: [
      { id: 'overview', label: 'Overview', shortLabel: 'Overview', icon: LayoutDashboard },
      { id: 'academics', label: 'Academic Insights', shortLabel: 'Academics', icon: GraduationCap },
      { id: 'billing', label: 'Billing & Financials', shortLabel: 'Billing', icon: CreditCard },
    ],
  },
  {
    title: 'Management',
    items: [
      { id: 'users', label: 'User Directory', shortLabel: 'Users', icon: Users },
      { id: 'ai', label: 'AI Telemetry Logs', shortLabel: 'AI Telemetry', icon: Bot },
      { id: 'announcements', label: 'Broadcasts & Support', shortLabel: 'Support', icon: Megaphone },
    ],
  },
  {
    title: 'Governance',
    items: [
      { id: 'health', label: 'System Health', shortLabel: 'Health', icon: Activity },
      { id: 'audit', label: 'Audit Log Trail', shortLabel: 'Audit', icon: ShieldCheck },
    ],
  },
];

const allNavItems = navGroups.flatMap((group) => group.items);

const pageMeta: Record<AdminTab, { title: string; description: string; live?: boolean }> = {
  overview: { title: 'Overview', description: 'Platform growth, engagement, and operational health.', live: true },
  academics: { title: 'Academic Insights', description: 'Enrollment demand and quiz performance across study subjects.' },
  billing: { title: 'Billing & Financials', description: 'Revenue performance, subscriptions, and payment activity.' },
  users: { title: 'User Directory', description: 'Manage student accounts, access, plans, and AI quotas.' },
  ai: { title: 'AI Telemetry Logs', description: 'Request volume, token usage, latency, and failures.', live: true },
  announcements: { title: 'Broadcasts & Support', description: 'Publish student updates and resolve support requests.' },
  health: { title: 'System Health', description: 'Runtime, database, storage collections, and maintenance controls.', live: true },
  audit: { title: 'Audit Log Trail', description: 'Review administrative actions and sensitive platform changes.' },
};

interface NavigationProps {
  activeTab: AdminTab;
  onNavigate: (tab: AdminTab) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, onNavigate }) => (
  <nav className="space-y-4" aria-label="Admin navigation">
    {navGroups.map((group) => (
      <div key={group.title}>
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">{group.title}</p>
        <div className="space-y-1">
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeTab;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(item.id)}
                className={cx(
                  'group flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 text-left text-xs font-medium lg:min-h-9',
                  'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64ffda]/70',
                  active
                    ? 'border-[#314151] bg-[#18222d] text-slate-50 shadow-[inset_2px_0_0_#64ffda]'
                    : 'border-transparent text-slate-400 hover:border-[#253240] hover:bg-white/[0.025] hover:text-slate-200'
                )}
              >
                <Icon className={cx('h-4 w-4 shrink-0', active ? 'text-[#64ffda]' : 'text-slate-500 group-hover:text-slate-300')} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    ))}
  </nav>
);

const Admin: React.FC = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userPage, setUserPage] = useState(1);
  const [totalUserPages, setTotalUserPages] = useState(1);

  const [academics, setAcademics] = useState<AcademicAnalytics | null>(null);
  const [aiLogs, setAiLogs] = useState<AILogEntry[]>([]);
  const [aiStatusFilter, setAiStatusFilter] = useState('all');
  const [aiTelemetry, setAiTelemetry] = useState<{ avgTokens: number; avgLatency: number; errorRate: number }>({
    avgTokens: 0,
    avgLatency: 0,
    errorRate: 0,
  });

  const [payments, setPayments] = useState<PaymentLog[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [dbStats, setDbStats] = useState<CollectionStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchUsers = async (q = '', page = 1, role = roleFilter, plan = planFilter, status = statusFilter) => {
    try {
      let url = `/api/admin/users?q=${encodeURIComponent(q)}&page=${page}`;
      if (role !== 'all') url += `&role=${role}`;
      if (plan !== 'all') url += `&plan=${plan}`;
      if (status !== 'all') url += `&status=${status}`;

      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setUserPage(data.page || 1);
        setTotalUserPages(data.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      throw error;
    }
  };

  const fetchAiLogs = async (status = aiStatusFilter) => {
    try {
      let url = '/api/admin/ai/logs';
      if (status !== 'all') url += `?status=${status}`;
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setAiLogs(data.logs || []);
        setAiTelemetry({
          avgTokens: data.avgTokens || 0,
          avgLatency: data.avgLatency || 0,
          errorRate: data.errorRate || 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch AI logs:', error);
      throw error;
    }
  };

  const fetchTabData = async (tab: AdminTab) => {
    setLoading(true);
    setStatusMessage(null);
    try {
      if (tab === 'overview') {
        const [overviewRes, healthRes] = await Promise.all([
          apiFetch('/api/admin/overview'),
          apiFetch('/api/admin/health'),
        ]);
        if (overviewRes.ok) setOverview(await overviewRes.json());
        if (healthRes.ok) setHealth(await healthRes.json());
      } else if (tab === 'users') {
        await fetchUsers(userSearch, userPage, roleFilter, planFilter, statusFilter);
      } else if (tab === 'academics') {
        const res = await apiFetch('/api/admin/analytics/academics');
        if (res.ok) setAcademics(await res.json());
      } else if (tab === 'ai') {
        await fetchAiLogs(aiStatusFilter);
      } else if (tab === 'billing') {
        const requests = [apiFetch('/api/admin/payments')];
        if (!overview) requests.push(apiFetch('/api/admin/overview'));
        const [paymentRes, overviewRes] = await Promise.all(requests);
        if (paymentRes?.ok) {
          const data = await paymentRes.json();
          setPayments(data.transactions || []);
        }
        if (overviewRes?.ok) setOverview(await overviewRes.json());
      } else if (tab === 'announcements') {
        const [announcementsRes, feedbackRes] = await Promise.all([
          apiFetch('/api/admin/announcements'),
          apiFetch('/api/admin/feedback'),
        ]);
        if (announcementsRes.ok) setAnnouncements((await announcementsRes.json()).announcements || []);
        if (feedbackRes.ok) setFeedbackList((await feedbackRes.json()).feedback || []);
      } else if (tab === 'health') {
        const [healthRes, dbRes] = await Promise.all([
          apiFetch('/api/admin/health'),
          apiFetch('/api/admin/health/db-stats'),
        ]);
        if (healthRes.ok) setHealth(await healthRes.json());
        if (dbRes.ok) setDbStats((await dbRes.json()).collections || null);
      } else if (tab === 'audit') {
        const res = await apiFetch('/api/admin/audit-logs');
        if (res.ok) setAuditLogs((await res.json()).logs || []);
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
      setStatusMessage({ type: 'error', text: 'The latest admin data could not be loaded. Try refreshing this page.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTabData(activeTab);
    // Page data is intentionally fetched only when the selected destination changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const handleNavigate = (tab: AdminTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  const handleGlobalSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = globalSearch.trim();
    setUserSearch(query);
    if (activeTab === 'users') {
      void fetchUsers(query, 1, roleFilter, planFilter, statusFilter);
    } else {
      handleNavigate('users');
    }
  };

  const handleUserSearch = (event: React.FormEvent) => {
    event.preventDefault();
    void fetchUsers(userSearch, 1, roleFilter, planFilter, statusFilter);
  };

  const handleBatchAction = async (action: 'grant_plan' | 'reset_ai' | 'suspend' | 'unsuspend') => {
    if (selectedUids.length === 0) return;
    const res = await apiFetch('/api/admin/users/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uids: selectedUids, action }),
    });
    if (res.ok) {
      setStatusMessage({ type: 'success', text: `${selectedUids.length} account${selectedUids.length === 1 ? '' : 's'} updated.` });
      setSelectedUids([]);
      await fetchUsers(userSearch, userPage, roleFilter, planFilter, statusFilter);
    }
  };

  const handleToggleRole = async (uid: string, currentRole: string) => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    const res = await apiFetch(`/api/admin/users/${uid}/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: nextRole }),
    });
    if (res.ok) {
      setStatusMessage({ type: 'success', text: `Account role updated to ${nextRole}.` });
      await fetchUsers(userSearch, userPage, roleFilter, planFilter, statusFilter);
    }
  };

  const handleTogglePlan = async (uid: string, currentPlan: string) => {
    const nextPlan = currentPlan === 'premium' ? 'free' : 'premium';
    const res = await apiFetch(`/api/admin/users/${uid}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: nextPlan, interval: 'monthly', days: 30 }),
    });
    if (res.ok) {
      setStatusMessage({ type: 'success', text: `Account plan updated to ${nextPlan}.` });
      await fetchUsers(userSearch, userPage, roleFilter, planFilter, statusFilter);
    }
  };

  const handleSuspendUser = async (uid: string, currentSuspended: boolean) => {
    const nextSuspend = !currentSuspended;
    const res = await apiFetch(`/api/admin/users/${uid}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspend: nextSuspend }),
    });
    if (res.ok) {
      setStatusMessage({ type: 'success', text: `Account ${nextSuspend ? 'suspended' : 'reactivated'}.` });
      await fetchUsers(userSearch, userPage, roleFilter, planFilter, statusFilter);
    }
  };

  const handleResetAiQuota = async (uid: string) => {
    const res = await apiFetch(`/api/admin/users/${uid}/reset-ai`, { method: 'POST' });
    if (res.ok) {
      setStatusMessage({ type: 'success', text: 'Daily AI quota reset.' });
      await fetchUsers(userSearch, userPage, roleFilter, planFilter, statusFilter);
    }
  };

  const handleExportUsersCsv = async () => {
    try {
      const res = await apiFetch('/api/admin/users/export');
      if (!res.ok) return;
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'academiazen_users.csv';
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download users CSV:', error);
      setStatusMessage({ type: 'error', text: 'The user export could not be downloaded.' });
    }
  };

  const handleCreateAnnouncement = async (
    event: React.FormEvent,
    title: string,
    message: string,
    type: 'info' | 'warning' | 'success'
  ) => {
    const res = await apiFetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message, type }),
    });
    if (res.ok) {
      setStatusMessage({ type: 'success', text: 'Announcement broadcast to students.' });
      const announcementsRes = await apiFetch('/api/admin/announcements');
      if (announcementsRes.ok) setAnnouncements((await announcementsRes.json()).announcements || []);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    const res = await apiFetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setAnnouncements((current) => current.filter((announcement) => announcement._id !== id));
      setStatusMessage({ type: 'success', text: 'Announcement removed.' });
    }
  };

  const handleReplyFeedback = async (id: string, reply?: string) => {
    if (!reply?.trim()) return;
    const res = await apiFetch(`/api/admin/feedback/${id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply, status: 'resolved' }),
    });
    if (res.ok) {
      setStatusMessage({ type: 'success', text: 'Reply sent and ticket marked resolved.' });
      const feedbackRes = await apiFetch('/api/admin/feedback');
      if (feedbackRes.ok) setFeedbackList((await feedbackRes.json()).feedback || []);
    }
  };

  const handleToggleMaintenance = async () => {
    if (!health) return;
    const enabled = !health.maintenanceMode;
    const res = await apiFetch('/api/admin/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) {
      setHealth((current) => (current ? { ...current, maintenanceMode: enabled } : null));
      setStatusMessage({ type: 'success', text: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}.` });
    }
  };

  const page = pageMeta[activeTab];
  const activeItem = allNavItems.find((item) => item.id === activeTab) || allNavItems[0];
  const ActiveIcon = activeItem?.icon || LayoutDashboard;
  const adminInitial = (user?.email || 'A').charAt(0).toUpperCase();
  const dateLabel = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
    return `${formatter.format(start)} – ${formatter.format(today)}`;
  }, []);

  return (
    <div className="admin-shell flex h-dvh min-h-dvh w-full overflow-hidden bg-[#080d13] text-slate-200 selection:bg-[#64ffda]/25">
      <a
        href="#admin-main"
        className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-md bg-[#64ffda] px-3 py-2 text-xs font-semibold text-[#07110f] transition-transform focus:translate-y-0"
      >
        Skip to admin content
      </a>

      <aside className="hidden w-[244px] shrink-0 flex-col border-r border-[#23303d] bg-[#0b1119] px-4 py-4 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <img src="/icons/academiazen-mark.svg" alt="" className="h-9 w-9 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-[-0.025em] text-white">AcademiaZen</h1>
            <p className="mt-0.5 text-xs text-slate-500">Admin Console</p>
          </div>
        </div>
        <div className="mt-5 min-h-0 flex-1 overflow-y-auto custom-scrollbar">
          <Navigation activeTab={activeTab} onNavigate={handleNavigate} />
        </div>
        <div className="mt-4 space-y-1.5 border-t border-[#23303d] pt-3">
          <div className="rounded-lg border border-[#273442] bg-[#101820] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-500">Environment</span>
              <StatusPill label="Production" tone="mint" dot />
            </div>
            <p className="mt-2 truncate text-[11px] text-slate-400">{user?.email || 'Administrator'}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex min-h-9 w-full items-center gap-2 rounded-lg border border-transparent px-3 text-xs text-slate-400 hover:border-[#273442] hover:bg-white/[0.025] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64ffda]/70"
          >
            <Smartphone className="h-4 w-4" aria-hidden="true" />
            Student Workspace
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex min-h-9 w-full items-center gap-2 rounded-lg border border-transparent px-3 text-xs text-rose-300/80 hover:border-rose-400/15 hover:bg-rose-400/[0.06] hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/70"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign Out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-50 flex w-[min(88vw,320px)] flex-col border-r border-[#273442] bg-[#0b1119] p-5 shadow-2xl transition-transform duration-200 lg:hidden motion-reduce:transition-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
      >
        <div className="flex items-center justify-between border-b border-[#23303d] pb-5">
          <div className="flex items-center gap-3">
            <img src="/icons/academiazen-mark.svg" alt="" className="h-9 w-9" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-white">AcademiaZen</p>
              <p className="text-xs text-slate-500">Admin Console</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
            className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64ffda]/70"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-5 min-h-0 flex-1 overflow-y-auto custom-scrollbar">
          <Navigation activeTab={activeTab} onNavigate={handleNavigate} />
        </div>
        <div className="space-y-2 border-t border-[#23303d] pt-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-slate-300 hover:bg-white/5"
          >
            <Smartphone className="h-4 w-4" aria-hidden="true" /> Student Workspace
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-rose-300 hover:bg-rose-400/10"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign Out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-30 flex min-h-[68px] shrink-0 items-center gap-3 border-b border-[#23303d] bg-[#090f16]/95 px-3 backdrop-blur sm:px-5 xl:px-6">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#273442] text-slate-400 hover:bg-white/[0.035] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64ffda]/70 lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <form onSubmit={handleGlobalSearch} className="relative min-w-0 flex-1 sm:max-w-xl">
            <label htmlFor="admin-global-search" className="sr-only">Search student accounts</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              ref={searchRef}
              id="admin-global-search"
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
              placeholder="Search students by name, email or UID"
              className="h-10 w-full rounded-lg border border-[#2b3745] bg-[#0d141d] pl-10 pr-14 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-[#64ffda]/50 focus:ring-2 focus:ring-[#64ffda]/10"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded border border-[#344252] px-1.5 py-0.5 text-[10px] text-slate-500 sm:flex">
              <Command className="h-2.5 w-2.5" aria-hidden="true" /> K
            </span>
          </form>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <div className="flex h-10 items-center gap-2 rounded-lg border border-[#273442] bg-[#0d141d] px-3 text-xs text-slate-400">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              <span>{dateLabel}</span>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                await fetchTabData(activeTab);
                setStatusMessage({ type: 'success', text: `${page.title} refreshed.` });
              }}
              className="flex h-10 items-center gap-2 rounded-lg border border-[#2b3745] bg-[#0d141d] px-3 text-xs font-medium text-slate-300 hover:border-[#3a495a] hover:bg-[#121b25] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64ffda]/70"
            >
              <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
              Refresh
            </button>
            <div className="grid h-9 w-9 place-items-center rounded-full border border-[#344252] bg-[#151e29] text-xs font-semibold text-slate-200" title={user?.email || 'Administrator'}>
              {adminInitial}
            </div>
          </div>
        </header>

        <main id="admin-main" className="min-w-0 flex-1 overflow-y-auto custom-scrollbar" tabIndex={-1}>
          <div className="mx-auto w-full max-w-[1720px] px-3 py-4 sm:px-5 sm:py-5 xl:px-6 xl:py-6">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#64ffda]/15 bg-[#64ffda]/[0.06] text-[#64ffda]">
                    <ActiveIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold tracking-[-0.035em] text-white sm:text-2xl">{page.title}</h2>
                      {page.live && <StatusPill label="Live data" tone="mint" dot />}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">{page.description}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 md:hidden">
                {activeTab === 'users' && (
                  <button
                    type="button"
                    onClick={() => void handleExportUsersCsv()}
                    className="flex min-h-10 items-center gap-2 rounded-lg border border-[#2b3745] bg-[#101720] px-3 text-xs font-medium text-slate-300"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" /> Export
                  </button>
                )}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void fetchTabData(activeTab)}
                  className="grid h-10 w-10 place-items-center rounded-lg border border-[#2b3745] bg-[#101720] text-slate-300 disabled:opacity-50"
                  aria-label={`Refresh ${page.title}`}
                >
                  <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
                </button>
              </div>
              {activeTab === 'users' && (
                <button
                  type="button"
                  onClick={() => void handleExportUsersCsv()}
                  className="hidden min-h-10 items-center gap-2 rounded-lg border border-[#64ffda]/20 bg-[#64ffda]/[0.07] px-3.5 text-xs font-semibold text-[#8affdf] hover:bg-[#64ffda]/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64ffda]/70 md:flex"
                >
                  <Download className="h-4 w-4" aria-hidden="true" /> Export CSV
                </button>
              )}
            </div>

            {statusMessage && (
              <div
                className={cx(
                  'mb-5 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm',
                  statusMessage.type === 'success'
                    ? 'border-[#64ffda]/20 bg-[#64ffda]/[0.07] text-[#a4ffe8]'
                    : 'border-rose-400/25 bg-rose-400/[0.08] text-rose-200'
                )}
                role="status"
                aria-live="polite"
              >
                <span className="flex items-start gap-2">
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  {statusMessage.text}
                </span>
                <button
                  type="button"
                  aria-label="Dismiss message"
                  onClick={() => setStatusMessage(null)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}

            {loading ? (
              <SkeletonGrid />
            ) : (
              <div className="animate-fade-in motion-reduce:animate-none">
                {activeTab === 'overview' && overview && (
                  <AdminOverview overview={overview} health={health} setActiveTab={handleNavigate} onToggleMaintenance={handleToggleMaintenance} />
                )}
                {activeTab === 'users' && (
                  <AdminUsers
                    users={users}
                    overview={overview}
                    userSearch={userSearch}
                    setUserSearch={setUserSearch}
                    roleFilter={roleFilter}
                    setRoleFilter={setRoleFilter}
                    planFilter={planFilter}
                    setPlanFilter={setPlanFilter}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    userPage={userPage}
                    totalUserPages={totalUserPages}
                    selectedUids={selectedUids}
                    setSelectedUids={setSelectedUids}
                    onSearch={handleUserSearch}
                    onFetchUsers={fetchUsers}
                    onBatchAction={handleBatchAction}
                    onToggleRole={handleToggleRole}
                    onTogglePlan={handleTogglePlan}
                    onSuspendUser={handleSuspendUser}
                    onResetAiQuota={handleResetAiQuota}
                  />
                )}
                {activeTab === 'ai' && (
                  <AdminAI
                    aiLogs={aiLogs}
                    aiTelemetry={aiTelemetry}
                    aiStatusFilter={aiStatusFilter}
                    setAiStatusFilter={setAiStatusFilter}
                    onFetchAiLogs={fetchAiLogs}
                  />
                )}
                {activeTab === 'academics' && <AdminAcademics academics={academics} />}
                {activeTab === 'billing' && <AdminBilling payments={payments} overview={overview} />}
                {activeTab === 'announcements' && (
                  <AdminAnnouncements
                    announcements={announcements}
                    feedbackList={feedbackList}
                    onCreateAnnouncement={handleCreateAnnouncement}
                    onDeleteAnnouncement={handleDeleteAnnouncement}
                    onReplyFeedback={handleReplyFeedback}
                  />
                )}
                {activeTab === 'health' && <AdminHealth health={health} dbStats={dbStats} onToggleMaintenance={handleToggleMaintenance} />}
                {activeTab === 'audit' && <AdminAudit auditLogs={auditLogs} />}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Admin;
