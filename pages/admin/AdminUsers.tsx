import React, { useState } from 'react';
import {
  Search,
  Users,
  UserCheck,
  Crown,
  CreditCard,
  Zap,
  Activity,
  CheckCircle2,
  UserX,
  Sparkles,
  X,
} from 'lucide-react';
import { AdminUser, CustomSelectOption } from './types';
import { CustomSelect } from './CustomSelect';

interface AdminUsersProps {
  users: AdminUser[];
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

export const AdminUsers: React.FC<AdminUsersProps> = ({
  users,
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
    { value: 'active', label: 'Active Only', icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> },
    { value: 'suspended', label: 'Suspended Only', icon: <UserX className="w-3.5 h-3.5 text-rose-400" /> },
  ];

  const handleToggleSelectUser = (uid: string) => {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSelectAllUsers = () => {
    if (selectedUids.length === users.length) {
      setSelectedUids([]);
    } else {
      setSelectedUids(users.map((u) => u.uid));
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <form onSubmit={onSearch} className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by email, name, or UID..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#0e1626] border border-slate-700/60 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400/80 shadow-inner"
          />
        </div>

        <div className="flex gap-2.5 w-full sm:w-auto">
          <CustomSelect
            value={roleFilter}
            options={roleOptions}
            onChange={(val) => {
              setRoleFilter(val);
              onFetchUsers(userSearch, 1, val, planFilter, statusFilter);
            }}
          />

          <CustomSelect
            value={planFilter}
            options={planOptions}
            onChange={(val) => {
              setPlanFilter(val);
              onFetchUsers(userSearch, 1, roleFilter, val, statusFilter);
            }}
          />

          <CustomSelect
            value={statusFilter}
            options={statusOptions}
            onChange={(val) => {
              setStatusFilter(val);
              onFetchUsers(userSearch, 1, roleFilter, planFilter, val);
            }}
          />

          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold text-xs uppercase tracking-wider hover:bg-emerald-500/30 transition"
          >
            Filter
          </button>
        </div>
      </form>

      {/* Batch Action Bar */}
      {selectedUids.length > 0 && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-200 animate-fade-in">
          <span>
            Selected <strong>{selectedUids.length}</strong> student accounts
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onBatchAction('grant_plan')}
              className="px-3 py-1 rounded-md bg-emerald-400 text-slate-950 font-bold uppercase text-[10px]"
            >
              Batch Grant Pro
            </button>
            <button
              onClick={() => onBatchAction('reset_ai')}
              className="px-3 py-1 rounded-md bg-violet-500 text-white font-bold uppercase text-[10px]"
            >
              Batch Reset AI
            </button>
            <button
              onClick={() => onBatchAction('suspend')}
              className="px-3 py-1 rounded-md bg-rose-500 text-white font-bold uppercase text-[10px]"
            >
              Batch Suspend
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0c121e]">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/80 uppercase font-mono text-[10px] text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-3.5 w-10">
                <input
                  type="checkbox"
                  checked={selectedUids.length > 0 && selectedUids.length === users.length}
                  onChange={handleSelectAllUsers}
                  className="rounded accent-emerald-400"
                />
              </th>
              <th scope="col" className="p-3.5">Student Account</th>
              <th scope="col" className="p-3.5">Role</th>
              <th scope="col" className="p-3.5">Plan</th>
              <th scope="col" className="p-3.5">Status</th>
              <th scope="col" className="p-3.5">Daily AI</th>
              <th scope="col" className="p-3.5">Joined Date</th>
              <th scope="col" className="p-3.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {users.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400 font-mono text-xs">
                  No matching user accounts found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.uid} className="hover:bg-slate-800/40 transition">
                  <td className="p-3.5">
                    <input
                      type="checkbox"
                      checked={selectedUids.includes(u.uid)}
                      onChange={() => handleToggleSelectUser(u.uid)}
                      className="rounded accent-emerald-400"
                    />
                  </td>
                  <td className="p-3.5 cursor-pointer" onClick={() => setSelectedUser(u)}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center border border-slate-700 text-xs uppercase">
                        {u.name ? u.name.charAt(0) : u.email.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-white hover:text-emerald-300 transition">{u.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1 w-fit ${
                        u.role === 'admin' ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {u.role === 'admin' && <Crown className="w-3 h-3 text-amber-400" />}
                      <span>{u.role}</span>
                    </span>
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1 w-fit ${
                        u.plan === 'premium' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {u.plan === 'premium' && <Sparkles className="w-3 h-3 text-emerald-400" />}
                      <span>{u.plan}</span>
                    </span>
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1.5 w-fit ${
                        u.isSuspended ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${u.isSuspended ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                      <span>{u.isSuspended ? 'SUSPENDED' : 'Active'}</span>
                    </span>
                  </td>
                  <td className="p-3.5 font-mono text-slate-300">{u.dailyAiCount} reqs</td>
                  <td className="p-3.5 font-mono text-[11px] text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="p-3.5 flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => onToggleRole(u.uid, u.role)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold uppercase transition"
                    >
                      Role ({u.role === 'admin' ? 'User' : 'Admin'})
                    </button>
                    <button
                      onClick={() => onTogglePlan(u.uid, u.plan)}
                      className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-semibold uppercase transition"
                    >
                      Plan ({u.plan === 'premium' ? 'Free' : 'Pro'})
                    </button>
                    <button
                      onClick={() => onSuspendUser(u.uid, !!u.isSuspended)}
                      className={`px-2 py-1 rounded text-[10px] font-semibold uppercase transition ${
                        u.isSuspended ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {u.isSuspended ? 'Unsuspend' : 'Suspend'}
                    </button>
                    <button
                      onClick={() => onResetAiQuota(u.uid)}
                      className="px-2 py-1 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-[10px] font-semibold uppercase transition"
                    >
                      Reset AI
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-xs text-slate-400">
        <span>
          Page {userPage} of {totalUserPages}
        </span>
        <div className="flex gap-2">
          <button
            disabled={userPage <= 1}
            onClick={() => onFetchUsers(userSearch, userPage - 1, roleFilter, planFilter, statusFilter)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-50 transition"
          >
            ← Previous
          </button>
          <button
            disabled={userPage >= totalUserPages}
            onClick={() => onFetchUsers(userSearch, userPage + 1, roleFilter, planFilter, statusFilter)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-50 transition"
          >
            Next →
          </button>
        </div>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0d1420] border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-white text-lg">{selectedUser.name}</h3>
                <p className="text-xs font-mono text-slate-400">{selectedUser.email}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-900">
                <p className="text-[10px] text-slate-500 uppercase">User UID</p>
                <p className="text-white truncate">{selectedUser.uid}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900">
                <p className="text-[10px] text-slate-500 uppercase">Role / Plan</p>
                <p className="text-emerald-300 font-bold uppercase">
                  {selectedUser.role} / {selectedUser.plan}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900">
                <p className="text-[10px] text-slate-500 uppercase">Enrolled Subjects</p>
                <p className="text-white font-bold">{selectedUser.subjectCount || 0} subjects</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900">
                <p className="text-[10px] text-slate-500 uppercase">Total Tasks</p>
                <p className="text-white font-bold">{selectedUser.taskCount || 0} tasks</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => {
                  onResetAiQuota(selectedUser.uid);
                  setSelectedUser(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-violet-500/20 text-violet-300 text-xs font-bold"
              >
                Reset AI Quota
              </button>
              <button onClick={() => setSelectedUser(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-white">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
