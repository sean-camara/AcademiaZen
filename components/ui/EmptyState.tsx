import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'px-4 py-8' : 'px-6 py-14'}`}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zen-primary/20 bg-zen-primary/10 text-zen-primary">
        {icon}
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-zen-text-primary">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-zen-text-secondary">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 min-h-11 rounded-xl bg-zen-primary px-5 py-2.5 text-sm font-semibold text-zen-bg shadow-lg shadow-zen-primary/10 transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-primary"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
