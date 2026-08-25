import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ChevronDown,
  Eye,
  FileClock,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { AuditLogItem } from './types';
import {
  EmptyData,
  HorizontalBars,
  LineChart,
  Panel,
  StatCard,
  StatusPill,
  TableFrame,
  formatNumber,
  tableCellClass,
  tableHeadClass,
  tableRowClass,
} from './AdminUI';

interface AdminAuditProps {
  auditLogs: AuditLogItem[];
}

const actionTone = (action: string): 'mint' | 'violet' | 'amber' | 'rose' | 'slate' => {
  const normalized = action.toLowerCase();
  if (normalized.includes('suspend') || normalized.includes('security') || normalized.includes('delete')) return 'rose';
  if (normalized.includes('role') || normalized.includes('maintenance')) return 'amber';
  if (normalized.includes('ai') || normalized.includes('quota')) return 'violet';
  if (normalized.includes('plan') || normalized.includes('announcement') || normalized.includes('reply')) return 'mint';
  return 'slate';
};

export const AdminAudit: React.FC<AdminAuditProps> = ({ auditLogs }) => {
  const [auditSearch, setAuditSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [adminFilter, setAdminFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  useEffect(() => {
    if (!selectedLog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedLog(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedLog]);

  const actions = useMemo(() => [...new Set(auditLogs.map((log) => log.action))].sort(), [auditLogs]);
  const admins = useMemo(() => [...new Set(auditLogs.map((log) => log.adminEmail))].sort(), [auditLogs]);
  const uniqueTargets = new Set(auditLogs.map((log) => log.targetUid).filter(Boolean)).size;
  const sensitiveActions = auditLogs.filter((log) => ['rose', 'amber'].includes(actionTone(log.action))).length;

  const filteredLogs = useMemo(() => {
    const query = auditSearch.trim().toLowerCase();
    return auditLogs.filter((log) => {
      const matchesQuery = !query
        || log.adminEmail.toLowerCase().includes(query)
        || log.action.toLowerCase().includes(query)
        || (log.targetUid || '').toLowerCase().includes(query)
        || JSON.stringify(log.details || {}).toLowerCase().includes(query);
      const matchesAction = actionFilter === 'all' || log.action === actionFilter;
      const matchesAdmin = adminFilter === 'all' || log.adminEmail === adminFilter;
      return matchesQuery && matchesAction && matchesAdmin;
    });
  }, [actionFilter, adminFilter, auditLogs, auditSearch]);

  const actionCounts = useMemo(() => {
    const counts = auditLogs.reduce<Record<string, number>>((result, log) => {
      result[log.action] = (result[log.action] || 0) + 1;
      return result;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [auditLogs]);

  const adminCounts = useMemo(() => {
    const counts = auditLogs.reduce<Record<string, number>>((result, log) => {
      result[log.adminEmail] = (result[log.adminEmail] || 0) + 1;
      return result;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [auditLogs]);

  const dailyVolume = useMemo(() => {
    const counts = new Map<string, { date: Date; count: number }>();
    auditLogs.forEach((log) => {
      const date = new Date(log.createdAt);
      if (Number.isNaN(date.getTime())) return;
      const key = date.toISOString().slice(0, 10);
      const current = counts.get(key);
      counts.set(key, { date, count: (current?.count || 0) + 1 });
    });
    return [...counts.values()].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(-10);
  }, [auditLogs]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Actions captured" value={formatNumber(auditLogs.length)} detail="Current audit response" icon={<Activity className="h-[18px] w-[18px]" />} tone="mint" />
        <StatCard label="Active administrators" value={formatNumber(admins.length)} detail="Unique admin identities" icon={<Users className="h-[18px] w-[18px]" />} tone="mint" />
        <StatCard label="Targeted accounts" value={formatNumber(uniqueTargets)} detail="Unique user UIDs" icon={<UserCog className="h-[18px] w-[18px]" />} tone="violet" />
        <StatCard label="Sensitive actions" value={formatNumber(sensitiveActions)} detail="Role, maintenance, or destructive events" icon={<ShieldAlert className="h-[18px] w-[18px]" />} tone={sensitiveActions > 0 ? 'amber' : 'slate'} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel title="Admin action volume" subtitle="Audit records grouped by date" className="xl:col-span-6">
          {dailyVolume.length > 0 ? (
            <LineChart
              labels={dailyVolume.map((entry) => entry.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}
              series={[{ name: 'Admin actions', values: dailyVolume.map((entry) => entry.count), color: '#64ffda', fill: true }]}
              ariaLabel="Administrative action volume grouped by date"
              valueFormatter={(value) => Math.round(value).toString()}
            />
          ) : <EmptyData title="No audit volume data" />}
        </Panel>

        <Panel title="Action distribution" subtitle="Most frequent administrator workflows" className="xl:col-span-3">
          <HorizontalBars
            data={actionCounts.slice(0, 7).map(([label, value]) => ({
              label,
              value,
              color: actionTone(label) === 'rose' ? '#fb7185' : actionTone(label) === 'amber' ? '#fbbf24' : actionTone(label) === 'violet' ? '#a78bfa' : '#64ffda',
            }))}
            ariaLabel="Audit records grouped by action type"
            emptyMessage="No action types recorded"
          />
        </Panel>

        <Panel title="Top administrators" subtitle="Ranked by captured actions" className="xl:col-span-3">
          {adminCounts.length === 0 ? <EmptyData title="No administrator activity" /> : (
            <ol className="space-y-3">
              {adminCounts.slice(0, 7).map(([email, count], index) => (
                <li key={email} className="flex items-center gap-3 text-xs">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#344252] bg-[#151e29] text-[10px] font-semibold text-slate-400">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-300" title={email}>{email}</span>
                  <span className="font-medium text-[#8affdf] tabular-nums">{formatNumber(count)}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <Panel title="Audit records" subtitle={`${formatNumber(filteredLogs.length)} matching events`} bodyClassName="p-0">
        <div className="flex flex-col gap-2 border-b border-[#273241] p-3 md:flex-row md:items-center">
          <label className="relative min-w-0 flex-1 md:max-w-md">
            <span className="sr-only">Search audit records</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input type="search" value={auditSearch} onChange={(event) => setAuditSearch(event.target.value)} placeholder="Search admin, action, target, or details" className="h-10 w-full rounded-lg border border-[#2b3745] bg-[#0d141d] pl-10 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-[#64ffda]/50 focus:ring-2 focus:ring-[#64ffda]/10" />
          </label>
          <label className="relative">
            <span className="sr-only">Filter by action</span>
            <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} className="h-10 min-w-[150px] appearance-none rounded-lg border border-[#2b3745] bg-[#0d141d] pl-3 pr-9 text-xs text-slate-300 outline-none focus:border-[#64ffda]/50">
              <option value="all">All actions</option>
              {actions.map((action) => <option key={action} value={action}>{action}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          </label>
          <label className="relative">
            <span className="sr-only">Filter by administrator</span>
            <select value={adminFilter} onChange={(event) => setAdminFilter(event.target.value)} className="h-10 min-w-[170px] appearance-none rounded-lg border border-[#2b3745] bg-[#0d141d] pl-3 pr-9 text-xs text-slate-300 outline-none focus:border-[#64ffda]/50">
              <option value="all">All administrators</option>
              {admins.map((admin) => <option key={admin} value={admin}>{admin}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          </label>
        </div>
        <TableFrame className="rounded-none border-0">
          <table className="w-full min-w-[980px] text-left">
            <thead className={tableHeadClass}>
              <tr>
                <th scope="col" className={tableCellClass}>Administrator</th>
                <th scope="col" className={tableCellClass}>Action</th>
                <th scope="col" className={tableCellClass}>Target user</th>
                <th scope="col" className={tableCellClass}>Details</th>
                <th scope="col" className={tableCellClass}>Timestamp</th>
                <th scope="col" className={`${tableCellClass} text-right`}>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-xs text-slate-500">No matching audit trail records found.</td></tr>
              ) : filteredLogs.map((log) => (
                <tr key={log._id} className={tableRowClass}>
                  <td className={`${tableCellClass} max-w-[230px] truncate font-medium text-slate-200`} title={log.adminEmail}>{log.adminEmail}</td>
                  <td className={tableCellClass}><StatusPill label={log.action} tone={actionTone(log.action)} /></td>
                  <td className={`${tableCellClass} max-w-[180px] truncate font-mono text-[11px] text-slate-500`} title={log.targetUid || 'Not applicable'}>{log.targetUid || 'N/A'}</td>
                  <td className={`${tableCellClass} max-w-[300px] truncate text-slate-400`} title={JSON.stringify(log.details || {})}>{JSON.stringify(log.details || {})}</td>
                  <td className={`${tableCellClass} whitespace-nowrap text-slate-500 tabular-nums`}>{new Date(log.createdAt).toLocaleString()}</td>
                  <td className={`${tableCellClass} text-right`}><button type="button" aria-label={`Inspect audit record ${log._id}`} onClick={() => setSelectedLog(log)} className="grid h-8 w-8 place-items-center rounded-md border border-[#344252] text-slate-400 hover:border-[#46576a] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64ffda]/70"><Eye className="h-3.5 w-3.5" aria-hidden="true" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
      </Panel>

      {selectedLog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedLog(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="audit-detail-title" className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#3a4858] bg-[#0f171f] shadow-[0_32px_100px_rgba(0,0,0,0.65)]">
            <header className="flex items-start justify-between gap-4 border-b border-[#273241] px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-amber-400/20 bg-amber-400/[0.07] text-amber-300"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span>
                <div>
                  <h3 id="audit-detail-title" className="text-base font-semibold text-white">Audit record</h3>
                  <p className="mt-0.5 text-xs text-slate-500">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <button type="button" aria-label="Close audit record" onClick={() => setSelectedLog(null)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64ffda]/70"><X className="h-4 w-4" aria-hidden="true" /></button>
            </header>
            <div className="p-5">
              <div className="flex flex-wrap gap-2"><StatusPill label={selectedLog.action} tone={actionTone(selectedLog.action)} /><StatusPill label={selectedLog.adminEmail} tone="slate" /></div>
              <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[#273241] bg-[#0b1219] p-3"><dt className="text-[10px] uppercase tracking-[0.08em] text-slate-600">Administrator</dt><dd className="mt-1 [overflow-wrap:anywhere] text-xs font-medium text-slate-300">{selectedLog.adminEmail}</dd></div>
                <div className="rounded-lg border border-[#273241] bg-[#0b1219] p-3"><dt className="text-[10px] uppercase tracking-[0.08em] text-slate-600">Target UID</dt><dd className="mt-1 [overflow-wrap:anywhere] font-mono text-xs text-slate-300">{selectedLog.targetUid || 'Not applicable'}</dd></div>
              </dl>
              <div className="mt-3 rounded-lg border border-[#273241] bg-[#0b1219] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300"><FileClock className="h-4 w-4 text-[#a78bfa]" aria-hidden="true" />Event details</div>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere] rounded-md bg-[#080d13] p-3 font-mono text-[11px] leading-5 text-slate-400 custom-scrollbar">{JSON.stringify(selectedLog.details || {}, null, 2)}</pre>
              </div>
              <div className="mt-5 flex justify-end border-t border-[#273241] pt-4"><button type="button" onClick={() => setSelectedLog(null)} className="min-h-10 rounded-lg border border-[#344252] bg-[#151e29] px-4 text-xs font-semibold text-slate-200 hover:border-[#46576a]">Close record</button></div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
