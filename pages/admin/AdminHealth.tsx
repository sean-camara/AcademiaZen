import React from 'react';
import { SystemHealth, CollectionStats } from './types';

interface AdminHealthProps {
  health: SystemHealth | null;
  dbStats: CollectionStats | null;
  onToggleMaintenance: () => void;
}

export const AdminHealth: React.FC<AdminHealthProps> = ({ health, dbStats, onToggleMaintenance }) => {
  if (!health) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono text-xs">
        Loading system health & telemetry...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-6 rounded-xl border border-slate-800 bg-[#0c121e]">
          <p className="text-xs font-mono font-bold uppercase text-slate-400">Database Connection</p>
          <p className="mt-2 text-2xl font-bold text-emerald-300 uppercase font-mono">{health.database}</p>
        </div>

        <div className="p-6 rounded-xl border border-slate-800 bg-[#0c121e]">
          <p className="text-xs font-mono font-bold uppercase text-slate-400">Node.js Process Memory</p>
          <p className="mt-2 text-2xl font-bold text-violet-300 font-mono">
            {health.memory.heapUsedMb} MB / {health.memory.heapTotalMb} MB
          </p>
        </div>

        <div className="p-6 rounded-xl border border-slate-800 bg-[#0c121e]">
          <p className="text-xs font-mono font-bold uppercase text-slate-400">Server Uptime</p>
          <p className="mt-2 text-2xl font-bold text-amber-300 font-mono">{Math.round(health.uptimeSeconds / 60)} minutes</p>
        </div>
      </div>

      {dbStats && (
        <div className="p-6 rounded-xl border border-slate-800 bg-[#0c121e]">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-4">MongoDB Collection Telemetry</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 font-mono text-xs">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <p className="text-[10px] text-slate-500">Users</p>
              <p className="text-lg font-bold text-white">{dbStats.users}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <p className="text-[10px] text-slate-500">Focus Sessions</p>
              <p className="text-lg font-bold text-white">{dbStats.focusSessions}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <p className="text-[10px] text-slate-500">AI Logs</p>
              <p className="text-lg font-bold text-white">{dbStats.aiLogs}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <p className="text-[10px] text-slate-500">Announcements</p>
              <p className="text-lg font-bold text-white">{dbStats.announcements}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <p className="text-[10px] text-slate-500">Feedback</p>
              <p className="text-lg font-bold text-white">{dbStats.feedback}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <p className="text-[10px] text-slate-500">Audit Logs</p>
              <p className="text-lg font-bold text-white">{dbStats.auditLogs}</p>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 rounded-xl border border-slate-800 bg-[#0c121e] flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-white">System Maintenance Mode</h4>
          <p className="text-xs text-slate-400">When enabled, non-admin users will see a maintenance notice screen.</p>
        </div>
        <button
          onClick={onToggleMaintenance}
          className={`px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition ${
            health.maintenanceMode ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {health.maintenanceMode ? 'Disable Maintenance' : 'Enable Maintenance'}
        </button>
      </div>
    </div>
  );
};
