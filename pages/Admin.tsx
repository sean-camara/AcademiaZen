import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Bot,
  GraduationCap,
  CreditCard,
  Megaphone,
  Activity,
  ShieldCheck,
  RefreshCw,
  Download,
  LogOut,
  Smartphone,
  CheckCircle2,
  X,
  Menu,
  Command,
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

const Admin: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Metrics & Data States
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

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab]);

  const fetchTabData = async (tab: AdminTab) => {
    setLoading(true);
    setStatusMessage(null);
    try {
      if (tab === 'overview') {
        const res = await apiFetch('/api/admin/overview');
        if (res.ok) setOverview(await res.json());

        const hRes = await apiFetch('/api/admin/health');
        if (hRes.ok) setHealth(await hRes.json());
      } else if (tab === 'users') {
        fetchUsers(userSearch, userPage, roleFilter, planFilter, statusFilter);
      } else if (tab === 'academics') {
        const res = await apiFetch('/api/admin/analytics/academics');
        if (res.ok) setAcademics(await res.json());
      } else if (tab === 'ai') {
        fetchAiLogs(aiStatusFilter);
      } else if (tab === 'billing') {
        const res = await apiFetch('/api/admin/payments');
        if (res.ok) {
          const data = await res.json();
          setPayments(data.transactions || []);
        }
      } else if (tab === 'announcements') {
        const resAnn = await apiFetch('/api/admin/announcements');
        if (resAnn.ok) setAnnouncements((await resAnn.json()).announcements || []);

        const resFb = await apiFetch('/api/admin/feedback');
        if (resFb.ok) setFeedbackList((await resFb.json()).feedback || []);
      } else if (tab === 'health') {
        const res = await apiFetch('/api/admin/health');
        if (res.ok) setHealth(await res.json());

        const dbRes = await apiFetch('/api/admin/health/db-stats');
        if (dbRes.ok) {
          const data = await dbRes.json();
          setDbStats(data.collections || null);
        }
      } else if (tab === 'audit') {
        const res = await apiFetch('/api/admin/audit-logs');
        if (res.ok) setAuditLogs((await res.json()).logs || []);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

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
    } catch (err) {
      console.error('Failed to fetch users:', err);
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
    } catch (err) {
      console.error('Failed to fetch AI logs:', err);
    }
  };

  const handleUserSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(userSearch, 1, roleFilter, planFilter, statusFilter);
  };

  const handleBatchAction = async (action: 'grant_plan' | 'reset_ai' | 'suspend' | 'unsuspend') => {
    if (selectedUids.length === 0) return;
    const res = await apiFetch('/api/admin/users/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uids: selectedUids, action }),
    });

    if (res.ok) {
      setStatusMessage({ type: 'success', text: `Batch operation '${action}' completed for ${selectedUids.length} users.` });
      setSelectedUids([]);
      fetchUsers(userSearch, userPage, roleFilter, planFilter, statusFilter);
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
      setStatusMessage({ type: 'success', text: `Updated user role to ${nextRole}` });
      fetchUsers(userSearch, userPage, roleFilter, planFilter, statusFilter);
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
      setStatusMessage({ type: 'success', text: `Updated user plan to ${nextPlan}` });
      fetchUsers(userSearch, userPage, roleFilter, planFilter, statusFilter);
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
      setStatusMessage({ type: 'success', text: `User account ${nextSuspend ? 'suspended' : 'unsuspended'}.` });
      fetchUsers(userSearch, userPage, roleFilter, planFilter, statusFilter);
    }
  };

  const handleResetAiQuota = async (uid: string) => {
    const res = await apiFetch(`/api/admin/users/${uid}/reset-ai`, { method: 'POST' });
    if (res.ok) {
      setStatusMessage({ type: 'success', text: 'AI daily quota successfully reset for user.' });
      fetchUsers(userSearch, userPage, roleFilter, planFilter, statusFilter);
    }
  };

  const handleExportUsersCsv = async () => {
    try {
      const res = await apiFetch('/api/admin/users/export');
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'academiazen_users.csv';
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to download users CSV:', err);
    }
  };

  const handleCreateAnnouncement = async (
    e: React.FormEvent,
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
      setStatusMessage({ type: 'success', text: 'Announcement broadcasted!' });
      const resAnn = await apiFetch('/api/admin/announcements');
      if (resAnn.ok) setAnnouncements((await resAnn.json()).announcements || []);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    const res = await apiFetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setAnnouncements((prev) => prev.filter((a) => a._id !== id));
      setStatusMessage({ type: 'success', text: 'Announcement deleted.' });
    }
  };

  const handleReplyFeedback = async (id: string, text?: string) => {
    if (!text) return;
    const res = await apiFetch(`/api/admin/feedback/${id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: text, status: 'resolved' }),
    });
    if (res.ok) {
      setStatusMessage({ type: 'success', text: 'Reply sent to student.' });
      const resFb = await apiFetch('/api/admin/feedback');
      if (resFb.ok) setFeedbackList((await resFb.json()).feedback || []);
    }
  };

  const handleToggleMaintenance = async () => {
    if (!health) return;
    const nextMode = !health.maintenanceMode;
    const res = await apiFetch('/api/admin/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: nextMode }),
    });
    if (res.ok) {
      setHealth((prev) => (prev ? { ...prev, maintenanceMode: nextMode } : null));
      setStatusMessage({ type: 'success', text: `Maintenance mode ${nextMode ? 'enabled' : 'disabled'}.` });
    }
  };

  const navGroups = [
    {
      title: 'ANALYTICS & METRICS',
      items: [
        { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
        { id: 'academics', label: 'Academic Insights', icon: <GraduationCap className="w-4 h-4" /> },
        { id: 'billing', label: 'Billing & Financials', icon: <CreditCard className="w-4 h-4" /> },
      ],
    },
    {
      title: 'MANAGEMENT',
      items: [
        { id: 'users', label: 'User Directory', icon: <Users className="w-4 h-4" /> },
        { id: 'ai', label: 'AI Telemetry Logs', icon: <Bot className="w-4 h-4" /> },
        { id: 'announcements', label: 'Broadcasts & Support', icon: <Megaphone className="w-4 h-4" /> },
      ],
    },
    {
      title: 'DEVOPS & GOVERNANCE',
      items: [
        { id: 'health', label: 'System Health', icon: <Activity className="w-4 h-4" /> },
        { id: 'audit', label: 'Audit Log Trail', icon: <ShieldCheck className="w-4 h-4" /> },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-200 flex flex-col md:flex-row font-sans selection:bg-emerald-500/30">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-[#090d16]">
        <div className="flex items-center gap-3">
          <img src="/icons/academiazen-mark.svg" alt="Logo" className="w-8 h-8 rounded-xl shadow-md" />
          <div>
            <span className="font-bold text-white text-sm">AcademiaZen</span>
            <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[9px] uppercase font-bold">Admin</span>
          </div>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-slate-300 hover:text-white">
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Left Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 lg:w-72 bg-[#090d16] border-r border-slate-800/80 flex flex-col justify-between p-5 transition-transform duration-300 md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="flex items-center justify-between pb-5 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <img src="/icons/academiazen-mark.svg" alt="AcademiaZen Logo" className="w-9 h-9 rounded-xl shadow-lg shadow-emerald-500/10 ring-1 ring-white/10" />
              <div>
                <h1 className="font-extrabold text-white text-sm tracking-tight flex items-center gap-2">AcademiaZen</h1>
                <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Production Control</span>
                </p>
              </div>
            </div>
          </div>

          <nav className="mt-6 space-y-6" aria-label="Admin Navigation">
            {navGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">{group.title}</p>
                {group.items.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => {
                        setActiveTab(item.id as AdminTab);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-300 font-semibold border-l-2 border-emerald-400 shadow-sm'
                          : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={isActive ? 'text-emerald-400' : 'text-slate-400'}>{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      {isActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="pt-5 border-t border-slate-800/80 space-y-2">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60 mb-3 text-xs font-mono">
            <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1">
              <span>Database Sync</span>
              <span className="text-emerald-400 font-semibold">100% OK</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 w-full" />
            </div>
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700/50 transition"
          >
            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
            <span>Student Workspace</span>
          </button>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium border border-rose-500/20 transition"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-5 sm:p-8 min-w-0 bg-[#070b12]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold text-white tracking-tight">
                {navGroups.flatMap((g) => g.items).find((m) => m.id === activeTab)?.label}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-semibold border border-emerald-500/20">
                LIVE TELEMETRY
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Enterprise system health, RBAC controls & platform analytics</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono">
              <Command className="w-3.5 h-3.5" />
              <span>K Quick Commands</span>
            </div>

            {activeTab === 'users' && (
              <button
                onClick={handleExportUsersCsv}
                className="px-3.5 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-2 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            )}
            <button
              onClick={() => fetchTabData(activeTab)}
              className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium flex items-center gap-2 transition active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded-xl text-sm font-medium border flex items-center justify-between ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{statusMessage.text}</span>
            </span>
            <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="p-16 text-center text-slate-400 animate-pulse font-mono text-xs flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
            <span>Fetching system metrics & telemetry...</span>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && overview && (
              <AdminOverview
                overview={overview}
                health={health}
                setActiveTab={setActiveTab}
                onToggleMaintenance={handleToggleMaintenance}
              />
            )}

            {activeTab === 'users' && (
              <AdminUsers
                users={users}
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

            {activeTab === 'health' && (
              <AdminHealth health={health} dbStats={dbStats} onToggleMaintenance={handleToggleMaintenance} />
            )}

            {activeTab === 'audit' && <AdminAudit auditLogs={auditLogs} />}
          </>
        )}
      </main>
    </div>
  );
};

export default Admin;
