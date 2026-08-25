import React, { useId } from 'react';
import { ArrowDownRight, ArrowUpRight, Info, Minus } from 'lucide-react';

export type AdminTone = 'mint' | 'violet' | 'amber' | 'blue' | 'rose' | 'slate';

const toneMap: Record<AdminTone, { icon: string; text: string; surface: string; border: string }> = {
  mint: {
    icon: 'text-[#64ffda]',
    text: 'text-[#7fffe2]',
    surface: 'bg-[#64ffda]/[0.08]',
    border: 'border-[#64ffda]/20',
  },
  violet: {
    icon: 'text-[#a78bfa]',
    text: 'text-[#b9a5ff]',
    surface: 'bg-[#a78bfa]/[0.08]',
    border: 'border-[#a78bfa]/20',
  },
  amber: {
    icon: 'text-amber-300',
    text: 'text-amber-200',
    surface: 'bg-amber-400/[0.08]',
    border: 'border-amber-400/20',
  },
  blue: {
    icon: 'text-sky-300',
    text: 'text-sky-200',
    surface: 'bg-sky-400/[0.08]',
    border: 'border-sky-400/20',
  },
  rose: {
    icon: 'text-rose-300',
    text: 'text-rose-200',
    surface: 'bg-rose-400/[0.08]',
    border: 'border-rose-400/20',
  },
  slate: {
    icon: 'text-slate-300',
    text: 'text-slate-200',
    surface: 'bg-slate-400/[0.06]',
    border: 'border-slate-400/15',
  },
};

export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

export const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value || 0);

export const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value || 0);

export const parseCurrency = (value: string) => {
  const amount = Number(value.replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(amount) ? amount : 0;
};

interface PanelProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({ title, subtitle, action, className, bodyClassName, children }) => (
  <section
    className={cx(
      'min-w-0 overflow-hidden rounded-xl border border-[#273241] bg-[#101720] shadow-[0_18px_50px_rgba(0,0,0,0.16)]',
      className
    )}
  >
    {(title || subtitle || action) && (
      <header className="flex min-h-14 items-start justify-between gap-4 border-b border-[#273241] px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          {title && <h3 className="text-sm font-semibold tracking-[-0.01em] text-slate-100">{title}</h3>}
          {subtitle && <p className="mt-0.5 text-xs leading-5 text-slate-400">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
    )}
    <div className={cx('p-4 sm:p-5', bodyClassName)}>{children}</div>
  </section>
);

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon: React.ReactNode;
  tone?: AdminTone;
  trend?: { label: string; direction?: 'up' | 'down' | 'flat' };
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  detail,
  icon,
  tone = 'mint',
  trend,
  className,
}) => {
  const styles = toneMap[tone];
  const TrendIcon = trend?.direction === 'down' ? ArrowDownRight : trend?.direction === 'flat' ? Minus : ArrowUpRight;

  return (
    <article
      className={cx(
        'min-w-0 rounded-xl border border-[#273241] bg-[#101720] p-4 shadow-[0_14px_38px_rgba(0,0,0,0.14)]',
        'transition-colors duration-200 hover:border-[#354356]',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 min-h-8 text-[11px] font-medium leading-4 text-slate-400">{label}</p>
          <p className="mt-1 truncate text-xl font-semibold tracking-[-0.035em] text-slate-50 tabular-nums 2xl:text-2xl">{value}</p>
        </div>
        <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-lg border', styles.surface, styles.border, styles.icon)}>
          {icon}
        </span>
      </div>
      {(detail || trend) && (
        <div className="mt-3 flex min-h-5 items-center gap-2 text-[11px] leading-4">
          {trend && (
            <span className={cx('inline-flex items-center gap-1 font-medium', styles.text)}>
              <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {trend.label}
            </span>
          )}
          {detail && <span className="truncate text-slate-500">{detail}</span>}
        </div>
      )}
    </article>
  );
};

export const StatusPill: React.FC<{
  label: string;
  tone?: AdminTone;
  dot?: boolean;
  className?: string;
}> = ({ label, tone = 'slate', dot = false, className }) => {
  const styles = toneMap[tone];
  return (
    <span
      className={cx(
        'inline-flex min-h-6 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-semibold',
        styles.surface,
        styles.border,
        styles.text,
        className
      )}
    >
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full bg-current')} aria-hidden="true" />}
      {label}
    </span>
  );
};

export const EmptyData: React.FC<{ title: string; detail?: string }> = ({ title, detail }) => (
  <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed border-[#2c3848] bg-[#0c121a] px-6 text-center">
    <Info className="h-5 w-5 text-slate-500" aria-hidden="true" />
    <p className="mt-3 text-sm font-medium text-slate-300">{title}</p>
    {detail && <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{detail}</p>}
  </div>
);

export interface ChartSeries {
  name: string;
  values: number[];
  color: string;
  fill?: boolean;
}

interface LineChartProps {
  labels: string[];
  series: ChartSeries[];
  ariaLabel: string;
  height?: number;
  valueFormatter?: (value: number) => string;
}

export const LineChart: React.FC<LineChartProps> = ({
  labels,
  series,
  ariaLabel,
  height = 250,
  valueFormatter = formatCompactNumber,
}) => {
  const rawId = useId();
  const gradientId = `admin-chart-${rawId.replace(/:/g, '')}`;
  const allValues = series.flatMap((item) => item.values).filter((value) => Number.isFinite(value));
  const max = Math.max(...allValues, 1);
  const min = Math.min(...allValues, 0);
  const range = Math.max(max - min, 1);
  const width = 760;
  const chartHeight = 210;
  const left = 50;
  const right = 18;
  const top = 14;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = chartHeight - top - bottom;
  const pointCount = Math.max(labels.length, ...series.map((item) => item.values.length), 1);
  const xFor = (index: number) => left + (pointCount <= 1 ? plotWidth / 2 : (index / (pointCount - 1)) * plotWidth);
  const yFor = (value: number) => top + plotHeight - ((value - min) / range) * plotHeight;
  const pathFor = (values: number[]) =>
    values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(value)}`).join(' ');

  if (allValues.length === 0) {
    return <EmptyData title="No chart data yet" detail="This visualization will populate when telemetry is recorded." />;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2" aria-hidden="true">
        {series.map((item) => (
          <span key={item.name} className="inline-flex items-center gap-2 text-[11px] text-slate-400">
            <span className="h-0.5 w-5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${width} ${chartHeight}`}
        className="w-full overflow-visible"
        style={{ height }}
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="none"
      >
        <defs>
          {series.map((item, index) => (
            <linearGradient key={item.name} id={`${gradientId}-${index}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={item.color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={item.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = top + plotHeight * ratio;
          const value = max - range * ratio;
          return (
            <g key={ratio}>
              <line x1={left} x2={width - right} y1={y} y2={y} stroke="#273241" strokeWidth="1" />
              <text x={left - 9} y={y + 4} textAnchor="end" fill="#728095" fontSize="10">
                {valueFormatter(value)}
              </text>
            </g>
          );
        })}
        {series.map((item, seriesIndex) => {
          const path = pathFor(item.values);
          const finalPoint = item.values.length > 0 ? item.values.length - 1 : 0;
          const areaPath = `${path} L ${xFor(finalPoint)} ${top + plotHeight} L ${xFor(0)} ${top + plotHeight} Z`;
          return (
            <g key={item.name}>
              {item.fill && <path d={areaPath} fill={`url(#${gradientId}-${seriesIndex})`} />}
              <path d={path} fill="none" stroke={item.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
              {item.values.map((value, index) => (
                <circle
                  key={`${item.name}-${index}`}
                  cx={xFor(index)}
                  cy={yFor(value)}
                  r="3.5"
                  fill="#101720"
                  stroke={item.color}
                  strokeWidth="2"
                  tabIndex={0}
                  aria-label={`${labels[index] || `Point ${index + 1}`}: ${item.name} ${valueFormatter(value)}`}
                >
                  <title>{`${labels[index] || `Point ${index + 1}`}: ${item.name} ${valueFormatter(value)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {labels.map((label, index) => {
          const shouldShow = labels.length <= 8 || index === 0 || index === labels.length - 1 || index % 2 === 0;
          if (!shouldShow) return null;
          return (
            <text key={`${label}-${index}`} x={xFor(index)} y={chartHeight - 7} textAnchor="middle" fill="#728095" fontSize="10">
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
  detail?: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  centerValue: React.ReactNode;
  centerLabel: string;
  ariaLabel: string;
  className?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  segments,
  centerValue,
  centerLabel,
  ariaLabel,
  className,
}) => {
  const total = Math.max(segments.reduce((sum, item) => sum + Math.max(item.value, 0), 0), 1);
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <div className={cx('grid items-center gap-5', className)}>
      <div className="relative mx-auto h-36 w-36">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={ariaLabel}>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#25303d" strokeWidth="10" />
          {segments.map((segment) => {
            const length = (Math.max(segment.value, 0) / total) * circumference;
            const offset = -accumulated;
            accumulated += length;
            return (
              <circle
                key={segment.label}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="10"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
              >
                <title>{`${segment.label}: ${formatNumber(segment.value)}`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <strong className="text-xl font-semibold tracking-[-0.03em] text-slate-50 tabular-nums">{centerValue}</strong>
          <span className="mt-0.5 text-[10px] text-slate-500">{centerLabel}</span>
        </div>
      </div>
      <div className="min-w-0 space-y-2.5">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-slate-400">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden="true" />
              <span className="truncate">{segment.label}</span>
            </span>
            <span className="shrink-0 text-right font-medium text-slate-200 tabular-nums">
              {segment.detail || formatNumber(segment.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface HorizontalBarDatum {
  label: string;
  value: number;
  color?: string;
  detail?: string;
}

export const HorizontalBars: React.FC<{
  data: HorizontalBarDatum[];
  ariaLabel: string;
  emptyMessage?: string;
}> = ({ data, ariaLabel, emptyMessage = 'No comparison data yet' }) => {
  const max = Math.max(...data.map((item) => item.value), 1);
  if (data.length === 0) return <EmptyData title={emptyMessage} />;

  return (
    <div className="space-y-4" role="img" aria-label={ariaLabel}>
      {data.map((item) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-medium text-slate-300">{item.label}</span>
            <span className="shrink-0 text-slate-400 tabular-nums">{item.detail || formatNumber(item.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#232d3a]">
            <div
              className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 3 : 0)}%`, backgroundColor: item.color || '#64ffda' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export const TableFrame: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cx('overflow-x-auto rounded-xl border border-[#273241] bg-[#101720] custom-scrollbar', className)}>
    {children}
  </div>
);

export const tableHeadClass =
  'border-b border-[#273241] bg-[#141d28] text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500';
export const tableRowClass = 'border-b border-[#222d3b] transition-colors hover:bg-white/[0.025] last:border-b-0';
export const tableCellClass = 'px-4 py-3 text-xs text-slate-300';

export const SkeletonGrid: React.FC = () => (
  <div className="space-y-4" aria-label="Loading admin data" role="status">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-xl border border-[#273241] bg-[#101720] motion-reduce:animate-none" />
      ))}
    </div>
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="h-80 animate-pulse rounded-xl border border-[#273241] bg-[#101720] motion-reduce:animate-none xl:col-span-2" />
      <div className="h-80 animate-pulse rounded-xl border border-[#273241] bg-[#101720] motion-reduce:animate-none" />
    </div>
  </div>
);
