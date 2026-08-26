import { Loader2, Database, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReviewJobStatus, RepoIndexStatus } from '@/types/api';

const STATUS_LABEL: Record<ReviewJobStatus, string> = {
  PENDING: 'Queued',
  FETCHING_DIFF: 'Fetching diff',
  ANALYZING_IMPACT: 'Analyzing impact',
  BUILDING_CONTEXT: 'Building context',
  RESOLVING_USAGES: 'Resolving usages',
  GENERATING_REVIEW: 'Generating review',
  POSTING_COMMENTS: 'Posting comment',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  RETRYING: 'Retrying',
};

const IN_FLIGHT: ReviewJobStatus[] = [
  'PENDING',
  'FETCHING_DIFF',
  'ANALYZING_IMPACT',
  'BUILDING_CONTEXT',
  'RESOLVING_USAGES',
  'GENERATING_REVIEW',
  'POSTING_COMMENTS',
  'RETRYING',
];

export function StatusBadge({ status }: { status: ReviewJobStatus }) {
  const inFlight = IN_FLIGHT.includes(status);

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs',
        status === 'COMPLETED' && 'border-diff-add/30 bg-diff-add/10 text-diff-add',
        status === 'FAILED' && 'border-destructive/30 bg-destructive/10 text-destructive',
        inFlight && 'border-primary/30 bg-primary/10 text-primary',
      )}
    >
      {inFlight && <Loader2 className="h-3 w-3 animate-spin" />}
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export function IndexStatusBadge({ status }: { status: RepoIndexStatus }) {
  switch (status) {
    case 'INDEXED':
      return (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-diff-add/30 bg-diff-add/10 px-2.5 py-0.5 font-mono text-xs text-diff-add">
          <CheckCircle2 className="h-3 w-3" />
          Indexed
        </span>
      );
    case 'INDEXING':
      return (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-xs text-primary">
          <Loader2 className="h-3 w-3 animate-spin" />
          Indexing...
        </span>
      );
    case 'REINDEXING':
      return (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-xs text-primary">
          <Loader2 className="h-3 w-3 animate-spin" />
          Re-indexing...
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 font-mono text-xs text-destructive">
          <AlertTriangle className="h-3 w-3" />
          Index Failed
        </span>
      );
    case 'NOT_INDEXED':
    default:
      return (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Not Indexed
        </span>
      );
  }
}
