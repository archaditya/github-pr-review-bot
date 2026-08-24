import { SeverityBadge } from '@/components/severity-badge';
import type { Finding } from '@/types/api';

export function FindingsList({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return (
      <div className="rounded-lg border border-diff-add/30 bg-diff-add/5 px-4 py-3 text-sm text-diff-add">
        No issues found.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {findings.map((finding, index) => (
        <div
          key={index}
          className="flex flex-col gap-1.5 rounded-lg border border-l-2 border-border bg-card px-4 py-3"
          style={{ borderLeftColor: `hsl(var(--severity-${finding.severity}))` }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {finding.file}
              {finding.line ? `:${finding.line}` : ''}
            </span>
            <SeverityBadge severity={finding.severity} />
          </div>
          <p className="text-sm text-foreground">{finding.rationale}</p>
        </div>
      ))}
    </div>
  );
}
