import { cn } from '@/lib/utils';
import type { Severity } from '@/types/api';

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

const SEVERITY_CLASS: Record<Severity, string> = {
  critical: 'border-severity-critical/30 bg-severity-critical/10 text-severity-critical',
  high: 'border-severity-high/30 bg-severity-high/10 text-severity-high',
  medium: 'border-severity-medium/30 bg-severity-medium/10 text-severity-medium',
  low: 'border-severity-low/30 bg-severity-low/10 text-severity-low',
  info: 'border-severity-info/30 bg-severity-info/10 text-severity-info',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide',
        SEVERITY_CLASS[severity],
      )}
    >
      {SEVERITY_LABEL[severity]}
    </span>
  );
}
