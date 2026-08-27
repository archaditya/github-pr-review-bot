'use client';

import { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  GitPullRequest,
  Search,
  Network,
  Brain,
  MessageSquare,
  Timer,
  Zap,
  RotateCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JobEvent } from '@/types/api';

const STEP_META: Record<string, { label: string; description: string; icon: typeof Clock }> = {
  webhook_received: {
    label: 'Webhook Received',
    description: 'GitHub PR event received and validated',
    icon: GitPullRequest,
  },
  fetch_diff: {
    label: 'Fetch Diff',
    description: 'Pulled unified diff and changed files list from GitHub API',
    icon: Search,
  },
  analyze_impact: {
    label: 'Analyze Impact',
    description: 'Queried Neo4j code knowledge graph for blast radius — callers, callees, affected endpoints',
    icon: Network,
  },
  build_context: {
    label: 'Build Context',
    description: 'Assembled structural context from diff hunks and file metadata for AI review',
    icon: Zap,
  },
  generate_review: {
    label: 'Generate Review',
    description: 'AI analysis via Gemini — structured findings with file, line, severity, rationale',
    icon: Brain,
  },
  post_comment: {
    label: 'Post Comment',
    description: 'Published structured review as a summary comment on the GitHub PR',
    icon: MessageSquare,
  },
  complete: {
    label: 'Pipeline Complete',
    description: 'All steps finished successfully',
    icon: CheckCircle2,
  },
  pipeline_failed: {
    label: 'Pipeline Failed',
    description: 'Pipeline encountered an unrecoverable error',
    icon: XCircle,
  },
  cancelled_by_user: {
    label: 'Cancelled',
    description: 'Review was cancelled by the user',
    icon: XCircle,
  },
  retried_by_user: {
    label: 'Retry Triggered',
    description: 'User manually re-triggered the review pipeline',
    icon: RotateCw,
  },
};

function getStepMeta(step: string) {
  return STEP_META[step] || {
    label: step.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: '',
    icon: Clock,
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface PipelineActivityLogProps {
  events: JobEvent[];
  startedAt?: string | null;
  completedAt?: string | null;
}

export function PipelineActivityLog({ events, startedAt, completedAt }: PipelineActivityLogProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  if (!events || events.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        No pipeline events recorded yet.
      </div>
    );
  }

  const totalDuration =
    startedAt && completedAt
      ? new Date(completedAt).getTime() - new Date(startedAt).getTime()
      : null;

  // Check if graph context was used (from the 'complete' event's detail)
  const completeEvent = events.find((e) => e.step === 'complete');
  const hadGraphContext = completeEvent?.detail?.hadGraphContext;
  const findingsCount = completeEvent?.detail?.findingsCount;

  function toggleExpand(eventId: string) {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Pipeline Summary Header */}
      <div className="flex flex-wrap items-center gap-3">
        {totalDuration !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2.5 py-1 font-mono text-xs text-muted-foreground">
            <Timer className="h-3 w-3" />
            Total: {formatDuration(totalDuration)}
          </span>
        )}
        {hadGraphContext !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs',
              hadGraphContext
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border bg-muted/30 text-muted-foreground',
            )}
          >
            <Network className="h-3 w-3" />
            {hadGraphContext ? 'Graph-Enhanced Review' : 'Standard Review (no graph)'}
          </span>
        )}
        {findingsCount !== undefined && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2.5 py-1 font-mono text-xs text-muted-foreground">
            {findingsCount as number} finding{(findingsCount as number) !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Timeline */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {events.map((event, index) => {
          const meta = getStepMeta(event.step);
          const Icon = meta.icon;
          const isExpanded = expandedEvents.has(event.id);
          const isFailed = event.status === 'failed';
          const isSucceeded = event.status === 'succeeded';
          const hasDetail = event.detail && Object.keys(event.detail).length > 0;

          // Calculate step duration from this event to the next
          const nextEvent = events[index + 1];
          const stepDuration = nextEvent
            ? new Date(nextEvent.createdAt).getTime() - new Date(event.createdAt).getTime()
            : null;

          return (
            <div
              key={event.id}
              className={cn(
                'group relative border-b border-border last:border-b-0 transition-colors',
                hasDetail && 'cursor-pointer hover:bg-accent/30',
              )}
            >
              {/* Main row */}
              <div
                className="flex items-center gap-3 px-4 py-3"
                onClick={() => hasDetail && toggleExpand(event.id)}
              >
                {/* Timeline connector */}
                <div className="relative flex flex-col items-center">
                  <div
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                      isSucceeded && 'border-diff-add/40 bg-diff-add/10 text-diff-add',
                      isFailed && 'border-destructive/40 bg-destructive/10 text-destructive',
                      !isSucceeded && !isFailed && 'border-primary/40 bg-primary/10 text-primary',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {/* Vertical line connector */}
                  {index < events.length - 1 && (
                    <div
                      className={cn(
                        'absolute top-7 w-px h-full',
                        isSucceeded ? 'bg-diff-add/20' : isFailed ? 'bg-destructive/20' : 'bg-border',
                      )}
                    />
                  )}
                </div>

                {/* Step info */}
                <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium text-foreground">
                      {meta.label}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] uppercase',
                        isSucceeded && 'bg-diff-add/10 text-diff-add',
                        isFailed && 'bg-destructive/10 text-destructive',
                        !isSucceeded && !isFailed && 'bg-primary/10 text-primary',
                      )}
                    >
                      {event.status}
                    </span>
                  </div>
                  {meta.description && (
                    <span className="text-[11px] text-muted-foreground leading-tight">
                      {meta.description}
                    </span>
                  )}
                </div>

                {/* Timing */}
                <div className="flex items-center gap-3 shrink-0">
                  {stepDuration !== null && stepDuration > 0 && (
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {formatDuration(stepDuration)}
                    </span>
                  )}
                  <span className="font-mono text-[11px] text-muted-foreground/60 tabular-nums">
                    {formatTimestamp(event.createdAt)}
                  </span>
                  {hasDetail && (
                    <span className="text-muted-foreground">
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && hasDetail && (
                <div className="border-t border-border/50 bg-muted/20 px-4 py-3 ml-10">
                  <pre className="font-mono text-[11px] text-muted-foreground whitespace-pre-wrap overflow-x-auto leading-relaxed">
                    {JSON.stringify(event.detail, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
