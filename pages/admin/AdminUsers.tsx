import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  UserRoundX,
  Users,
  X,
} from 'lucide-react';
import { AdminUser, OverviewMetrics } from './types';
import {
  DonutChart,
  HorizontalBars,
  Panel,
  StatCard,
  StatusPill,
  TableFrame,
  formatNumber,
  tableCellClass,
  tableHeadClass,
  tableRowClass,
} from './AdminUI';

interface AdminUsersProps {
  users: AdminUser[];
  overview: OverviewMetrics | null;
  userSearch: string;
  setUserSearch: (q: string) => void;
  roleFilter: string;
  setRoleFilter: (role: string) => void;
  planFilter: string;
  setPlanFilter: (plan: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  userPage: number;
  totalUserPages: number;
  selectedUids: string[];
  setSelectedUids: React.Dispatch<React.SetStateAction<string[]>>;
  onSearch: (e: React.FormEvent) => void;
  onFetchUsers: (q?: string, page?: number, role?: string, plan?: string, status?: string) => void;
  onBatchAction: (action: 'grant_plan' | 'reset_ai' | 'suspend' | 'unsuspend') => void;
  onToggleRole: (uid: string, currentRole: string) => void;
  onTogglePlan: (uid: string, currentPlan: string) => void;
  onSuspendUser: (uid: string, currentSuspended: boolean) => void;
  onResetAiQuota: (uid: string) => void;
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

const FilterSelect: React.FC<FilterSelectProps> = ({ label, value, options, onChange }) => (
  <label className="relative min-w-0">
    <span className="sr-only">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 min-w-[128px] appearance-none rounded-lg border border-[#2b3745] bg-[#0d141d] py-0 pl-3 pr-9 text-xs text-slate-300 outline-none focus:border-[#64ffda]/50 focus:ring-2 focus:ring-[#64ffda]/10"
    >
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
  </label>
);

export const AdminUsers: React.FC<AdminUsersProps> = ({
  users,
  overview,
  userSearch,
  setUserSearch,
  roleFilter,
  setRoleFilter,
  planFilter,
  setPlanFilter,
  statusFilter,
  setStatusFilter,
  userPage,
  totalUserPages,
  selectedUids,
  setSelectedUids,
  onSearch,
  onFetchUsers,
  onBatchAction,
  onToggleRole,
  onTogglePlan,
  onSuspendUser,
  onResetAiQuota,
}) => {
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    if (!selectedUser) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedUser(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedUser]);

  const visiblePro = users.filter((user) => user.plan === 'premium').length;
  const visibleFree = users.filter((user) => user.plan === 'free').length;
  const visibleSuspended = users.filter((user) => user.isSuspended).length;
  const visibleActive = users.length - visibleSuspended;
  const totalStudents = overview?.totalUsers || users.length;
  const proStudents = overview?.premiumUsers || visiblePro;

  const topAiUsers = useMemo(
    () => [...users].sort((a, b) => b.dailyAiCount - a.dailyAiCount).slice(0, 5),
    [users]
  );

  const handleToggleSelectUser = (uid: string) => {
    setSelectedUids((current) => current.includes(uid) ? current.filter((id) => id !== uid) : [...current, uid]);
  };

  const handleSelectAllUsers = () => {
    setSelectedUids(selectedUids.length === users.length ? [] : users.map((user) => user.uid));
  };

  const updateFilters = (filter: 'role' | 'plan' | 'status', value: string) => {
    const role = filter === 'role' ? value : roleFilter;
    const plan = filter === 'plan' ? value : planFilter;
    const status = filter === 'status' ? value : statusFilter;
    if (filter === 'role') setRoleFilter(value);
    if (filter === 'plan') setPlanFilter(value);
    if (filter === 'status') setStatusFilter(value);
    onFetchUsers(userSearch, 1, role, plan, status);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total students" value={formatNumber(totalStudents)} detail="Registered accounts" icon={<Users className="h-[18px] w-[18px]" />} tone="mint" />
        <StatCard label="Visible active" value={formatNumber(visibleActive)} detail="On the current result page" icon={<UserRoundCheck className="h-[18px] w-[18px]" />} tone="mint" />
        <StatCard label="Pro subscribers" value={formatNumber(proStudents)} detail="Premium student accounts" icon={<Crown className="h-[18px] w-[18px]" />} tone="violet" />
        <StatCard label="Visible suspended" value={formatNumber(visibleSuspended)} detail="On the current result page" icon={<UserRoundX className="h-[18px] w-[18px]" />} tone={visibleSuspended > 0 ? 'rose' : 'slate'} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-9">
          <form onSubmit={onSearch} className="flex flex-col gap-2 rounded-xl border border-[#273241] bg-[#101720] p-3 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search users by name, email, or UID</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                type="search"
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search by name, email, or UID"
                className="h-10 w-full rounded-lg border border-[#2b3745] bg-[#0d141d] pl-10 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-[#64ffda]/50 focus:ring-2 focus:ring-[#64ffda]/10"
              />
            </label>
            <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0 custom-scrollbar">
              <FilterSelect label="Role" value={roleFilter} options={[{ value: 'all', label: 'All roles' }, { value: 'user', label: 'Students' }, { value: 'admin', label: 'Admins' }]} onChange={(value) => updateFilters('role', value)} />
              <FilterSelect label="Plan" value={planFilter} options={[{ value: 'all', label: 'All plans' }, { value: 'free', label: 'Free' }, { value: 'premium', label: 'Pro' }]} onChange={(value) => updateFilters('plan', value)} />
              <FilterSelect label="Status" value={statusFilter} options={[{ value: 'all', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]} onChange={(value) => updateFilters('status', value)} />
              <button type="submit" className="h-10 shrink-0 rounded-lg border border-[#64ffda]/20 bg-[#64ffda]/[0.08] px-4 text-xs font-semibold text-[#8affdf] hover:bg-[#64ffda]/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64ffda]/70">Apply</button>
            </div>
          </form>

          <TableFrame>
            <table className="w-full min-w-[980px] text-left">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={`${tableCellClass} w-12`}>
                    <input
                      type="checkbox"
                      aria-label="Select all visible users"
                      checked={users.length > 0 && selectedUids.length === users.length}
                      onChange={handleSelectAllUsers}
                      className="h-4 w-4 rounded border-slate-600 accent-[#64ffda]"
                    />
                  </th>
                  <th scope="col" className={tableCellClass}>Student account</th>
                  <th scope="col" className={tableCellClass}>Role</th>
                  <th scope="col" className={tableCellClass}>Plan</th>
                  <th scope="col" className={tableCellClass}>Status</th>
                  <th scope="col" className={tableCellClass}>Daily AI</th>
                  <th scope="col" className={tableCellClass}>Joined</th>
                  <th scope="col" className={tableCellClass}>Last active</th>
                  <th scope="col" className={`${tableCellClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-xs text-slate-500">No matching user accounts found.</td></tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.uid} className={tableRowClass}>
                      <td className={tableCellClass}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${user.name || user.email}`}
                          checked={selectedUids.includes(user.uid)}
                          onChange={() => handleToggleSelectUser(user.uid)}
                          className="h-4 w-4 rounded border-slate-600 accent-[#64ffda]"
                        />
                      </td>
                      <td className={tableCellClass}>
                        <button type="button" onClick={() => setSelectedUser(user)} className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64ffda]/70 rounded-md">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#344252] bg-[#17212c] text-[11px] font-semibold text-slate-300">
                            {(user.name || user.email).charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block max-w-[210px] truncate font-medium text-slate-200">{user.name || 'Unnamed student'}</span>
                            <span className="mt-0.5 block max-w-[210px] truncate text-[10px] text-slate-500">{user.email}</span>
                          </span>
                        </button>
                      </td>
                      <td className={tableCellClass}><StatusPill label={user.role} tone={user.role === 'admin' ? 'amber' : 'slate'} /></td>
                      <td className={tableCellClass}><StatusPill label={user.plan === 'premium' ? 'Pro' : 'Free'} tone={user.plan === 'premium' ? 'violet' : 'slate'} /></td>
                      <td className={tableCellClass}><StatusPill label={user.isSuspended ? 'Suspended' : 'Active'} tone={user.isSuspended ? 'rose' : 'mint'} dot /></td>
                      <td className={`${tableCellClass} tabular-nums`}>{formatNumber(user.dailyAiCount)}</td>
                      <td className={`${tableCellClass} whitespace-nowrap text-slate-400 tabular-nums`}>{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className={`${tableCellClass} whitespace-nowrap text-slate-400 tabular-nums`}>{new Date(user.lastActive).toLocaleString()}</td>
                      <td className={`${tableCellClass} text-right`}>
                        <button
                          type="button"
                          onClick={() => setSelectedUser(user)}
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#344252] bg-[#151e29] px-2.5 text-[11px] font-medium text-slate-300 hover:border-[#46576a] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64ffda]/70"
                        >
                          Manage <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="flex flex-col gap-3 border-t border-[#273241] px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>Page {userPage} of {Math.max(totalUserPages, 1)}</span>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Previous user page" disabled={userPage <= 1} onClick={() => onFetchUsers(userSearch, userPage - 1, roleFilter, planFilter, statusFilter)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#344252] text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
                <span className="min-w-8 text-center font-medium text-slate-300 tabular-nums">{userPage}</span>
                <button type="button" aria-label="Next user page" disabled={userPage >= totalUserPages} onClick={() => onFetchUsers(userSearch, userPage + 1, roleFilter, planFilter, statusFilter)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#344252] text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
              </div>
            </div>
          </TableFrame>
        </div>

        <div className="space-y-4 xl:col-span-3">
          <Panel title="Plan distribution" subtitle="Current result page">
            <DonutChart
              segments={[
                { label: 'Pro', value: visiblePro, color: '#a78bfa', detail: formatNumber(visiblePro) },
                { label: 'Free', value: visibleFree, color: '#64ffda', detail: formatNumber(visibleFree) },
              ]}
              centerValue={formatNumber(users.length)}
              centerLabel="visible"
              ariaLabel="Plan distribution for visible user results"
              className="sm:grid-cols-1"
            />
          </Panel>
          <Panel title="Activity status" subtitle="Current result page">
            <HorizontalBars
              data={[
                { label: 'Active', value: visibleActive, color: '#64ffda' },
                { label: 'Suspended', value: visibleSuspended, color: '#fb7185' },
              ]}
              ariaLabel="Active and suspended accounts on the current result page"
            />
          </Panel>
          <Panel title="Top daily AI usage" subtitle="Current result page">
            <ol className="space-y-3">
              {topAiUsers.length === 0 ? (
                <li className="text-xs text-slate-500">No usage records on this page.</li>
              ) : topAiUsers.map((user, index) => (
                <li key={user.uid} className="flex items-center gap-3 text-xs">
                  <span className="w-4 text-slate-600 tabular-nums">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-300">{user.name || user.email}</span>
                  <span className="text-[#b9a5ff] tabular-nums">{formatNumber(user.dailyAiCount)}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      {selectedUids.length > 0 && (
        <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-xl border border-[#4a5c70] bg-[#111923]/95 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur sm:flex-row sm:items-center sm:justify-between" role="status">
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#64ffda]/10 text-[#64ffda]"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /></span>
            <span><strong className="text-white">{selectedUids.length}</strong> account{selectedUids.length === 1 ? '' : 's'} selected</span>
            <button type="button" onClick={() => setSelectedUids([])} aria-label="Clear selected users" className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" aria-hidden="true" /></button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onBatchAction('grant_plan')} className="min-h-9 rounded-lg border border-[#a78bfa]/25 bg-[#a78bfa]/[0.08] px-3 text-xs font-semibold text-[#c4b5fd] hover:bg-[#a78bfa]/[0.13]"><Sparkles className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />Grant Pro</button>
            <button type="button" onClick={() => onBatchAction('reset_ai')} className="min-h-9 rounded-lg border border-[#64ffda]/20 bg-[#64ffda]/[0.07] px-3 text-xs font-semibold text-[#8affdf] hover:bg-[#64ffda]/[0.12]"><Bot className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />Reset AI</button>
            <button type="button" onClick={() => { if (window.confirm(`Suspend ${selectedUids.length} selected account${selectedUids.length === 1 ? '' : 's'}?`)) onBatchAction('suspend'); }} className="min-h-9 rounded-lg border border-rose-400/25 bg-rose-400/[0.08] px-3 text-xs font-semibold text-rose-200 hover:bg-rose-400/[0.13]"><UserRoundX className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />Suspend</button>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedUser(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="user-detail-title" className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#3a4858] bg-[#0f171f] shadow-[0_32px_100px_rgba(0,0,0,0.65)]">
            <header className="flex items-start justify-between gap-4 border-b border-[#273241] px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#64ffda]/20 bg-[#64ffda]/[0.07] text-sm font-semibold text-[#8affdf]">{(selectedUser.name || selectedUser.email).charAt(0).toUpperCase()}</span>
                <div className="min-w-0">
                  <h3 id="user-detail-title" className="truncate text-base font-semibold text-white">{selectedUser.name || 'Unnamed student'}</h3>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{selectedUser.email}</p>
                </div>
              </div>
              <button type="button" aria-label="Close user details" onClick={() => setSelectedUser(null)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64ffda]/70"><X className="h-4 w-4" aria-hidden="true" /></button>
            </header>
            <div className="p-5">
              <div className="flex flex-wrap gap-2">
                <StatusPill label={selectedUser.role} tone={selectedUser.role === 'admin' ? 'amber' : 'slate'} />
                <StatusPill label={selectedUser.plan === 'premium' ? 'Pro' : 'Free'} tone={selectedUser.plan === 'premium' ? 'violet' : 'slate'} />
                <StatusPill label={selectedUser.isSuspended ? 'Suspended' : 'Active'} tone={selectedUser.isSuspended ? 'rose' : 'mint'} dot />
              </div>
              <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  ['User UID', selectedUser.uid],
                  ['Billing status', selectedUser.billingStatus || 'Not recorded'],
                  ['Subjects', formatNumber(selectedUser.subjectCount || 0)],
                  ['Tasks', formatNumber(selectedUser.taskCount || 0)],
                  ['Total AI requests', formatNumber(selectedUser.totalAiRequests)],
                  ['Daily AI requests', formatNumber(selectedUser.dailyAiCount)],
                  ['Joined', new Date(selectedUser.createdAt).toLocaleString()],
                  ['Last active', new Date(selectedUser.lastActive).toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-lg border border-[#273241] bg-[#0b1219] p-3">
                    <dt className="text-[10px] uppercase tracking-[0.08em] text-slate-600">{label}</dt>
                    <dd className="mt-1 [overflow-wrap:anywhere] text-xs font-medium text-slate-300">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 border-t border-[#273241] pt-5">
                <p className="mb-3 text-xs font-semibold text-slate-300">Account actions</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => { onToggleRole(selectedUser.uid, selectedUser.role); setSelectedUser(null); }} className="flex min-h-11 items-center gap-2 rounded-lg border border-[#344252] bg-[#151e29] px-3 text-xs font-medium text-slate-200 hover:border-[#46576a]"><ShieldCheck className="h-4 w-4 text-amber-300" aria-hidden="true" />Change to {selectedUser.role === 'admin' ? 'student' : 'admin'}</button>
                  <button type="button" onClick={() => { onTogglePlan(selectedUser.uid, selectedUser.plan); setSelectedUser(null); }} className="flex min-h-11 items-center gap-2 rounded-lg border border-[#a78bfa]/20 bg-[#a78bfa]/[0.07] px-3 text-xs font-medium text-[#c4b5fd] hover:bg-[#a78bfa]/[0.12]"><Crown className="h-4 w-4" aria-hidden="true" />Change to {selectedUser.plan === 'premium' ? 'Free' : 'Pro'}</button>
                  <button type="button" onClick={() => { onResetAiQuota(selectedUser.uid); setSelectedUser(null); }} className="flex min-h-11 items-center gap-2 rounded-lg border border-[#64ffda]/20 bg-[#64ffda]/[0.07] px-3 text-xs font-medium text-[#8affdf] hover:bg-[#64ffda]/[0.12]"><Bot className="h-4 w-4" aria-hidden="true" />Reset daily AI quota</button>
                  <button type="button" onClick={() => { const action = selectedUser.isSuspended ? 'reactivate' : 'suspend'; if (window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} this account?`)) { onSuspendUser(selectedUser.uid, !!selectedUser.isSuspended); setSelectedUser(null); } }} className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-medium ${selectedUser.isSuspended ? 'border-[#64ffda]/20 bg-[#64ffda]/[0.07] text-[#8affdf]' : 'border-rose-400/25 bg-rose-400/[0.08] text-rose-200'}`}><UserRoundX className="h-4 w-4" aria-hidden="true" />{selectedUser.isSuspended ? 'Reactivate account' : 'Suspend account'}</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
