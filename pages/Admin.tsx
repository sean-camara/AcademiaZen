import React, { useEffect, useRef, useState } from 'react';
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
  Check,
  ChevronDown,
  Search,
  Lock,
  Unlock,
  UserCheck,
  UserX,
  Zap,
  Crown,
  LogOut,
  Smartphone,
  AlertTriangle,
  Info,
  CheckCircle,
  X,
  Menu,
  Database,
  TrendingUp,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

type AdminTab = 'overview' | 'users' | 'ai' | 'academics' | 'billing' | 'announcements' | 'health' | 'audit';

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
  conversionRate?: number;
  dailyStats?: Array<{ date: string; dayName: string; activeUsers: number; aiRequests: number }>;
  recentActivity?: Array<{ id: string; type: string; title: string; timestamp: string; badge: string }>;
  topSubjects?: Array<{ subject: string; count: number }>;
}

interface AdminUser {
  uid: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  isSuspended?: boolean;
  plan: 'free' | 'premium';
  billingStatus: string;
  dailyAiCount: number;
  totalAiRequests: number;
  subjectCount?: number;
  taskCount?: number;
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
  errorMessage?: string;
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

interface CollectionStats {
  users: number;
  focusSessions: number;
  aiLogs: number;
  announcements: number;
  feedback: number;
  auditLogs: number;
}

interface AuditLogItem {
  _id: string;
  adminEmail: string;
  action: string;
  targetUid?: string;
  details?: Record<string, any>;
  createdAt: string;
}

interface CustomSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  className?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, options, onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b121c] border border-white/10 hover:border-emerald-400/40 text-xs font-semibold text-slate-200 flex items-center justify-between gap-3 transition-all focus:outline-none focus:border-emerald-400 shadow-sm"
      >
        <span className="flex items-center gap-2.5 truncate">
          {selectedOption?.icon && <span className="text-slate-400">{selectedOption.icon}</span>}
          <span>{selectedOption?.label}</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-400' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 z-50 py-1.5 bg-[#0b121c] border border-white/15 rounded-xl shadow-2xl backdrop-blur-xl animate-in fade-in duration-100 font-sans min-w-[160px]">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3.5 py-2 text-left text-xs font-medium flex items-center justify-between transition-colors ${
                  isSelected ? 'bg-emerald-400/15 text-emerald-300 font-bold' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {opt.icon && <span className={isSelected ? 'text-emerald-400' : 'text-slate-400'}>{opt.icon}</span>}
                  <span>{opt.label}</span>
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Admin: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chartMetric, setChartMetric] = useState<'activeUsers' | 'aiRequests'>('activeUsers');

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
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const [academics, setAcademics] = useState<AcademicAnalytics | null>(null);
  const [aiLogs, setAiLogs] = useState<AILogEntry[]>([]);
  const [aiStatusFilter, setAiStatusFilter] = useState('all');
  const [selectedAiLog, setSelectedAiLog] = useState<AILogEntry | null>(null);
  const [aiTelemetry, setAiTelemetry] = useState<{ avgTokens: number; avgLatency: number; errorRate: number }>({ avgTokens: 0, avgLatency: 0, errorRate: 0 });

  const [payments, setPayments] = useState<PaymentLog[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [dbStats, setDbStats] = useState<CollectionStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditSearch, setAuditSearch] = useState('');

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

  const handleToggleSelectUser = (uid: string) => {
    setSelectedUids(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleSelectAllUsers = () => {
    if (selectedUids.length === users.length) {
      setSelectedUids([]);
    } else {
      setSelectedUids(users.map(u => u.uid));
    }
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

  const handleReplyFeedback = async (id: string, customReply?: string) => {
    const text = customReply || replyText[id];
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
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'users', label: 'User Directory', icon: <Users className="w-4 h-4" /> },
    { id: 'ai', label: 'AI Request Logs', icon: <Bot className="w-4 h-4" /> },
    { id: 'academics', label: 'Academic Insights', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'billing', label: 'Billing & MRR', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'announcements', label: 'Support & Broadcasts', icon: <Megaphone className="w-4 h-4" /> },
    { id: 'health', label: 'System Health', icon: <Activity className="w-4 h-4" /> },
    { id: 'audit', label: 'Admin Audit Trail', icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  const roleOptions: CustomSelectOption[] = [
    { value: 'all', label: 'All Roles', icon: <Users className="w-3.5 h-3.5" /> },
    { value: 'user', label: 'Users Only', icon: <UserCheck className="w-3.5 h-3.5" /> },
    { value: 'admin', label: 'Admins Only', icon: <Crown className="w-3.5 h-3.5" /> },
  ];

  const planOptions: CustomSelectOption[] = [
    { value: 'all', label: 'All Plans', icon: <CreditCard className="w-3.5 h-3.5" /> },
    { value: 'free', label: 'Free Tier', icon: <Zap className="w-3.5 h-3.5" /> },
    { value: 'premium', label: 'Premium Pro', icon: <Crown className="w-3.5 h-3.5" /> },
  ];

  const statusOptions: CustomSelectOption[] = [
    { value: 'all', label: 'All Statuses', icon: <Activity className="w-3.5 h-3.5" /> },
    { value: 'active', label: 'Active Only', icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> },
    { value: 'suspended', label: 'Suspended Only', icon: <UserX className="w-3.5 h-3.5 text-rose-400" /> },
  ];

  const aiStatusOptions: CustomSelectOption[] = [
    { value: 'all', label: 'All Request Statuses', icon: <Bot className="w-3.5 h-3.5" /> },
    { value: 'success', label: 'Success Only', icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> },
    { value: 'failed', label: 'Failed Only', icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> },
  ];

  const annTypeOptions: CustomSelectOption[] = [
    { value: 'info', label: 'Info (Blue)', icon: <Info className="w-3.5 h-3.5 text-blue-400" /> },
    { value: 'warning', label: 'Warning (Amber)', icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> },
    { value: 'success', label: 'Success (Green)', icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> },
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
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* LEFT VERTICAL ADMIN SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 lg:w-72 bg-[#090e15] border-r border-white/10 flex flex-col justify-between p-5 transition-transform duration-300 md:static md:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div>
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

        <div className="pt-6 border-t border-white/10 space-y-2">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Student Workspace</span>
          </button>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/20 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* RIGHT MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8 min-w-0">
        
        {/* Header Title Bar */}
        <div className="flex items-center justify-between pb-6 mb-6 border-b border-white/10">
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              {menuItems.find(m => m.id === activeTab)?.label}
            </h2>
            <p className="text-xs text-slate-400 mt-1">Real-time system telemetry and RBAC permissions</p>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'users' && (
              <button
                onClick={handleExportUsersCsv}
                className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-2 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            )}
            <button
              onClick={() => fetchTabData(activeTab)}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-semibold flex items-center gap-2 transition active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Status Alert Banner */}
        {statusMessage && (
          <div className={`mb-6 p-4 rounded-xl text-sm font-medium border flex items-center justify-between ${
            statusMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <span>{statusMessage.text}</span>
            <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Tab Contents */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 animate-pulse font-mono text-xs">Fetching system telemetry...</div>
        ) : (
          <>
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && overview && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="p-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-sm relative overflow-hidden group hover:border-emerald-400/30 transition">
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Registered Users</p>
                      <Users className="w-5 h-5 text-emerald-400" />
                    </div>
                    <p className="mt-3 text-4xl font-extrabold text-white tracking-tight">{overview.totalUsers}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                      <p className="text-xs text-emerald-400 font-medium">Active today: {overview.activeUsersToday}</p>
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-sm relative overflow-hidden group hover:border-emerald-400/30 transition">
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Plan Conversion</p>
                      <Crown className="w-5 h-5 text-amber-400" />
                    </div>
                    <p className="mt-3 text-4xl font-extrabold text-emerald-300">{overview.premiumUsers} <span className="text-sm font-normal text-slate-400">Pro</span></p>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                      <span>{overview.freeUsers} Free Users</span>
                      <span className="font-mono text-emerald-400 font-bold">{overview.conversionRate || 0}% Rate</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${Math.min(100, overview.conversionRate || 0)}%` }} />
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-sm relative overflow-hidden group hover:border-violet-400/30 transition">
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Zen AI Prompts</p>
                      <Bot className="w-5 h-5 text-violet-400" />
                    </div>
                    <p className="mt-3 text-4xl font-extrabold text-violet-300">{overview.promptsToday} <span className="text-sm font-normal text-slate-400">today</span></p>
                    <p className="mt-2 text-xs text-slate-400 font-mono">{overview.promptsMonth} prompts generated this month</p>
                  </div>

                  <div className="p-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-sm relative overflow-hidden group hover:border-amber-400/30 transition">
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Estimated MRR</p>
                      <CreditCard className="w-5 h-5 text-amber-400" />
                    </div>
                    <p className="mt-3 text-4xl font-extrabold text-amber-300">PHP {overview.estimatedMRR.toLocaleString()}</p>
                    <p className="mt-2 text-xs text-slate-400 font-mono">{overview.totalFocusMinutes.toLocaleString()} focus mins logged</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 p-6 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col justify-between">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-6">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">7-Day System Activity Telemetry</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Daily active student engagement across the week</p>
                      </div>
                      <div className="flex rounded-xl bg-white/5 p-1 border border-white/10 text-xs font-bold">
                        <button
                          onClick={() => setChartMetric('activeUsers')}
                          className={`px-3 py-1 rounded-lg transition ${chartMetric === 'activeUsers' ? 'bg-emerald-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                          Active Students
                        </button>
                        <button
                          onClick={() => setChartMetric('aiRequests')}
                          className={`px-3 py-1 rounded-lg transition ${chartMetric === 'aiRequests' ? 'bg-violet-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                          AI Prompts
                        </button>
                      </div>
                    </div>

                    {overview.dailyStats && overview.dailyStats.length > 0 ? (
                      <div className="flex items-end justify-between gap-3 h-48 pt-6 px-2">
                        {overview.dailyStats.map((day) => {
                          const val = day[chartMetric];
                          const maxVal = Math.max(...overview.dailyStats!.map(d => d[chartMetric]), 1);
                          const heightPct = Math.max(12, Math.round((val / maxVal) * 100));

                          return (
                            <div key={day.date} className="flex-1 flex flex-col items-center gap-2 group relative">
                              <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-white/20 text-white text-[10px] font-mono px-2 py-1 rounded shadow-xl pointer-events-none whitespace-nowrap z-20">
                                {day.dayName} ({day.date}): {val} {chartMetric === 'activeUsers' ? 'active' : 'prompts'}
                              </div>

                              <div className="w-full bg-white/5 rounded-t-xl overflow-hidden h-full flex items-end">
                                <div
                                  className={`w-full rounded-t-xl transition-all duration-500 group-hover:brightness-125 ${
                                    chartMetric === 'activeUsers' ? 'bg-gradient-to-t from-emerald-500/40 to-emerald-400' : 'bg-gradient-to-t from-violet-500/40 to-violet-400'
                                  }`}
                                  style={{ height: `${heightPct}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 uppercase">{day.dayName}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-48 flex items-center justify-center text-xs text-slate-500 font-mono">No telemetry points recorded</div>
                    )}
                  </div>

                  <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 border-b border-white/5 pb-4 mb-4">Quick Control Shortcuts</h3>
                      
                      <div className="space-y-3">
                        <button onClick={() => setActiveTab('announcements')} className="w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left text-xs font-semibold flex items-center gap-3 transition group">
                          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-300">
                            <Megaphone className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-white group-hover:text-emerald-300 transition">Broadcast System Banner</p>
                            <p className="text-[11px] text-slate-400 font-normal">Push notification banner to all active students</p>
                          </div>
                        </button>

                        <button onClick={() => setActiveTab('users')} className="w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left text-xs font-semibold flex items-center gap-3 transition group">
                          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-300">
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-white group-hover:text-blue-300 transition">User & Role Management</p>
                            <p className="text-[11px] text-slate-400 font-normal">Promote admins, grant plans, reset AI limits</p>
                          </div>
                        </button>

                        <button onClick={() => setActiveTab('ai')} className="w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left text-xs font-semibold flex items-center gap-3 transition group">
                          <div className="p-2 rounded-lg bg-violet-500/10 text-violet-300">
                            <Bot className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-white group-hover:text-violet-300 transition">Inspect Live AI Logs</p>
                            <p className="text-[11px] text-slate-400 font-normal">View prompt tokens, latencies & status codes</p>
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-white">Maintenance Mode</p>
                        <p className="text-[10px] text-slate-400">Lock non-admin access</p>
                      </div>
                      <button
                        onClick={handleToggleMaintenance}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition flex items-center gap-1.5 ${
                          health?.maintenanceMode ? 'bg-rose-500 text-white' : 'bg-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {health?.maintenanceMode ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        <span>{health?.maintenanceMode ? 'ACTIVE' : 'OFF'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: USER DIRECTORY & BATCH ACTIONS */}
            {activeTab === 'users' && (
              <div>
                <form onSubmit={handleUserSearch} className="flex flex-col sm:flex-row gap-3 mb-4 items-center">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search by email, name, or UID..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0b121c] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div className="flex gap-2.5 w-full sm:w-auto">
                    <CustomSelect
                      value={roleFilter}
                      options={roleOptions}
                      onChange={(val) => { setRoleFilter(val); fetchUsers(userSearch, 1, val, planFilter, statusFilter); }}
                    />

                    <CustomSelect
                      value={planFilter}
                      options={planOptions}
                      onChange={(val) => { setPlanFilter(val); fetchUsers(userSearch, 1, roleFilter, val, statusFilter); }}
                    />

                    <CustomSelect
                      value={statusFilter}
                      options={statusOptions}
                      onChange={(val) => { setStatusFilter(val); fetchUsers(userSearch, 1, roleFilter, planFilter, val); }}
                    />

                    <button type="submit" className="px-4 py-2.5 rounded-xl bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider hover:bg-emerald-300 transition">
                      Filter
                    </button>
                  </div>
                </form>

                {/* Batch Action Bar */}
                {selectedUids.length > 0 && (
                  <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-200 animate-fade-in">
                    <span>Selected <strong>{selectedUids.length}</strong> student accounts</span>
                    <div className="flex gap-2">
                      <button onClick={() => handleBatchAction('grant_plan')} className="px-3 py-1 rounded bg-emerald-400 text-slate-950 font-bold uppercase text-[10px]">
                        Batch Grant Pro
                      </button>
                      <button onClick={() => handleBatchAction('reset_ai')} className="px-3 py-1 rounded bg-violet-500 text-white font-bold uppercase text-[10px]">
                        Batch Reset AI
                      </button>
                      <button onClick={() => handleBatchAction('suspend')} className="px-3 py-1 rounded bg-rose-500 text-white font-bold uppercase text-[10px]">
                        Batch Suspend
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-white/5 uppercase font-mono text-[10px] text-slate-400 border-b border-white/10">
                      <tr>
                        <th className="p-4 w-10">
                          <input type="checkbox" checked={selectedUids.length > 0 && selectedUids.length === users.length} onChange={handleSelectAllUsers} />
                        </th>
                        <th className="p-4">User</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Plan</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Daily AI</th>
                        <th className="p-4">Joined</th>
                        <th className="p-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {users.map((u) => (
                        <tr key={u.uid} className="hover:bg-white/[0.02] transition">
                          <td className="p-4">
                            <input type="checkbox" checked={selectedUids.includes(u.uid)} onChange={() => handleToggleSelectUser(u.uid)} />
                          </td>
                          <td className="p-4 cursor-pointer" onClick={() => setSelectedUser(u)}>
                            <p className="font-semibold text-white hover:text-emerald-300 transition">{u.name}</p>
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
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.isSuspended ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                              {u.isSuspended ? 'SUSPENDED' : 'Active'}
                            </span>
                          </td>
                          <td className="p-4 font-mono">{u.dailyAiCount} reqs</td>
                          <td className="p-4 font-mono text-[11px] text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td className="p-4 flex gap-1.5 flex-wrap">
                            <button onClick={() => handleToggleRole(u.uid, u.role)} className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold uppercase transition">
                              Role ({u.role === 'admin' ? 'User' : 'Admin'})
                            </button>
                            <button onClick={() => handleTogglePlan(u.uid, u.plan)} className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase transition">
                              Plan ({u.plan === 'premium' ? 'Free' : 'Pro'})
                            </button>
                            <button onClick={() => handleSuspendUser(u.uid, !!u.isSuspended)} className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition ${
                              u.isSuspended ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                            }`}>
                              {u.isSuspended ? 'Unsuspend' : 'Suspend'}
                            </button>
                            <button onClick={() => handleResetAiQuota(u.uid)} className="px-2 py-1 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-[10px] font-bold uppercase transition">
                              Reset AI
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between mt-4 text-xs text-slate-400">
                  <span>Page {userPage} of {totalUserPages}</span>
                  <div className="flex gap-2">
                    <button disabled={userPage <= 1} onClick={() => fetchUsers(userSearch, userPage - 1, roleFilter, planFilter, statusFilter)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 transition">
                      ← Previous
                    </button>
                    <button disabled={userPage >= totalUserPages} onClick={() => fetchUsers(userSearch, userPage + 1, roleFilter, planFilter, statusFilter)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 transition">
                      Next →
                    </button>
                  </div>
                </div>

                {selectedUser && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-[#0d141e] border border-white/15 rounded-2xl p-6 space-y-4 shadow-2xl">
                      <div className="flex justify-between items-start border-b border-white/10 pb-3">
                        <div>
                          <h3 className="font-extrabold text-white text-lg">{selectedUser.name}</h3>
                          <p className="text-xs font-mono text-slate-400">{selectedUser.email}</p>
                        </div>
                        <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                        <div className="p-3 rounded-xl bg-white/5">
                          <p className="text-[10px] text-slate-500 uppercase">User UID</p>
                          <p className="text-white truncate">{selectedUser.uid}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white/5">
                          <p className="text-[10px] text-slate-500 uppercase">Role / Plan</p>
                          <p className="text-emerald-300 font-bold uppercase">{selectedUser.role} / {selectedUser.plan}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white/5">
                          <p className="text-[10px] text-slate-500 uppercase">Enrolled Subjects</p>
                          <p className="text-white font-bold">{selectedUser.subjectCount || 0} subjects</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white/5">
                          <p className="text-[10px] text-slate-500 uppercase">Total Tasks</p>
                          <p className="text-white font-bold">{selectedUser.taskCount || 0} tasks</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/10 flex justify-end gap-2">
                        <button onClick={() => { handleResetAiQuota(selectedUser.uid); setSelectedUser(null); }} className="px-3 py-1.5 rounded-xl bg-violet-500/20 text-violet-300 text-xs font-bold">
                          Reset AI Quota
                        </button>
                        <button onClick={() => setSelectedUser(null)} className="px-4 py-2 rounded-xl bg-white/10 text-xs font-bold text-white">
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: AI REQUEST LOGS & INSPECTOR */}
            {activeTab === 'ai' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Average Token Usage</p>
                    <p className="text-2xl font-extrabold text-emerald-300 font-mono mt-1">{aiTelemetry.avgTokens} tokens</p>
                  </div>

                  <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Average Response Latency</p>
                    <p className="text-2xl font-extrabold text-amber-300 font-mono mt-1">{aiTelemetry.avgLatency} ms</p>
                  </div>

                  <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                    <p className="text-[10px] font-bold uppercase text-slate-400">AI Error Rate</p>
                    <p className="text-2xl font-extrabold text-rose-300 font-mono mt-1">{aiTelemetry.errorRate}%</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <CustomSelect
                    value={aiStatusFilter}
                    options={aiStatusOptions}
                    onChange={(val) => { setAiStatusFilter(val); fetchAiLogs(val); }}
                  />
                </div>

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
                        <tr key={log._id} onClick={() => setSelectedAiLog(log)} className="hover:bg-white/[0.04] cursor-pointer transition font-mono">
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

                {selectedAiLog && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-[#0d141e] border border-white/15 rounded-2xl p-6 space-y-4 font-mono text-xs shadow-2xl">
                      <div className="flex justify-between items-center border-b border-white/10 pb-3">
                        <h3 className="font-extrabold text-white text-sm">AI Log Inspector</h3>
                        <button onClick={() => setSelectedAiLog(null)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                      </div>

                      <div className="space-y-2 text-slate-300">
                        <p><strong>Endpoint:</strong> <span className="text-emerald-300">{selectedAiLog.endpoint}</span></p>
                        <p><strong>User UID:</strong> {selectedAiLog.uid}</p>
                        <p><strong>Model:</strong> {selectedAiLog.model || 'DeepSeek V4'}</p>
                        <p><strong>Response Latency:</strong> {selectedAiLog.responseTimeMs} ms</p>
                        <p><strong>Total Tokens:</strong> {selectedAiLog.totalTokens}</p>
                        <p><strong>Status:</strong> {selectedAiLog.success ? 'SUCCESS (200)' : 'FAILED'}</p>
                        {selectedAiLog.errorMessage && (
                          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl">
                            <strong>Error Trace:</strong> {selectedAiLog.errorMessage}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-white/10 flex justify-end">
                        <button onClick={() => setSelectedAiLog(null)} className="px-4 py-2 rounded-xl bg-white/10 text-white font-bold">
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: ACADEMIC INSIGHTS */}
            {activeTab === 'academics' && academics && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">Top Enrolled Study Subjects</h3>
                    <div className="space-y-3">
                      {academics.topSubjects.map((s) => (
                        <div key={s.subject} className="flex justify-between text-xs border-b border-white/5 pb-2">
                          <span className="font-semibold text-white">{s.subject}</span>
                          <span className="font-mono text-emerald-400">{s.count} enrolled students</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">AI Quiz Performance Matrix</h3>
                    <div className="text-center p-8 bg-white/5 rounded-xl border border-white/5">
                      <p className="text-5xl font-extrabold text-emerald-300">{academics.avgQuizScore}%</p>
                      <p className="mt-2 text-xs text-slate-400">Average Student Quiz Score across {academics.totalQuizAttempts} completed attempts</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: BILLING & FINANCIAL COMMAND CENTER */}
            {activeTab === 'billing' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Monthly Recurring Revenue</p>
                    <p className="text-2xl font-extrabold text-amber-300 font-mono mt-1">PHP {overview?.estimatedMRR || 0}</p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Annual Run Rate (ARR)</p>
                    <p className="text-2xl font-extrabold text-emerald-300 font-mono mt-1">PHP {((overview?.estimatedMRR || 0) * 12).toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Active Pro Subscribers</p>
                    <p className="text-2xl font-extrabold text-violet-300 font-mono mt-1">{overview?.premiumUsers || 0}</p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                    <p className="text-[10px] font-bold uppercase text-slate-400">ARPU (Avg Revenue/User)</p>
                    <p className="text-2xl font-extrabold text-blue-300 font-mono mt-1">PHP 119.20</p>
                  </div>
                </div>

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
              </div>
            )}

            {/* TAB 6: ANNOUNCEMENTS & SUPPORT DESK WITH LIVE PREVIEW */}
            {activeTab === 'announcements' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Broadcast Platform Announcement</h3>
                  
                  {(newAnnTitle || newAnnMessage) && (
                    <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/20 via-violet-500/20 to-emerald-500/20 border border-emerald-500/40 text-center text-xs font-medium text-emerald-200">
                      <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">📢 Live Student Banner Preview</span>
                      <span><strong>{newAnnTitle || 'Title'}:</strong> {newAnnMessage || 'Message content'}</span>
                    </div>
                  )}

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
                      <CustomSelect
                        value={newAnnType}
                        options={annTypeOptions}
                        onChange={(val) => setNewAnnType(val as any)}
                      />
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

                <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">Student Support Tickets</h3>
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
                          <div className="space-y-2 mt-2">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Type reply to student..."
                                value={replyText[item._id] || ''}
                                onChange={(e) => setReplyText({ ...replyText, [item._id]: e.target.value })}
                                className="flex-1 px-3 py-1.5 rounded bg-white/5 border border-white/10 text-xs text-white"
                              />
                              <button onClick={() => handleReplyFeedback(item._id)} className="px-3 py-1.5 rounded bg-emerald-400 text-slate-950 font-bold text-xs uppercase">
                                Send
                              </button>
                            </div>
                            <div className="flex gap-1.5">
                              <button onClick={() => handleReplyFeedback(item._id, 'Thank you for reporting this! We have resolved the issue.')} className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-slate-400 hover:text-white">
                                Canned: Resolved Issue
                              </button>
                              <button onClick={() => handleReplyFeedback(item._id, 'Your feature request has been forwarded to our engineering team!')} className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-slate-400 hover:text-white">
                                Canned: Feature Received
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: HEALTH & DEVOPS INSPECTOR */}
            {activeTab === 'health' && health && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
                </div>

                {dbStats && (
                  <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">MongoDB Collection Telemetry</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 font-mono text-xs">
                      <div className="p-3 rounded-xl bg-white/5">
                        <p className="text-[10px] text-slate-500">Users</p>
                        <p className="text-lg font-bold text-white">{dbStats.users}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5">
                        <p className="text-[10px] text-slate-500">Focus Sessions</p>
                        <p className="text-lg font-bold text-white">{dbStats.focusSessions}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5">
                        <p className="text-[10px] text-slate-500">AI Logs</p>
                        <p className="text-lg font-bold text-white">{dbStats.aiLogs}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5">
                        <p className="text-[10px] text-slate-500">Announcements</p>
                        <p className="text-lg font-bold text-white">{dbStats.announcements}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5">
                        <p className="text-[10px] text-slate-500">Feedback</p>
                        <p className="text-lg font-bold text-white">{dbStats.feedback}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5">
                        <p className="text-[10px] text-slate-500">Audit Logs</p>
                        <p className="text-lg font-bold text-white">{dbStats.auditLogs}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] flex items-center justify-between">
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

            {/* TAB 8: ADMIN AUDIT TRAIL */}
            {activeTab === 'audit' && (
              <div className="space-y-4">
                <div className="relative max-w-md">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filter audit log by action or admin email..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#0b121c] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>

                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-white/5 uppercase font-mono text-[10px] text-slate-400 border-b border-white/10">
                      <tr>
                        <th className="p-4">Admin Email</th>
                        <th className="p-4">Action</th>
                        <th className="p-4">Target User UID</th>
                        <th className="p-4">Details</th>
                        <th className="p-4">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {auditLogs
                        .filter(l =>
                          l.adminEmail.toLowerCase().includes(auditSearch.toLowerCase()) ||
                          l.action.toLowerCase().includes(auditSearch.toLowerCase())
                        )
                        .map((log) => (
                          <tr key={log._id} className="hover:bg-white/[0.02] transition font-mono">
                            <td className="p-4 font-semibold text-white">{log.adminEmail}</td>
                            <td className="p-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 uppercase border border-amber-500/30">
                                {log.action}
                              </span>
                            </td>
                            <td className="p-4 text-slate-400">{log.targetUid || 'N/A'}</td>
                            <td className="p-4 text-slate-400 max-w-xs truncate">{JSON.stringify(log.details || {})}</td>
                            <td className="p-4 text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
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
