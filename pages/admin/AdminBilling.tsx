import React from 'react';
import { PaymentLog, OverviewMetrics } from './types';

interface AdminBillingProps {
  payments: PaymentLog[];
  overview: OverviewMetrics | null;
}

export const AdminBilling: React.FC<AdminBillingProps> = ({ payments, overview }) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-slate-800 bg-[#0c121e]">
          <p className="text-[10px] font-bold uppercase text-slate-400 font-mono">Monthly Recurring Revenue</p>
          <p className="text-2xl font-extrabold text-amber-300 font-mono mt-1">PHP {overview?.estimatedMRR || 0}</p>
        </div>
        <div className="p-5 rounded-xl border border-slate-800 bg-[#0c121e]">
          <p className="text-[10px] font-bold uppercase text-slate-400 font-mono">Annual Run Rate (ARR)</p>
          <p className="text-2xl font-extrabold text-emerald-300 font-mono mt-1">
            PHP {((overview?.estimatedMRR || 0) * 12).toLocaleString()}
          </p>
        </div>
        <div className="p-5 rounded-xl border border-slate-800 bg-[#0c121e]">
          <p className="text-[10px] font-bold uppercase text-slate-400 font-mono">Active Pro Subscribers</p>
          <p className="text-2xl font-extrabold text-violet-300 font-mono mt-1">{overview?.premiumUsers || 0}</p>
        </div>
        <div className="p-5 rounded-xl border border-slate-800 bg-[#0c121e]">
          <p className="text-[10px] font-bold uppercase text-slate-400 font-mono">ARPU (Avg Revenue/User)</p>
          <p className="text-2xl font-extrabold text-blue-300 font-mono mt-1">PHP 119.20</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0c121e]">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/80 uppercase font-mono text-[10px] text-slate-400 border-b border-slate-800">
            <tr>
              <th scope="col" className="p-3.5">Student Email</th>
              <th scope="col" className="p-3.5">Interval</th>
              <th scope="col" className="p-3.5">Amount</th>
              <th scope="col" className="p-3.5">Status</th>
              <th scope="col" className="p-3.5">Payment Key / ID</th>
              <th scope="col" className="p-3.5">Paid Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400 font-mono text-xs">
                  No payment transactions recorded.
                </td>
              </tr>
            ) : (
              payments.map((tx, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition">
                  <td className="p-3.5 font-semibold text-white">{tx.email}</td>
                  <td className="p-3.5 text-slate-400 uppercase">{tx.interval}</td>
                  <td className="p-3.5 text-emerald-300 font-bold">{tx.amount}</td>
                  <td className="p-3.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 uppercase">
                      {tx.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-400 truncate max-w-[180px]">{tx.paymentId}</td>
                  <td className="p-3.5 text-slate-400">{new Date(tx.lastPaymentAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
