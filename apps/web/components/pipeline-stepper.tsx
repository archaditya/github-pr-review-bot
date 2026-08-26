import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReviewJobStatus } from '@/types/api';

/**
 * The steps here reflect the ReviewJob state machine:
 * PENDING -> FETCHING_DIFF -> ANALYZING_IMPACT -> BUILDING_CONTEXT -> GENERATING_REVIEW -> POSTING_COMMENTS -> COMPLETED
 */
const STEPS: { key: ReviewJobStatus; label: string; aliases?: ReviewJobStatus[] }[] = [
  { key: 'PENDING', label: 'Queued' },
  { key: 'FETCHING_DIFF', label: 'Fetch diff' },
  { key: 'ANALYZING_IMPACT', label: 'Analyze impact', aliases: ['RESOLVING_USAGES'] },
  { key: 'BUILDING_CONTEXT', label: 'Build context' },
  { key: 'GENERATING_REVIEW', label: 'Generate review' },
  { key: 'POSTING_COMMENTS', label: 'Post comment' },
  { key: 'COMPLETED', label: 'Done' },
];

export function PipelineStepper({ status }: { status: ReviewJobStatus }) {
  const failed = status === 'FAILED';
  const foundIndex = STEPS.findIndex(
    (step) => step.key === status || (step.aliases && step.aliases.includes(status)),
  );
  const activeIndex = foundIndex === -1 ? (failed ? STEPS.length - 1 : 0) : foundIndex;
  const isDoneOverall = status === 'COMPLETED';

  return (
    <div className="flex items-center overflow-x-auto rounded-lg border border-border bg-card px-4 py-5">
      {STEPS.map((step, index) => {
        const isPast = index < activeIndex || isDoneOverall;
        const isCurrent = index === activeIndex && !isDoneOverall && !failed;
        const isFailedHere = failed && index === activeIndex;

        return (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs transition-colors',
                  isPast && 'border-diff-add bg-diff-add/15 text-diff-add',
                  isCurrent && 'animate-pulse-ring border-primary bg-primary/15 text-primary',
                  isFailedHere && 'border-destructive bg-destructive/15 text-destructive',
                  !isPast && !isCurrent && !isFailedHere && 'border-border bg-transparent text-muted-foreground',
                )}
              >
                {isPast ? (
                  <Check className="h-3.5 w-3.5" />
                ) : isFailedHere ? (
                  <X className="h-3.5 w-3.5" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  'whitespace-nowrap font-mono text-[11px]',
                  isPast || isCurrent || isFailedHere ? 'text-foreground font-medium' : 'text-muted-foreground',
                )}
              >
                {isFailedHere ? 'Failed' : step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={cn('mx-2 h-px flex-1', isPast ? 'bg-diff-add/50' : 'bg-border')} />
            )}
          </div>
        );
      })}
    </div>
  );
}
