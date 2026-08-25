import React from 'react';
import {
  Activity,
  Bot,
  Clock3,
  Database,
  FileText,
  HardDrive,
  Megaphone,
  MessageSquare,
  Power,
  Server,
  Users,
} from 'lucide-react';
import { SystemHealth, CollectionStats } from './types';
import {
  EmptyData,
  HorizontalBars,
  Panel,
  StatCard,
  StatusPill,
  formatCompactNumber,
  formatNumber,
} from './AdminUI';

interface AdminHealthProps {
  health: SystemHealth | null;
  dbStats: CollectionStats | null;
  onToggleMaintenance: () => void;
}

export const AdminHealth: React.FC<AdminHealthProps> = ({ health, dbStats, onToggleMaintenance }) => {
  if (!health) {
    return <EmptyData title="System health is unavailable" detail="Refresh this page to request the latest runtime telemetry." />;
  }

  const heapPercent = health.memory.heapTotalMb > 0
    ? Math.min(100, (health.memory.heapUsedMb / health.memory.heapTotalMb) * 100)
    : 0;
  const uptimeHours = Math.floor(health.uptimeSeconds / 3600);
  const uptimeDays = Math.floor(uptimeHours / 24);
  const remainingHours = uptimeHours % 24;
  const collectionData = dbStats ? [
    { label: 'Users', value: dbStats.users, icon: Users, color: '#64ffda' },
    { label: 'Focus sessions', value: dbStats.focusSessions, icon: Clock3, color: '#a78bfa' },
    { label: 'AI logs', value: dbStats.aiLogs, icon: Bot, color: '#64ffda' },
    { label: 'Announcements', value: dbStats.announcements, icon: Megaphone, color: '#a78bfa' },
    { label: 'Feedback', value: dbStats.feedback, icon: MessageSquare, color: '#64ffda' },
    { label: 'Audit logs', value: dbStats.auditLogs, icon: FileText, color: '#a78bfa' },
  ] : [];
  const totalDocuments = collectionData.reduce((sum, collection) => sum + collection.value, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Database" value={health.database} detail="Current connection status" icon={<Database className="h-[18px] w-[18px]" />} tone="mint" />
        <StatCard label="Heap memory" value={`${heapPercent.toFixed(1)}%`} detail={`${formatNumber(health.memory.heapUsedMb)} / ${formatNumber(health.memory.heapTotalMb)} MB used`} icon={<Activity className="h-[18px] w-[18px]" />} tone={heapPercent > 85 ? 'rose' : heapPercent > 70 ? 'amber' : 'violet'} />
        <StatCard label="Resident memory" value={`${formatNumber(health.memory.rssMb)} MB`} detail="Node.js RSS" icon={<HardDrive className="h-[18px] w-[18px]" />} tone="mint" />
        <StatCard label="Server uptime" value={uptimeDays > 0 ? `${uptimeDays}d ${remainingHours}h` : `${uptimeHours}h`} detail={`${formatNumber(health.uptimeSeconds)} seconds`} icon={<Clock3 className="h-[18px] w-[18px]" />} tone="mint" />
        <StatCard label="Node runtime" value={health.nodeVersion} detail="Reported server version" icon={<Server className="h-[18px] w-[18px]" />} tone="violet" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel title="Node process memory" subtitle="Current heap and resident-set readings" className="xl:col-span-6">
          <div className="grid gap-6 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center">
            <div className="relative mx-auto h-52 w-52">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label={`Node heap is ${heapPercent.toFixed(1)} percent utilized`}>
                <circle cx="60" cy="60" r="50" fill="none" stroke="#25303d" strokeWidth="10" />
                <circle cx="60" cy="60" r="50" fill="none" stroke={heapPercent > 85 ? '#fb7185' : '#a78bfa'} strokeWidth="10" strokeLinecap="round" pathLength="100" strokeDasharray={`${heapPercent} ${100 - heapPercent}`} />
              </svg>
              <div className="absolute inset-0 grid place-content-center text-center">
                <strong className="text-3xl font-semibold tracking-[-0.05em] text-white tabular-nums">{heapPercent.toFixed(1)}%</strong>
                <span className="mt-1 text-xs text-slate-500">heap used</span>
              </div>
            </div>
            <dl className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between"><dt className="text-slate-400">Heap used</dt><dd className="text-slate-200 tabular-nums">{formatNumber(health.memory.heapUsedMb)} MB</dd></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#25303d]"><div className="h-full rounded-full bg-[#a78bfa]" style={{ width: `${heapPercent}%` }} /></div>
              </div>
              <div>
                <div className="flex items-center justify-between"><dt className="text-slate-400">Heap total</dt><dd className="text-slate-200 tabular-nums">{formatNumber(health.memory.heapTotalMb)} MB</dd></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#25303d]"><div className="h-full w-full rounded-full bg-[#5f4a99]" /></div>
              </div>
              <div>
                <div className="flex items-center justify-between"><dt className="text-slate-400">Resident set (RSS)</dt><dd className="text-slate-200 tabular-nums">{formatNumber(health.memory.rssMb)} MB</dd></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#25303d]"><div className="h-full rounded-full bg-[#64ffda]" style={{ width: `${Math.min(100, health.memory.heapTotalMb > 0 ? (health.memory.rssMb / Math.max(health.memory.rssMb, health.memory.heapTotalMb)) * 100 : 0)}%` }} /></div>
              </div>
            </dl>
          </div>
        </Panel>

        <Panel title="Database connection" subtitle="Current database state reported by the API" className="xl:col-span-3">
          <div className="flex min-h-[245px] flex-col justify-between">
            <div className="flex items-center gap-3 rounded-lg border border-[#64ffda]/15 bg-[#64ffda]/[0.05] p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#64ffda] text-[#07110f]"><Database className="h-5 w-5" aria-hidden="true" /></span>
              <div>
                <p className="text-sm font-semibold text-slate-100">{health.database}</p>
                <p className="mt-0.5 text-xs text-slate-500">Database connection</p>
              </div>
            </div>
            <dl className="mt-5 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-[#273241] pb-3"><dt className="text-slate-500">Status</dt><dd><StatusPill label={health.database} tone="mint" dot /></dd></div>
              <div className="flex items-center justify-between border-b border-[#273241] pb-3"><dt className="text-slate-500">Collections tracked</dt><dd className="text-slate-200 tabular-nums">{formatNumber(collectionData.length)}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-slate-500">Documents counted</dt><dd className="text-slate-200 tabular-nums">{formatCompactNumber(totalDocuments)}</dd></div>
            </dl>
          </div>
        </Panel>

        <Panel title="Runtime facts" subtitle="Values exposed by the health endpoint" className="xl:col-span-3">
          <dl className="divide-y divide-[#273241] text-xs">
            <div className="flex items-center justify-between gap-3 py-3 first:pt-0"><dt className="text-slate-500">Node version</dt><dd className="font-medium text-slate-200">{health.nodeVersion}</dd></div>
            <div className="flex items-center justify-between gap-3 py-3"><dt className="text-slate-500">Uptime</dt><dd className="font-medium text-slate-200 tabular-nums">{formatNumber(health.uptimeSeconds)} sec</dd></div>
            <div className="flex items-center justify-between gap-3 py-3"><dt className="text-slate-500">Heap allocation</dt><dd className="font-medium text-slate-200 tabular-nums">{formatNumber(health.memory.heapTotalMb)} MB</dd></div>
            <div className="flex items-center justify-between gap-3 py-3"><dt className="text-slate-500">RSS memory</dt><dd className="font-medium text-slate-200 tabular-nums">{formatNumber(health.memory.rssMb)} MB</dd></div>
            <div className="flex items-center justify-between gap-3 py-3 last:pb-0"><dt className="text-slate-500">Maintenance</dt><dd><StatusPill label={health.maintenanceMode ? 'Enabled' : 'Off'} tone={health.maintenanceMode ? 'rose' : 'slate'} /></dd></div>
          </dl>
        </Panel>
      </div>

      {dbStats && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {collectionData.map((collection) => {
              const Icon = collection.icon;
              return (
                <article key={collection.label} className="rounded-xl border border-[#273241] bg-[#101720] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">{collection.label}</span>
                    <Icon className="h-4 w-4" style={{ color: collection.color }} aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-slate-100 tabular-nums">{formatCompactNumber(collection.value)}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#25303d]"><div className="h-full rounded-full" style={{ width: `${totalDocuments > 0 ? Math.max((collection.value / totalDocuments) * 100, 2) : 0}%`, backgroundColor: collection.color }} /></div>
                </article>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Panel title="Collection telemetry" subtitle="Document counts reported by MongoDB" className="xl:col-span-8">
              <HorizontalBars
                data={collectionData.sort((a, b) => b.value - a.value).map((collection) => ({ label: collection.label, value: collection.value, color: collection.color, detail: formatNumber(collection.value) }))}
                ariaLabel="MongoDB collection document counts"
              />
            </Panel>

            <Panel title="Maintenance mode" subtitle="High-consequence platform access control" className="xl:col-span-4">
              <div className={`rounded-lg border p-4 ${health.maintenanceMode ? 'border-rose-400/25 bg-rose-400/[0.08]' : 'border-[#344252] bg-[#0c131b]'}`}>
                <div className="flex items-center gap-3">
                  <span className={`grid h-10 w-10 place-items-center rounded-lg ${health.maintenanceMode ? 'bg-rose-400/10 text-rose-300' : 'bg-slate-400/[0.07] text-slate-400'}`}><Power className="h-5 w-5" aria-hidden="true" /></span>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Currently {health.maintenanceMode ? 'enabled' : 'off'}</p>
                    <p className="mt-0.5 text-xs text-slate-500">Administrators retain access.</p>
                  </div>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-xs leading-5 text-slate-500">
                <li>• Non-admin users see the maintenance notice.</li>
                <li>• Administrative access remains available.</li>
                <li>• Toggle only during planned platform work.</li>
              </ul>
              <button
                type="button"
                onClick={onToggleMaintenance}
                className={`mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 ${health.maintenanceMode ? 'border-[#64ffda]/25 bg-[#64ffda]/[0.08] text-[#8affdf] focus-visible:ring-[#64ffda]/70' : 'border-rose-400/30 bg-rose-400/[0.08] text-rose-200 hover:bg-rose-400/[0.13] focus-visible:ring-rose-300/70'}`}
              >
                <Power className="h-4 w-4" aria-hidden="true" />
                {health.maintenanceMode ? 'Disable maintenance' : 'Enable maintenance'}
              </button>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
};
