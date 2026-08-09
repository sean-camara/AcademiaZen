import React, { useState } from 'react';
import { Bot, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { AILogEntry, CustomSelectOption } from './types';
import { CustomSelect } from './CustomSelect';

interface AdminAIProps {
  aiLogs: AILogEntry[];
  aiTelemetry: { avgTokens: number; avgLatency: number; errorRate: number };
  aiStatusFilter: string;
  setAiStatusFilter: (status: string) => void;
  onFetchAiLogs: (status?: string) => void;
}

export const AdminAI: React.FC<AdminAIProps> = ({
  aiLogs,
  aiTelemetry,
  aiStatusFilter,
  setAiStatusFilter,
  onFetchAiLogs,
}) => {
  const [selectedAiLog, setSelectedAiLog] = useState<AILogEntry | null>(null);

  const aiStatusOptions: CustomSelectOption[] = [
    { value: 'all', label: 'All Request Statuses', icon: <Bot className="w-3.5 h-3.5" /> },
    { value: 'success', label: 'Success Only', icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> },
    { value: 'failed', label: 'Failed Only', icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-slate-800 bg-[#0c121e]">
          <p className="text-[10px] font-bold uppercase text-slate-400 font-mono">Average Token Usage</p>
          <p className="text-2xl font-extrabold text-emerald-300 font-mono mt-1">{aiTelemetry.avgTokens} tokens</p>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-[#0c121e]">
          <p className="text-[10px] font-bold uppercase text-slate-400 font-mono">Average Response Latency</p>
          <p className="text-2xl font-extrabold text-amber-300 font-mono mt-1">{aiTelemetry.avgLatency} ms</p>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-[#0c121e]">
          <p className="text-[10px] font-bold uppercase text-slate-400 font-mono">AI Error Rate</p>
          <p className="text-2xl font-extrabold text-rose-300 font-mono mt-1">{aiTelemetry.errorRate}%</p>
        </div>
      </div>

      <div className="flex gap-3">
        <CustomSelect
          value={aiStatusFilter}
          options={aiStatusOptions}
          onChange={(val) => {
            setAiStatusFilter(val);
            onFetchAiLogs(val);
          }}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0c121e]">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/80 uppercase font-mono text-[10px] text-slate-400 border-b border-slate-800">
            <tr>
              <th scope="col" className="p-3.5">Endpoint</th>
              <th scope="col" className="p-3.5">Model</th>
              <th scope="col" className="p-3.5">Mode</th>
              <th scope="col" className="p-3.5">Tokens</th>
              <th scope="col" className="p-3.5">Latency</th>
              <th scope="col" className="p-3.5">Status</th>
              <th scope="col" className="p-3.5">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {aiLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400 font-mono text-xs">
                  No AI request telemetry logs found.
                </td>
              </tr>
            ) : (
              aiLogs.map((log) => (
                <tr key={log._id} onClick={() => setSelectedAiLog(log)} className="hover:bg-slate-800/40 cursor-pointer transition">
                  <td className="p-3.5 font-semibold text-white">{log.endpoint}</td>
                  <td className="p-3.5 text-slate-400">{log.model || 'auto'}</td>
                  <td className="p-3.5 text-slate-400">{log.mode || 'standard'}</td>
                  <td className="p-3.5 text-emerald-300">{log.totalTokens}</td>
                  <td className="p-3.5 text-amber-300">{log.responseTimeMs}ms</td>
                  <td className="p-3.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        log.success ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {log.success ? 'Success' : 'Failed'}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-400">{new Date(log.createdAt).toLocaleTimeString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedAiLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0d1420] border border-slate-700 rounded-2xl p-6 space-y-4 font-mono text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-sm">AI Log Inspector</h3>
              <button onClick={() => setSelectedAiLog(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-slate-300">
              <p>
                <strong>Endpoint:</strong> <span className="text-emerald-300">{selectedAiLog.endpoint}</span>
              </p>
              <p>
                <strong>User UID:</strong> {selectedAiLog.uid}
              </p>
              <p>
                <strong>Model:</strong> {selectedAiLog.model || 'DeepSeek V4'}
              </p>
              <p>
                <strong>Response Latency:</strong> {selectedAiLog.responseTimeMs} ms
              </p>
              <p>
                <strong>Total Tokens:</strong> {selectedAiLog.totalTokens}
              </p>
              <p>
                <strong>Status:</strong> {selectedAiLog.success ? 'SUCCESS (200)' : 'FAILED'}
              </p>
              {selectedAiLog.errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl">
                  <strong>Error Trace:</strong> {selectedAiLog.errorMessage}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button onClick={() => setSelectedAiLog(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
