import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReviewJobStatus } from '@/types/api';

const STATUS_LABEL: Record<ReviewJobStatus, string> = {
  PENDING: 'Queued',
  FETCHING_DIFF: 'Fetching diff',
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
      {STATUS_LABEL[status]}
    </span>
  );
}
