import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Cpu,
  Database,
  Eye,
  X,
} from 'lucide-react';
import { AILogEntry } from './types';
import {
  DonutChart,
  EmptyData,
  HorizontalBars,
  LineChart,
  Panel,
  StatCard,
  StatusPill,
  TableFrame,
  formatCompactNumber,
  formatNumber,
  tableCellClass,
  tableHeadClass,
  tableRowClass,
} from './AdminUI';

interface AdminAIProps {
  aiLogs: AILogEntry[];
  aiTelemetry: { avgTokens: number; avgLatency: number; errorRate: number };
  aiStatusFilter: string;
  setAiStatusFilter: (status: string) => void;
  onFetchAiLogs: (status?: string) => void;
}

const modelColors = ['#64ffda', '#a78bfa', '#fbbf24', '#60a5fa', '#f472b6'];

export const AdminAI: React.FC<AdminAIProps> = ({
  aiLogs,
  aiTelemetry,
  aiStatusFilter,
  setAiStatusFilter,
  onFetchAiLogs,
}) => {
  const [selectedAiLog, setSelectedAiLog] = useState<AILogEntry | null>(null);

  useEffect(() => {
    if (!selectedAiLog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedAiLog(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedAiLog]);

  const successCount = aiLogs.filter((log) => log.success).length;
  const failedCount = aiLogs.length - successCount;
  const successRate = aiLogs.length > 0 ? (successCount / aiLogs.length) * 100 : Math.max(0, 100 - aiTelemetry.errorRate);

  const endpointCounts = useMemo(() => {
    const counts = aiLogs.reduce<Record<string, number>>((result, log) => {
      const endpoint = log.endpoint || 'Unknown endpoint';
      result[endpoint] = (result[endpoint] || 0) + 1;
      return result;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [aiLogs]);

  const modelCounts = useMemo(() => {
    const counts = aiLogs.reduce<Record<string, number>>((result, log) => {
      const model = log.model || 'Auto';
      result[model] = (result[model] || 0) + 1;
      return result;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [aiLogs]);

  const recentLogs = useMemo(
    () => [...aiLogs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).slice(-12),
    [aiLogs]
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Requests captured" value={formatNumber(aiLogs.length)} detail="Current log response" icon={<Bot className="h-[18px] w-[18px]" />} tone="violet" />
        <StatCard label="Average tokens" value={formatNumber(aiTelemetry.avgTokens)} detail="Tokens per request" icon={<Database className="h-[18px] w-[18px]" />} tone="mint" />
        <StatCard label="Average latency" value={`${formatNumber(aiTelemetry.avgLatency)} ms`} detail="Response time" icon={<Clock3 className="h-[18px] w-[18px]" />} tone="violet" />
        <StatCard label="Error rate" value={`${aiTelemetry.errorRate.toFixed(1)}%`} detail={`${failedCount} failed records`} icon={<AlertTriangle className="h-[18px] w-[18px]" />} tone={aiTelemetry.errorRate > 5 ? 'rose' : 'amber'} />
        <StatCard label="Success rate" value={`${successRate.toFixed(1)}%`} detail={`${successCount} successful records`} icon={<CheckCircle2 className="h-[18px] w-[18px]" />} tone="mint" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel title="Request cost & latency" subtitle="Latest captured AI requests in chronological order" action={<StatusPill label={`${recentLogs.length} points`} tone="slate" />} className="xl:col-span-6">
          {recentLogs.length > 0 ? (
            <LineChart
              labels={recentLogs.map((log) => new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
              series={[
                { name: 'Tokens', values: recentLogs.map((log) => log.totalTokens), color: '#64ffda', fill: true },
                { name: 'Latency (ms)', values: recentLogs.map((log) => log.responseTimeMs), color: '#a78bfa' },
              ]}
              ariaLabel="Latest AI requests comparing token use and response latency"
              valueFormatter={formatCompactNumber}
            />
          ) : (
            <EmptyData title="No request telemetry yet" detail="Request cost and latency will appear after AI calls are logged." />
          )}
        </Panel>

        <Panel title="Requests by endpoint" subtitle="Frequency in the current log response" className="xl:col-span-3">
          <HorizontalBars
            data={endpointCounts.slice(0, 6).map(([label, value], index) => ({
              label,
              value,
              color: index === 0 ? '#64ffda' : '#78a9ff',
            }))}
            ariaLabel="AI request count grouped by endpoint"
            emptyMessage="No endpoint data"
          />
        </Panel>

        <Panel title="Model usage" subtitle="Request share by model" className="xl:col-span-3">
          {modelCounts.length > 0 ? (
            <DonutChart
              segments={modelCounts.slice(0, 5).map(([label, value], index) => ({
                label,
                value,
                color: modelColors[index % modelColors.length] || '#64ffda',
                detail: formatNumber(value),
              }))}
              centerValue={formatNumber(aiLogs.length)}
              centerLabel="requests"
              ariaLabel="AI request share grouped by model"
              className="sm:grid-cols-1"
            />
          ) : (
            <EmptyData title="No model data" />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel title="Success vs failure" subtitle="Current log response" className="xl:col-span-3">
          <DonutChart
            segments={[
              { label: 'Success', value: successCount, color: '#64ffda', detail: formatNumber(successCount) },
              { label: 'Failed', value: failedCount, color: '#fb7185', detail: formatNumber(failedCount) },
            ]}
            centerValue={`${successRate.toFixed(1)}%`}
            centerLabel="success"
            ariaLabel={`${successRate.toFixed(1)} percent of captured AI requests succeeded`}
            className="sm:grid-cols-1"
          />
        </Panel>

        <Panel
          title="Telemetry logs"
          subtitle="Select a row to inspect the complete request record"
          action={
            <label className="relative">
              <span className="sr-only">Filter AI logs by status</span>
              <select
                value={aiStatusFilter}
                onChange={(event) => {
                  setAiStatusFilter(event.target.value);
                  onFetchAiLogs(event.target.value);
                }}
                className="h-9 appearance-none rounded-lg border border-[#344252] bg-[#0d141d] pl-3 pr-8 text-[11px] text-slate-300 outline-none focus:border-[#64ffda]/50"
              >
                <option value="all">All requests</option>
                <option value="success">Successful</option>
                <option value="failed">Failed</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            </label>
          }
          bodyClassName="p-0"
          className="xl:col-span-9"
        >
          <TableFrame className="rounded-none border-0">
            <table className="w-full min-w-[980px] text-left">
              <thead className={tableHeadClass}>
                <tr>
                  <th scope="col" className={tableCellClass}>Endpoint</th>
                  <th scope="col" className={tableCellClass}>Model</th>
                  <th scope="col" className={tableCellClass}>Mode</th>
                  <th scope="col" className={tableCellClass}>Tokens</th>
                  <th scope="col" className={tableCellClass}>Latency</th>
                  <th scope="col" className={tableCellClass}>Tier</th>
                  <th scope="col" className={tableCellClass}>Status</th>
                  <th scope="col" className={tableCellClass}>Time</th>
                  <th scope="col" className={`${tableCellClass} text-right`}>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {aiLogs.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-xs text-slate-500">No AI request telemetry logs found.</td></tr>
                ) : aiLogs.map((log) => (
                  <tr key={log._id} className={tableRowClass}>
                    <td className={`${tableCellClass} max-w-[220px] truncate font-medium text-slate-200`} title={log.endpoint}>{log.endpoint}</td>
                    <td className={`${tableCellClass} text-slate-400`}>{log.model || 'Auto'}</td>
                    <td className={`${tableCellClass} text-slate-400`}>{log.mode || 'Standard'}</td>
                    <td className={`${tableCellClass} text-[#8affdf] tabular-nums`}>{formatNumber(log.totalTokens)}</td>
                    <td className={`${tableCellClass} text-[#c4b5fd] tabular-nums`}>{formatNumber(log.responseTimeMs)} ms</td>
                    <td className={tableCellClass}><StatusPill label={log.userTier || 'Unknown'} tone="slate" /></td>
                    <td className={tableCellClass}><StatusPill label={log.success ? 'Success' : 'Failed'} tone={log.success ? 'mint' : 'rose'} dot /></td>
                    <td className={`${tableCellClass} whitespace-nowrap text-slate-500 tabular-nums`}>{new Date(log.createdAt).toLocaleString()}</td>
                    <td className={`${tableCellClass} text-right`}>
                      <button type="button" aria-label={`Inspect request ${log._id}`} onClick={() => setSelectedAiLog(log)} className="grid h-8 w-8 place-items-center rounded-md border border-[#344252] text-slate-400 hover:border-[#46576a] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64ffda]/70"><Eye className="h-3.5 w-3.5" aria-hidden="true" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        </Panel>
      </div>

      {selectedAiLog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedAiLog(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="ai-log-title" className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#3a4858] bg-[#0f171f] shadow-[0_32px_100px_rgba(0,0,0,0.65)]">
            <header className="flex items-start justify-between gap-4 border-b border-[#273241] px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-[#a78bfa]/20 bg-[#a78bfa]/[0.07] text-[#b9a5ff]"><Cpu className="h-5 w-5" aria-hidden="true" /></span>
                <div>
                  <h3 id="ai-log-title" className="text-base font-semibold text-white">AI request inspector</h3>
                  <p className="mt-0.5 text-xs text-slate-500">{new Date(selectedAiLog.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <button type="button" aria-label="Close request inspector" onClick={() => setSelectedAiLog(null)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64ffda]/70"><X className="h-4 w-4" aria-hidden="true" /></button>
            </header>
            <div className="p-5">
              <div className="flex flex-wrap gap-2">
                <StatusPill label={selectedAiLog.success ? 'Success' : 'Failed'} tone={selectedAiLog.success ? 'mint' : 'rose'} dot />
                <StatusPill label={selectedAiLog.userTier || 'Unknown tier'} tone="slate" />
                <StatusPill label={selectedAiLog.mode || 'Standard'} tone="violet" />
              </div>
              <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  ['Endpoint', selectedAiLog.endpoint],
                  ['User UID', selectedAiLog.uid],
                  ['Model', selectedAiLog.model || 'Auto'],
                  ['Mode', selectedAiLog.mode || 'Standard'],
                  ['Total tokens', formatNumber(selectedAiLog.totalTokens)],
                  ['Response latency', `${formatNumber(selectedAiLog.responseTimeMs)} ms`],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-lg border border-[#273241] bg-[#0b1219] p-3">
                    <dt className="text-[10px] uppercase tracking-[0.08em] text-slate-600">{label}</dt>
                    <dd className="mt-1 [overflow-wrap:anywhere] text-xs font-medium text-slate-300">{value}</dd>
                  </div>
                ))}
              </dl>
              {selectedAiLog.errorMessage && (
                <div className="mt-4 rounded-lg border border-rose-400/25 bg-rose-400/[0.08] p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-200"><AlertTriangle className="h-4 w-4" aria-hidden="true" />Error trace</div>
                  <p className="mt-2 [overflow-wrap:anywhere] font-mono text-xs leading-5 text-rose-200/80">{selectedAiLog.errorMessage}</p>
                </div>
              )}
              <div className="mt-5 flex justify-end border-t border-[#273241] pt-4">
                <button type="button" onClick={() => setSelectedAiLog(null)} className="min-h-10 rounded-lg border border-[#344252] bg-[#151e29] px-4 text-xs font-semibold text-slate-200 hover:border-[#46576a]">Close inspector</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
