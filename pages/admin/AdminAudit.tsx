import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { AuditLogItem } from './types';

interface AdminAuditProps {
  auditLogs: AuditLogItem[];
}

export const AdminAudit: React.FC<AdminAuditProps> = ({ auditLogs }) => {
  const [auditSearch, setAuditSearch] = useState('');

  const filteredLogs = auditLogs.filter(
    (l) =>
      l.adminEmail.toLowerCase().includes(auditSearch.toLowerCase()) ||
      l.action.toLowerCase().includes(auditSearch.toLowerCase())
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Filter audit log by action or admin email..."
          value={auditSearch}
          onChange={(e) => setAuditSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#0e1626] border border-slate-700/60 text-xs text-white placeholder-slate-500 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0c121e]">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/80 uppercase font-mono text-[10px] text-slate-400 border-b border-slate-800">
            <tr>
              <th scope="col" className="p-3.5">Admin Email</th>
              <th scope="col" className="p-3.5">Action</th>
              <th scope="col" className="p-3.5">Target User UID</th>
              <th scope="col" className="p-3.5">Details</th>
              <th scope="col" className="p-3.5">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400 font-mono text-xs">
                  No matching audit trail records found.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log._id} className="hover:bg-slate-800/40 transition">
                  <td className="p-3.5 font-semibold text-white">{log.adminEmail}</td>
                  <td className="p-3.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/15 text-amber-300 uppercase border border-amber-400/30">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-400">{log.targetUid || 'N/A'}</td>
                  <td className="p-3.5 text-slate-400 max-w-xs truncate">{JSON.stringify(log.details || {})}</td>
                  <td className="p-3.5 text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
