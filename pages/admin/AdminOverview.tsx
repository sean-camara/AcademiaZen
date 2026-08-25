import React from 'react';
import {
  Activity,
  ArrowRight,
  Bot,
  Clock3,
  CreditCard,
  Crown,
  Database,
  Lock,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { OverviewMetrics, SystemHealth, AdminTab } from './types';
import {
  DonutChart,
  EmptyData,
  HorizontalBars,
  LineChart,
  Panel,
  StatCard,
  StatusPill,
  formatCompactNumber,
  formatCurrency,
  formatNumber,
} from './AdminUI';

interface AdminOverviewProps {
  overview: OverviewMetrics;
  health: SystemHealth | null;
  setActiveTab: (tab: AdminTab) => void;
  onToggleMaintenance: () => void;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  overview,
  health,
  setActiveTab,
  onToggleMaintenance,
}) => {
  const conversionRate = overview.conversionRate ?? (overview.totalUsers > 0 ? (overview.premiumUsers / overview.totalUsers) * 100 : 0);
  const dailyStats = overview.dailyStats || [];
  const topSubjects = overview.topSubjects || [];
  const recentActivity = overview.recentActivity || [];
  const hasHealthTelemetry = Boolean(health?.memory && typeof health.uptimeSeconds === 'number');
  const heapPercent = health?.memory && health.memory.heapTotalMb > 0
    ? Math.min(100, (health.memory.heapUsedMb / health.memory.heapTotalMb) * 100)
    : 0;
  const uptimeHours = hasHealthTelemetry && health ? Math.floor(health.uptimeSeconds / 3600) : 0;

  const operations = [
    {
      title: 'Broadcast announcement',
      detail: 'Publish a banner to active students',
      icon: Megaphone,
      tab: 'announcements' as AdminTab,
      tone: 'text-[#64ffda] bg-[#64ffda]/[0.07] border-[#64ffda]/15',
    },
    {
      title: 'Manage student accounts',
      detail: 'Review access, plans, and quotas',
      icon: Users,
      tab: 'users' as AdminTab,
      tone: 'text-sky-300 bg-sky-400/[0.07] border-sky-400/15',
    },
    {
      title: 'Inspect AI telemetry',
      detail: 'Trace tokens, latency, and errors',
      icon: Bot,
      tab: 'ai' as AdminTab,
      tone: 'text-[#a78bfa] bg-[#a78bfa]/[0.07] border-[#a78bfa]/15',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Students"
          value={formatNumber(overview.totalUsers)}
          detail={`${formatNumber(overview.activeUsersToday)} active today`}
          icon={<Users className="h-[18px] w-[18px]" />}
          tone="mint"
        />
        <StatCard
          label="Pro subscribers"
          value={formatNumber(overview.premiumUsers)}
          detail={`${conversionRate.toFixed(1)}% conversion`}
          icon={<Crown className="h-[18px] w-[18px]" />}
          tone="violet"
        />
        <StatCard
          label="AI requests today"
          value={formatNumber(overview.promptsToday)}
          detail={`${formatCompactNumber(overview.promptsMonth)} this month`}
          icon={<Bot className="h-[18px] w-[18px]" />}
          tone="violet"
        />
        <StatCard
          label="Estimated MRR"
          value={formatCurrency(overview.estimatedMRR)}
          detail="Current recurring revenue"
          icon={<CreditCard className="h-[18px] w-[18px]" />}
          tone="mint"
        />
        <StatCard
          label="Focus sessions"
          value={formatNumber(overview.totalFocusSessions)}
          detail={`${formatCompactNumber(overview.totalFocusMinutes)} total minutes`}
          icon={<Clock3 className="h-[18px] w-[18px]" />}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel
          title="7-day engagement"
          subtitle="Daily active students and AI request volume"
          action={<StatusPill label="Daily" tone="slate" />}
          className="xl:col-span-8"
        >
          {dailyStats.length > 0 ? (
            <LineChart
              labels={dailyStats.map((item) => item.dayName)}
              series={[
                { name: 'Active students', values: dailyStats.map((item) => item.activeUsers), color: '#64ffda', fill: true },
                { name: 'AI requests', values: dailyStats.map((item) => item.aiRequests), color: '#a78bfa' },
              ]}
              ariaLabel="Seven-day chart comparing active students with AI requests"
              valueFormatter={formatCompactNumber}
            />
          ) : (
            <EmptyData title="No engagement telemetry yet" detail="Daily activity will appear after the platform records its first reporting window." />
          )}
        </Panel>

        <Panel title="Platform health" subtitle="Current application runtime" className="xl:col-span-4">
          {hasHealthTelemetry && health ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-lg border border-[#64ffda]/15 bg-[#64ffda]/[0.05] p-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#64ffda] text-[#07110f]">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100">All systems operational</p>
                  <p className="mt-0.5 text-xs text-slate-500">Database status: {health.database}</p>
                </div>
              </div>

              <dl className="space-y-3 text-xs">
                <div className="flex items-center justify-between gap-3 border-b border-[#273241] pb-3">
                  <dt className="flex items-center gap-2 text-slate-400"><Database className="h-4 w-4" aria-hidden="true" /> Database</dt>
                  <dd><StatusPill label={health.database} tone="mint" dot /></dd>
                </div>
                <div className="border-b border-[#273241] pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-400">Heap memory</dt>
                    <dd className="text-slate-200 tabular-nums">{health.memory.heapUsedMb} / {health.memory.heapTotalMb} MB</dd>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#25303d]">
                    <div className="h-full rounded-full bg-[#a78bfa]" style={{ width: `${heapPercent}%` }} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-400">Server uptime</dt>
                  <dd className="font-medium text-slate-200 tabular-nums">{formatNumber(uptimeHours)} hours</dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={() => setActiveTab('health')}
                className="flex min-h-10 w-full items-center justify-between rounded-lg border border-[#2b3745] bg-[#0c131b] px-3 text-xs font-medium text-slate-300 hover:border-[#3b4a5b] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64ffda]/70"
              >
                View system health <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <EmptyData title="Health telemetry unavailable" />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <Panel title="Pro conversion" subtitle="Free and premium account distribution" className="xl:col-span-4">
          <DonutChart
            segments={[
              { label: 'Pro', value: overview.premiumUsers, color: '#a78bfa', detail: formatNumber(overview.premiumUsers) },
              { label: 'Free', value: overview.freeUsers, color: '#64ffda', detail: formatNumber(overview.freeUsers) },
            ]}
            centerValue={`${conversionRate.toFixed(1)}%`}
            centerLabel="conversion"
            ariaLabel={`${conversionRate.toFixed(1)} percent of student accounts are Pro`}
            className="2xl:grid-cols-[140px_minmax(0,1fr)]"
          />
        </Panel>

        <Panel title="Academic demand" subtitle="Top enrolled subjects" className="xl:col-span-4">
          <HorizontalBars
            data={topSubjects.slice(0, 5).map((subject, index) => ({
              label: subject.subject,
              value: subject.count,
              color: index % 2 === 0 ? '#64ffda' : '#a78bfa',
            }))}
            ariaLabel="Top study subjects ranked by enrollment"
            emptyMessage="Subject enrollment has not been recorded"
          />
        </Panel>

        <Panel title="Quick operations" subtitle="Common administrator workflows" className="lg:col-span-2 xl:col-span-4">
          <div className="space-y-2">
            {operations.map((operation) => {
              const Icon = operation.icon;
              return (
                <button
                  key={operation.title}
                  type="button"
                  onClick={() => setActiveTab(operation.tab)}
                  className="group flex min-h-14 w-full items-center gap-3 rounded-lg border border-[#273241] bg-[#0c131b] p-3 text-left hover:border-[#3a4858] hover:bg-[#111a24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64ffda]/70"
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${operation.tone}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-slate-200 group-hover:text-white">{operation.title}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">{operation.detail}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-slate-300" aria-hidden="true" />
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-[#273241] pt-4">
            <div>
              <p className="text-xs font-medium text-slate-200">Maintenance mode</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Restrict access to administrators</p>
            </div>
            <button
              type="button"
              onClick={onToggleMaintenance}
              className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 ${
                health?.maintenanceMode
                  ? 'border-rose-400/30 bg-rose-400/[0.1] text-rose-200 focus-visible:ring-rose-300/70'
                  : 'border-[#344252] bg-[#151e29] text-slate-300 hover:border-[#46576a] focus-visible:ring-[#64ffda]/70'
              }`}
            >
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              {health?.maintenanceMode ? 'Enabled' : 'Off'}
            </button>
          </div>
        </Panel>
      </div>

      <Panel title="Recent activity" subtitle="Latest platform events captured by the overview feed">
        {recentActivity.length > 0 ? (
          <div className="divide-y divide-[#273241]">
            {recentActivity.slice(0, 6).map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#a78bfa]/15 bg-[#a78bfa]/[0.06] text-[#a78bfa]">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-200">{item.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{item.type}</p>
                </div>
                <StatusPill label={item.badge} tone="slate" />
                <time className="hidden shrink-0 text-[11px] text-slate-500 sm:block">{new Date(item.timestamp).toLocaleString()}</time>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-[#273241] bg-[#0c131b] p-4">
            <Activity className="h-5 w-5 text-slate-500" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium text-slate-300">No recent activity captured</p>
              <p className="mt-0.5 text-[11px] text-slate-500">New platform events will appear here automatically.</p>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
};
