import React from 'react';
import { BadgeCheck, CalendarRange, CreditCard, ReceiptText, TrendingUp, UserRoundCheck } from 'lucide-react';
import { PaymentLog, OverviewMetrics } from './types';
import {
  DonutChart,
  EmptyData,
  LineChart,
  Panel,
  StatCard,
  StatusPill,
  TableFrame,
  formatCurrency,
  formatNumber,
  parseCurrency,
  tableCellClass,
  tableHeadClass,
  tableRowClass,
} from './AdminUI';

interface AdminBillingProps {
  payments: PaymentLog[];
  overview: OverviewMetrics | null;
}

const intervalColors = ['#64ffda', '#a78bfa', '#fbbf24', '#60a5fa', '#f472b6'];

const paymentTone = (status: string): 'mint' | 'amber' | 'rose' | 'slate' => {
  const normalized = status.toLowerCase();
  if (normalized.includes('paid') || normalized.includes('success') || normalized.includes('active')) return 'mint';
  if (normalized.includes('pending') || normalized.includes('process')) return 'amber';
  if (normalized.includes('failed') || normalized.includes('cancel') || normalized.includes('refund')) return 'rose';
  return 'slate';
};

export const AdminBilling: React.FC<AdminBillingProps> = ({ payments, overview }) => {
  const mrr = overview?.estimatedMRR || 0;
  const premiumUsers = overview?.premiumUsers || 0;
  const arr = mrr * 12;
  const arpu = premiumUsers > 0 ? mrr / premiumUsers : 0;
  const recordedRevenue = payments.reduce((sum, payment) => sum + parseCurrency(payment.amount), 0);
  const averagePayment = payments.length > 0 ? recordedRevenue / payments.length : 0;

  const statusCounts = payments.reduce<Record<string, number>>((counts, payment) => {
    const key = payment.status || 'Unknown';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const intervalCounts = payments.reduce<Record<string, number>>((counts, payment) => {
    const key = payment.interval || 'Unknown';
    counts[key] = (counts[key] || 0) + parseCurrency(payment.amount);
    return counts;
  }, {});
  const successfulPayments = payments.filter((payment) => paymentTone(payment.status) === 'mint').length;
  const successRate = payments.length > 0 ? (successfulPayments / payments.length) * 100 : 0;

  const revenueByDate = new Map<string, { date: Date; value: number }>();
  payments.forEach((payment) => {
    const date = new Date(payment.lastPaymentAt);
    if (Number.isNaN(date.getTime())) return;
    const key = date.toISOString().slice(0, 10);
    const current = revenueByDate.get(key);
    revenueByDate.set(key, { date, value: (current?.value || 0) + parseCurrency(payment.amount) });
  });
  const revenueTrend = [...revenueByDate.values()].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(-10);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Monthly recurring revenue" value={formatCurrency(mrr)} detail="Estimated current MRR" icon={<CreditCard className="h-[18px] w-[18px]" />} tone="mint" />
        <StatCard label="Annual run rate" value={formatCurrency(arr)} detail="MRR × 12 months" icon={<TrendingUp className="h-[18px] w-[18px]" />} tone="mint" />
        <StatCard label="Pro subscribers" value={formatNumber(premiumUsers)} detail="Active premium accounts" icon={<UserRoundCheck className="h-[18px] w-[18px]" />} tone="violet" />
        <StatCard label="Average revenue / user" value={formatCurrency(arpu)} detail="MRR ÷ Pro subscribers" icon={<ReceiptText className="h-[18px] w-[18px]" />} tone="violet" />
        <StatCard label="Recorded payment success" value={`${successRate.toFixed(1)}%`} detail={`${successfulPayments} of ${payments.length} records`} icon={<BadgeCheck className="h-[18px] w-[18px]" />} tone={payments.length > 0 && successRate < 90 ? 'amber' : 'mint'} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel title="Recorded revenue trend" subtitle="Aggregated from payment transaction dates" action={<StatusPill label="Recent records" tone="slate" />} className="xl:col-span-6">
          {revenueTrend.length > 0 ? (
            <LineChart
              labels={revenueTrend.map((entry) => entry.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}
              series={[{ name: 'Revenue', values: revenueTrend.map((entry) => entry.value), color: '#64ffda', fill: true }]}
              ariaLabel="Recorded payment revenue over time"
              valueFormatter={(value) => formatCurrency(value)}
            />
          ) : (
            <EmptyData title="No payment trend yet" detail="The chart will use actual transaction dates as payments arrive." />
          )}
        </Panel>

        <Panel title="Revenue by interval" subtitle="Value of recorded payments" className="xl:col-span-3">
          {Object.keys(intervalCounts).length > 0 ? (
            <DonutChart
              segments={Object.entries(intervalCounts).slice(0, 5).map(([label, value], index) => ({
                label,
                value,
                color: intervalColors[index % intervalColors.length] || '#64ffda',
                detail: formatCurrency(value),
              }))}
              centerValue={formatCurrency(recordedRevenue)}
              centerLabel="recorded"
              ariaLabel="Recorded payment revenue grouped by billing interval"
              className="sm:grid-cols-1"
            />
          ) : (
            <EmptyData title="No interval data" />
          )}
        </Panel>

        <Panel title="Payment status" subtitle="Current transaction records" className="xl:col-span-3">
          {Object.keys(statusCounts).length > 0 ? (
            <DonutChart
              segments={Object.entries(statusCounts).slice(0, 5).map(([label, value]) => ({
                label,
                value,
                color: paymentTone(label) === 'mint' ? '#64ffda' : paymentTone(label) === 'amber' ? '#fbbf24' : paymentTone(label) === 'rose' ? '#fb7185' : '#7b8798',
                detail: formatNumber(value),
              }))}
              centerValue={`${successRate.toFixed(1)}%`}
              centerLabel="successful"
              ariaLabel="Payment transaction status breakdown"
              className="sm:grid-cols-1"
            />
          ) : (
            <EmptyData title="No payment statuses" />
          )}
        </Panel>
      </div>

      <Panel title="Revenue summary" subtitle="Values calculated from the current billing dataset">
        <dl className="grid grid-cols-2 gap-x-5 gap-y-5 md:grid-cols-4">
          <div>
            <dt className="text-[11px] text-slate-500">Estimated MRR</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-100 tabular-nums">{formatCurrency(mrr)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-500">Recorded transactions</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-100 tabular-nums">{formatNumber(payments.length)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-500">Recorded revenue</dt>
            <dd className="mt-1 text-lg font-semibold text-[#8affdf] tabular-nums">{formatCurrency(recordedRevenue)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-500">Average recorded payment</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-100 tabular-nums">{formatCurrency(averagePayment)}</dd>
          </div>
        </dl>
      </Panel>

      <Panel title="Recent payments" subtitle="Transaction ledger from the billing API" action={<CalendarRange className="h-4 w-4 text-slate-500" aria-hidden="true" />} bodyClassName="p-0">
        <TableFrame className="rounded-none border-0">
          <table className="w-full min-w-[900px] text-left">
            <thead className={tableHeadClass}>
              <tr>
                <th scope="col" className={tableCellClass}>Student</th>
                <th scope="col" className={tableCellClass}>Interval</th>
                <th scope="col" className={tableCellClass}>Amount</th>
                <th scope="col" className={tableCellClass}>Status</th>
                <th scope="col" className={tableCellClass}>Payment ID</th>
                <th scope="col" className={tableCellClass}>Paid date</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-xs text-slate-500">No payment transactions recorded.</td></tr>
              ) : (
                payments.map((payment) => (
                  <tr key={`${payment.paymentId}-${payment.uid}`} className={tableRowClass}>
                    <td className={tableCellClass}>
                      <p className="font-medium text-slate-200">{payment.email}</p>
                      <p className="mt-0.5 max-w-[220px] truncate text-[10px] text-slate-600">{payment.uid}</p>
                    </td>
                    <td className={`${tableCellClass} capitalize text-slate-400`}>{payment.interval}</td>
                    <td className={`${tableCellClass} font-medium text-[#8affdf] tabular-nums`}>{payment.amount}</td>
                    <td className={tableCellClass}><StatusPill label={payment.status} tone={paymentTone(payment.status)} dot /></td>
                    <td className={`${tableCellClass} max-w-[220px] truncate font-mono text-[11px] text-slate-500`} title={payment.paymentId}>{payment.paymentId}</td>
                    <td className={`${tableCellClass} whitespace-nowrap text-slate-400 tabular-nums`}>{new Date(payment.lastPaymentAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableFrame>
      </Panel>
    </div>
  );
};
