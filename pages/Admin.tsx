import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

type AdminTab = 'overview' | 'users' | 'ai' | 'academics' | 'billing' | 'announcements' | 'health';

interface OverviewMetrics {
  totalUsers: number;
  activeUsersToday: number;
  premiumUsers: number;
  freeUsers: number;
  promptsToday: number;
  promptsMonth: number;
  totalFocusMinutes: number;
  totalFocusSessions: number;
  estimatedMRR: number;
}

interface AdminUser {
  uid: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  plan: 'free' | 'premium';
  billingStatus: string;
  dailyAiCount: number;
  totalAiRequests: number;
  createdAt: string;
  lastActive: string;
}

interface AcademicAnalytics {
  topSubjects: Array<{ subject: string; count: number }>;
  avgQuizScore: number;
  totalQuizAttempts: number;
}

interface AILogEntry {
  _id: string;
  uid: string;
  endpoint: string;
  model: string;
  mode: string;
  totalTokens: number;
  responseTimeMs: number;
  success: boolean;
  userTier: string;
  createdAt: string;
}

interface PaymentLog {
  uid: string;
  email: string;
  plan: string;
  interval: string;
  status: string;
  lastPaymentAt: string;
  paymentId: string;
  amount: string;
}

interface AnnouncementItem {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'banner';
  isActive: boolean;
  createdAt: string;
}

interface FeedbackItem {
  _id: string;
  uid: string;
  email: string;
  category: string;
  message: string;
  status: 'open' | 'in_review' | 'resolved' | 'closed';
  reply: string;
  createdAt: string;
}

interface SystemHealth {
  database: string;
  memory: { rssMb: number; heapTotalMb: number; heapUsedMb: number };
  uptimeSeconds: number;
  maintenanceMode: boolean;
  nodeVersion: string;
}

const Admin: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Metrics Data States
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [totalUserPages, setTotalUserPages] = useState(1);
  const [academics, setAcademics] = useState<AcademicAnalytics | null>(null);
  const [aiLogs, setAiLogs] = useState<AILogEntry[]>([]);
  const [payments, setPayments] = useState<PaymentLog[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);

  // Form States
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnMessage, setNewAnnMessage] = useState('');
  const [newAnnType, setNewAnnType] = useState<'info' | 'warning' | 'success'>('info');
  const [replyText, setReplyText] = useState<{ [id: string]: string }>({});
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
      } else if (tab === 'users') {
        fetchUsers(userSearch, userPage);
      } else if (tab === 'academics') {
        const res = await apiFetch('/api/admin/analytics/academics');
        if (res.ok) setAcademics(await res.json());
      } else if (tab === 'ai') {
        const res = await apiFetch('/api/admin/ai/logs');
        if (res.ok) {
          const data = await res.json();
          setAiLogs(data.logs || []);
        }
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
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (q = '', page = 1) => {
    try {
      const res = await apiFetch(`/api/admin/users?q=${encodeURIComponent(q)}&page=${page}`);
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

  const handleUserSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(userSearch, 1);
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
      fetchUsers(userSearch, userPage);
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
      fetchUsers(userSearch, userPage);
    }
  };

  const handleResetAiQuota = async (uid: string) => {
    const res = await apiFetch(`/api/admin/users/${uid}/reset-ai`, { method: 'POST' });
    if (res.ok) {
      setStatusMessage({ type: 'success', text: 'AI daily quota successfully reset for user.' });
      fetchUsers(userSearch, userPage);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle || !newAnnMessage) return;
    const res = await apiFetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newAnnTitle, message: newAnnMessage, type: newAnnType }),
    });
    if (res.ok) {
      setNewAnnTitle('');
      setNewAnnMessage('');
      setStatusMessage({ type: 'success', text: 'Announcement broadcasted!' });
      const resAnn = await apiFetch('/api/admin/announcements');
      if (resAnn.ok) setAnnouncements((await resAnn.json()).announcements || []);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    const res = await apiFetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setAnnouncements(prev => prev.filter(a => a._id !== id));
      setStatusMessage({ type: 'success', text: 'Announcement deleted.' });
    }
  };

  const handleReplyFeedback = async (id: string) => {
    const text = replyText[id];
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
      setHealth(prev => (prev ? { ...prev, maintenanceMode: nextMode } : null));
      setStatusMessage({ type: 'success', text: `Maintenance mode ${nextMode ? 'enabled' : 'disabled'}.` });
    }
  };

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'users', label: 'User Directory', icon: '👥' },
    { id: 'ai', label: 'AI Request Logs', icon: '🤖' },
    { id: 'academics', label: 'Academic Insights', icon: '🎓' },
    { id: 'billing', label: 'Billing & MRR', icon: '💳' },
    { id: 'announcements', label: 'Support & Broadcasts', icon: '💬' },
    { id: 'health', label: 'System Health', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-[#070b10] text-slate-100 flex flex-col md:flex-row font-sans">
      
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-white/10 bg-[#0a1018]">
        <div className="flex items-center gap-3">
          <img src="/icons/academiazen-mark.svg" alt="Logo" className="w-8 h-8 rounded-xl" />
          <span className="font-bold text-white text-sm">AcademiaZen Control</span>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-slate-300 hover:text-white">
          {sidebarOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* LEFT VERTICAL ADMIN SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 lg:w-72 bg-[#090e15] border-r border-white/10 flex flex-col justify-between p-5 transition-transform duration-300 md:static md:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div>
          {/* Admin Header */}
          <div className="flex items-center gap-3.5 pb-6 border-b border-white/10">
            <img src="/icons/academiazen-mark.svg" alt="AcademiaZen Logo" className="w-10 h-10 rounded-xl shadow-lg shadow-emerald-500/10" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-white text-sm tracking-tight">AcademiaZen</h1>
                <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-mono text-[9px] font-bold uppercase border border-amber-400/30">
                  ADMIN
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">Control Center v1.1</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="mt-6 space-y-1.5" aria-label="Admin Navigation">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 font-mono">Management Menu</p>
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as AdminTab);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                    isActive
                      ? 'bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/20'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Actions */}
        <div className="pt-6 border-t border-white/10 space-y-2">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition"
          >
            <span>📱 Student Workspace</span>
          </button>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/20 transition"
          >
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* RIGHT MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8 min-w-0">
        
        {/* Main Content Title Header */}
        <div className="flex items-center justify-between pb-6 mb-6 border-b border-white/10">
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              {menuItems.find(m => m.id === activeTab)?.label}
            </h2>
            <p className="text-xs text-slate-400 mt-1">Real-time system data and RBAC permissions</p>
          </div>
          <button
            onClick={() => fetchTabData(activeTab)}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-semibold flex items-center gap-2 transition"
          >
            <span>🔄 Refresh</span>
          </button>
        </div>

        {/* Status Alert Banner */}
        {statusMessage && (
          <div className={`mb-6 p-4 rounded-xl text-sm font-medium border flex items-center justify-between ${
            statusMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <span>{statusMessage.text}</span>
            <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Tab Contents */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 animate-pulse font-mono text-xs">Fetching system telemetry...</div>
        ) : (
          <>
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && overview && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Registered Users</p>
                  <p className="mt-2 text-4xl font-extrabold text-white">{overview.totalUsers}</p>
                  <p className="mt-1 text-xs text-emerald-400 font-medium">Active today: {overview.activeUsersToday}</p>
                </div>

                <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Plan Distribution</p>
                  <p className="mt-2 text-4xl font-extrabold text-emerald-300">{overview.premiumUsers} <span className="text-sm font-normal text-slate-400">Premium</span></p>
                  <p className="mt-1 text-xs text-slate-400">{overview.freeUsers} Free Tier Users</p>
                </div>

                <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Zen AI Prompts</p>
                  <p className="mt-2 text-4xl font-extrabold text-violet-300">{overview.promptsToday} <span className="text-sm font-normal text-slate-400">today</span></p>
                  <p className="mt-1 text-xs text-slate-400">{overview.promptsMonth} generated this month</p>
                </div>

                <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Estimated MRR</p>
                  <p className="mt-2 text-4xl font-extrabold text-amber-300">PHP {overview.estimatedMRR.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-slate-400">{overview.totalFocusMinutes.toLocaleString()} focus mins logged</p>
                </div>
              </div>
            )}

            {/* TAB 2: USER DIRECTORY */}
            {activeTab === 'users' && (
              <div>
                <form onSubmit={handleUserSearch} className="flex gap-3 max-w-xl mb-6">
                  <input
                    type="text"
                    placeholder="Search by email, name, or UID..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                  />
                  <button type="submit" className="px-5 py-2.5 rounded-xl bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider hover:bg-emerald-300 transition">
                    Search
                  </button>
                </form>

                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-white/5 uppercase font-mono text-[10px] text-slate-400 border-b border-white/10">
                      <tr>
                        <th className="p-4">User</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Plan</th>
                        <th className="p-4">Daily AI</th>
                        <th className="p-4">Joined</th>
                        <th className="p-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {users.map((u) => (
                        <tr key={u.uid} className="hover:bg-white/[0.02] transition">
                          <td className="p-4">
                            <p className="font-semibold text-white">{u.name}</p>
                            <p className="text-[11px] text-slate-400 font-mono">{u.email}</p>
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${
                              u.role === 'admin' ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${
                              u.plan === 'premium' ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {u.plan}
                            </span>
                          </td>
                          <td className="p-4 font-mono">{u.dailyAiCount} reqs</td>
                          <td className="p-4 font-mono text-[11px] text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td className="p-4 flex gap-2">
                            <button onClick={() => handleToggleRole(u.uid, u.role)} className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold uppercase transition">
                              Role ({u.role === 'admin' ? 'User' : 'Admin'})
                            </button>
                            <button onClick={() => handleTogglePlan(u.uid, u.plan)} className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase transition">
                              Plan ({u.plan === 'premium' ? 'Free' : 'Premium'})
                            </button>
                            <button onClick={() => handleResetAiQuota(u.uid)} className="px-2.5 py-1 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-[10px] font-bold uppercase transition">
                              Reset Quota
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: AI LOGS */}
            {activeTab === 'ai' && (
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-white/5 uppercase font-mono text-[10px] text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="p-4">Endpoint</th>
                      <th className="p-4">Model</th>
                      <th className="p-4">Mode</th>
                      <th className="p-4">Tokens</th>
                      <th className="p-4">Latency</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {aiLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-white/[0.02] transition font-mono">
                        <td className="p-4 font-semibold text-white">{log.endpoint}</td>
                        <td className="p-4 text-slate-400">{log.model || 'auto'}</td>
                        <td className="p-4 text-slate-400">{log.mode || 'standard'}</td>
                        <td className="p-4 text-emerald-300">{log.totalTokens}</td>
                        <td className="p-4 text-amber-300">{log.responseTimeMs}ms</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.success ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                            {log.success ? 'Success' : 'Failed'}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400">{new Date(log.createdAt).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 4: ACADEMICS */}
            {activeTab === 'academics' && academics && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">Top Study Subjects</h3>
                  <div className="space-y-3">
                    {academics.topSubjects.map((s) => (
                      <div key={s.subject} className="flex justify-between text-xs border-b border-white/5 pb-2">
                        <span className="font-semibold text-white">{s.subject}</span>
                        <span className="font-mono text-emerald-400">{s.count} students</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">AI Quiz Performance</h3>
                  <div className="text-center p-8 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-5xl font-extrabold text-emerald-300">{academics.avgQuizScore}%</p>
                    <p className="mt-2 text-xs text-slate-400">Average Student Quiz Score across {academics.totalQuizAttempts} completed attempts</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: BILLING */}
            {activeTab === 'billing' && (
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-white/5 uppercase font-mono text-[10px] text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="p-4">Student Email</th>
                      <th className="p-4">Interval</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Payment Key / ID</th>
                      <th className="p-4">Paid Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {payments.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02] transition font-mono">
                        <td className="p-4 font-semibold text-white">{tx.email}</td>
                        <td className="p-4 text-slate-400 uppercase">{tx.interval}</td>
                        <td className="p-4 text-emerald-300 font-bold">{tx.amount}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 uppercase">
                            {tx.status}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400 truncate max-w-[180px]">{tx.paymentId}</td>
                        <td className="p-4 text-slate-400">{new Date(tx.lastPaymentAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 6: ANNOUNCEMENTS & SUPPORT */}
            {activeTab === 'announcements' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Create Announcement */}
                <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">Broadcast Platform Announcement</h3>
                  <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Banner Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Scheduled Maintenance or New Feature!"
                        value={newAnnTitle}
                        onChange={(e) => setNewAnnTitle(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Message Content</label>
                      <textarea
                        rows={3}
                        placeholder="Message details shown to all active students..."
                        value={newAnnMessage}
                        onChange={(e) => setNewAnnMessage(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <select
                        value={newAnnType}
                        onChange={(e) => setNewAnnType(e.target.value as any)}
                        className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white"
                      >
                        <option value="info">Info (Blue)</option>
                        <option value="warning">Warning (Amber)</option>
                        <option value="success">Success (Green)</option>
                      </select>
                      <button type="submit" className="px-5 py-2.5 rounded-xl bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider hover:bg-emerald-300 transition">
                        Broadcast Now
                      </button>
                    </div>
                  </form>

                  <div className="mt-6 border-t border-white/10 pt-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase text-slate-400">Active Banners</h4>
                    {announcements.map((ann) => (
                      <div key={ann._id} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-white">{ann.title}</p>
                          <p className="text-slate-400 text-[11px]">{ann.message}</p>
                        </div>
                        <button onClick={() => handleDeleteAnnouncement(ann._id)} className="text-rose-400 hover:text-rose-300 text-xs px-2 py-1">Delete</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Feedback Support Tickets */}
                <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">Student Feedback Tickets</h3>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {feedbackList.map((item) => (
                      <div key={item._id} className="p-4 rounded-xl bg-white/5 border border-white/5 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-emerald-300 text-[11px]">{item.email}</span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-white/10 text-slate-300">{item.category}</span>
                        </div>
                        <p className="text-slate-200">{item.message}</p>
                        {item.reply ? (
                          <div className="mt-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px]">
                            <strong>Admin Reply:</strong> {item.reply}
                          </div>
                        ) : (
                          <div className="flex gap-2 mt-2">
                            <input
                              type="text"
                              placeholder="Type reply to student..."
                              value={replyText[item._id] || ''}
                              onChange={(e) => setReplyText({ ...replyText, [item._id]: e.target.value })}
                              className="flex-1 px-3 py-1.5 rounded bg-white/5 border border-white/10 text-xs text-white"
                            />
                            <button onClick={() => handleReplyFeedback(item._id)} className="px-3 py-1.5 rounded bg-emerald-400 text-slate-950 font-bold text-xs uppercase">
                              Send Reply
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: HEALTH */}
            {activeTab === 'health' && health && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
                  <p className="text-xs font-bold uppercase text-slate-400">Database Connection</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-300 uppercase font-mono">{health.database}</p>
                </div>

                <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
                  <p className="text-xs font-bold uppercase text-slate-400">Node.js Process Memory</p>
                  <p className="mt-2 text-2xl font-bold text-violet-300 font-mono">{health.memory.heapUsedMb} MB / {health.memory.heapTotalMb} MB</p>
                </div>

                <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
                  <p className="text-xs font-bold uppercase text-slate-400">Server Uptime</p>
                  <p className="mt-2 text-2xl font-bold text-amber-300 font-mono">{Math.round(health.uptimeSeconds / 60)} minutes</p>
                </div>

                <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] sm:col-span-2 lg:col-span-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">System Maintenance Mode</h4>
                    <p className="text-xs text-slate-400">When enabled, non-admin users will see a maintenance notice screen.</p>
                  </div>
                  <button
                    onClick={handleToggleMaintenance}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition ${
                      health.maintenanceMode ? 'bg-rose-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                    }`}
                  >
                    {health.maintenanceMode ? 'Disable Maintenance' : 'Enable Maintenance'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Admin;
