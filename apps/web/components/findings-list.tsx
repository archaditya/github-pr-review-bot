import { Network, Sparkles, Tag } from 'lucide-react';
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
    <div className="flex flex-col gap-3">
      {findings.map((finding, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-lg border border-l-4 border-border bg-card px-4 py-3.5 shadow-sm"
          style={{ borderLeftColor: `hsl(var(--severity-${finding.severity}))` }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-medium text-foreground">
                {finding.file}
                {finding.line ? `:${finding.line}` : ''}
              </span>
              {finding.confidence && (
                <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase">
                  <Sparkles className="h-2.5 w-2.5" />
                  {finding.confidence}
                </span>
              )}
            </div>
            <SeverityBadge severity={finding.severity} />
          </div>

          <p className="text-sm text-foreground leading-relaxed">{finding.rationale}</p>

          {finding.evidence && (
            <div className="flex items-start gap-1.5 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Network className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
              <span>
                <strong className="font-semibold text-foreground">Graph Evidence:</strong>{' '}
                {finding.evidence}
              </span>
            </div>
          )}

          {finding.affected_symbols && finding.affected_symbols.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 pt-1">
              <Tag className="h-3 w-3 text-muted-foreground mr-1" />
              {finding.affected_symbols.map((sym, i) => (
                <span
                  key={i}
                  className="inline-block rounded bg-secondary/50 px-1.5 py-0.5 font-mono text-[10px] text-secondary-foreground"
                >
                  {sym}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
