import React, { useState } from 'react';
import {
  Users,
  Crown,
  Bot,
  CreditCard,
  TrendingUp,
  SlidersHorizontal,
  Megaphone,
  Lock,
  Unlock,
} from 'lucide-react';
import { OverviewMetrics, SystemHealth, AdminTab } from './types';

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
  const [chartMetric, setChartMetric] = useState<'activeUsers' | 'aiRequests'>('activeUsers');

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 4 Linear-style Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Users */}
        <div className="p-5 rounded-xl border border-slate-800/80 bg-[#0c121e] relative overflow-hidden group hover:border-slate-700 transition shadow-sm">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-emerald-500/60 via-emerald-500/10 to-transparent" />
          <div className="flex justify-between items-start">
            <p className="text-[11px] font-mono font-bold uppercase text-slate-400 tracking-wider">Total Registered Students</p>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-white tracking-tight">{overview.totalUsers}</p>
          <div className="mt-2.5 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>{overview.activeUsersToday} active today</span>
            </span>
            <span className="text-slate-500 text-[11px] font-mono">+12.4% vs last wk</span>
          </div>
        </div>

        {/* Card 2: Conversion */}
        <div className="p-5 rounded-xl border border-slate-800/80 bg-[#0c121e] relative overflow-hidden group hover:border-slate-700 transition shadow-sm">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-amber-500/60 via-amber-500/10 to-transparent" />
          <div className="flex justify-between items-start">
            <p className="text-[11px] font-mono font-bold uppercase text-slate-400 tracking-wider">Pro Conversion Rate</p>
            <Crown className="w-4 h-4 text-amber-400" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-emerald-300">{overview.premiumUsers} <span className="text-sm font-normal text-slate-400">Pro</span></p>
          <div className="mt-2.5 flex items-center justify-between text-xs">
            <span className="text-slate-400">{overview.freeUsers} Free Users</span>
            <span className="font-mono text-emerald-400 font-bold">{overview.conversionRate || 0}% Rate</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${Math.min(100, overview.conversionRate || 0)}%` }} />
          </div>
        </div>

        {/* Card 3: Prompts */}
        <div className="p-5 rounded-xl border border-slate-800/80 bg-[#0c121e] relative overflow-hidden group hover:border-slate-700 transition shadow-sm">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-violet-500/60 via-violet-500/10 to-transparent" />
          <div className="flex justify-between items-start">
            <p className="text-[11px] font-mono font-bold uppercase text-slate-400 tracking-wider">Zen AI Daily Prompts</p>
            <Bot className="w-4 h-4 text-violet-400" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-violet-300">{overview.promptsToday} <span className="text-xs font-normal text-slate-400">today</span></p>
          <p className="mt-2.5 text-xs text-slate-400 font-mono">{overview.promptsMonth} prompts this month</p>
        </div>

        {/* Card 4: MRR */}
        <div className="p-5 rounded-xl border border-slate-800/80 bg-[#0c121e] relative overflow-hidden group hover:border-slate-700 transition shadow-sm">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-blue-500/60 via-blue-500/10 to-transparent" />
          <div className="flex justify-between items-start">
            <p className="text-[11px] font-mono font-bold uppercase text-slate-400 tracking-wider">Estimated MRR</p>
            <CreditCard className="w-4 h-4 text-blue-400" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-amber-300">PHP {overview.estimatedMRR.toLocaleString()}</p>
          <p className="mt-2.5 text-xs text-slate-400 font-mono">{overview.totalFocusMinutes.toLocaleString()} focus mins logged</p>
        </div>
      </div>

      {/* 7-Day Telemetry & Quick Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Telemetry Area Chart Container */}
        <div className="lg:col-span-2 p-6 rounded-xl border border-slate-800/80 bg-[#0c121e] flex flex-col justify-between shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-4 mb-6">
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>7-Day Engagement Telemetry</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Daily active student engagement across the week</p>
            </div>

            <div className="flex rounded-lg bg-slate-900 p-1 border border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setChartMetric('activeUsers')}
                className={`px-3 py-1 rounded-md transition ${chartMetric === 'activeUsers' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30' : 'text-slate-400 hover:text-white'}`}
              >
                Active Students
              </button>
              <button
                onClick={() => setChartMetric('aiRequests')}
                className={`px-3 py-1 rounded-md transition ${chartMetric === 'aiRequests' ? 'bg-violet-500/20 text-violet-300 font-bold border border-violet-500/30' : 'text-slate-400 hover:text-white'}`}
              >
                AI Prompts
              </button>
            </div>
          </div>

          {overview.dailyStats && overview.dailyStats.length > 0 ? (
            <div className="flex items-end justify-between gap-3 h-56 pt-6 px-2">
              {overview.dailyStats.map((day) => {
                const val = day[chartMetric];
                const maxVal = Math.max(...overview.dailyStats!.map(d => d[chartMetric]), 1);
                const heightPct = val > 0 ? Math.max(20, Math.round((val / maxVal) * 100)) : 0;

                return (
                  <div key={day.date} className="flex-1 h-full flex flex-col items-center justify-end gap-2 group relative">
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-700 text-white text-[10px] font-mono px-2.5 py-1 rounded-md shadow-2xl pointer-events-none whitespace-nowrap z-20">
                      {day.dayName} ({day.date}): {val} {chartMetric === 'activeUsers' ? 'active' : 'prompts'}
                    </div>

                    {val > 0 && (
                      <span className={`text-[10px] font-mono font-bold ${
                        chartMetric === 'activeUsers' ? 'text-emerald-400' : 'text-violet-400'
                      }`}>
                        {val}
                      </span>
                    )}

                    <div className="w-full bg-slate-900/60 rounded-t-lg overflow-hidden flex-1 max-h-[160px] flex items-end">
                      <div
                        className={`w-full rounded-t-lg transition-all duration-500 group-hover:brightness-125 ${
                          val > 0
                            ? chartMetric === 'activeUsers'
                              ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-lg shadow-emerald-500/20'
                              : 'bg-gradient-to-t from-violet-600 to-violet-400 shadow-lg shadow-violet-500/20'
                            : 'bg-slate-800/40'
                        }`}
                        style={{ height: val > 0 ? `${heightPct}%` : '4px' }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">{day.dayName}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-xs text-slate-500 font-mono">No telemetry points recorded</div>
          )}
        </div>

        {/* Right Quick Operations Panel */}
        <div className="p-6 rounded-xl border border-slate-800/80 bg-[#0c121e] flex flex-col justify-between shadow-sm">
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 border-b border-slate-800/60 pb-4 mb-4 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
              <span>Quick Operations</span>
            </h3>
            
            <div className="space-y-3">
              <button onClick={() => setActiveTab('announcements')} className="w-full p-3 rounded-lg bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800 text-left text-xs font-medium flex items-center gap-3 transition group">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-slate-200 group-hover:text-emerald-300 font-semibold transition">Broadcast Announcement</p>
                  <p className="text-[11px] text-slate-400 font-normal">Push notification banner to students</p>
                </div>
              </button>

              <button onClick={() => setActiveTab('users')} className="w-full p-3 rounded-lg bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800 text-left text-xs font-medium flex items-center gap-3 transition group">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-slate-200 group-hover:text-blue-300 font-semibold transition">User Directory</p>
                  <p className="text-[11px] text-slate-400 font-normal">Promote admins, grant plans, reset AI</p>
                </div>
              </button>

              <button onClick={() => setActiveTab('ai')} className="w-full p-3 rounded-lg bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800 text-left text-xs font-medium flex items-center gap-3 transition group">
                <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-slate-200 group-hover:text-violet-300 font-semibold transition">Inspect Live AI Logs</p>
                  <p className="text-[11px] text-slate-400 font-normal">View tokens, latencies & status codes</p>
                </div>
              </button>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800/60 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white">Maintenance Mode</p>
              <p className="text-[10px] text-slate-400">Lock non-admin logins</p>
            </div>
            <button
              onClick={onToggleMaintenance}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition flex items-center gap-1.5 ${
                health?.maintenanceMode ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {health?.maintenanceMode ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              <span>{health?.maintenanceMode ? 'ACTIVE' : 'OFF'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
