import type { ReactNode } from 'react';

type TrendDirection = 'up' | 'down' | 'neutral';

interface MetricCardProps {
  label: string;
  value: string;
  trend?: {
    direction: TrendDirection;
    text: string;
  };
  /** Override value text color: positive (green), negative (red), warning (amber), or default */
  color?: 'positive' | 'negative' | 'warning' | 'default';
  icon?: ReactNode;
  className?: string;
}

export function MetricCard({
  label,
  value,
  trend,
  color = 'default',
  icon,
  className = '',
}: MetricCardProps) {
  const valueColors: Record<string, string> = {
    positive: 'text-positive',
    negative: 'text-negative',
    warning: 'text-warning',
    default: 'text-text-primary',
  };

  const trendColors: Record<TrendDirection, string> = {
    up: 'text-positive',
    down: 'text-negative',
    neutral: 'text-text-secondary',
  };

  const trendIcons: Record<TrendDirection, string> = {
    up: '\u2191',    // ↑
    down: '\u2193',  // ↓
    neutral: '\u2192', // →
  };

  return (
    <div
      className={`bg-white rounded-lg border border-card-border shadow-sm p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-secondary truncate">
            {label}
          </p>
          <p
            className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-tight ${valueColors[color]}`}
          >
            {value}
          </p>
          {trend && (
            <p
              className={`mt-1.5 text-sm font-medium ${trendColors[trend.direction]}`}
            >
              <span aria-hidden="true">{trendIcons[trend.direction]} </span>
              {trend.text}
            </p>
          )}
        </div>

        {icon && (
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-bg-secondary text-text-secondary shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
