'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  RotateCw,
  Ban,
  Trash2,
  AlertCircle,
  Hash,
  GitCommit,
  GitPullRequest,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import { useReviewJob } from '@/hooks/use-review-job';
import {
  useCancelReviewJob,
  useDeleteReviewJob,
  useRetryReviewJob,
} from '@/hooks/use-review-job-actions';
import { PipelineStepper } from '@/components/pipeline-stepper';
import { FindingsList } from '@/components/findings-list';
import { PipelineActivityLog } from '@/components/pipeline-activity-log';
import { ConversationThread } from '@/components/conversation-thread';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ReviewJobDetail } from '@/types/api';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

export default function ReviewJobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: job, isLoading } = useReviewJob(params.id);

  const cancelJob = useCancelReviewJob();
  const deleteJob = useDeleteReviewJob();
  const retryJob = useRetryReviewJob();

  // All runs for this PR (ordered newest first)
  const runs: ReviewJobDetail[] = useMemo(() => {
    if (!job) return [];
    const list =
      job.pullRequest?.reviewJobs && job.pullRequest.reviewJobs.length > 0
        ? job.pullRequest.reviewJobs
        : [job];

    // Ensure currently selected job exists in the list
    const hasCurrent = list.some((r) => r.id === job.id);
    const combined = hasCurrent ? list : [job, ...list];

    return [...combined].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [job]);

  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;

  if (!job) {
    return (
      <EmptyState
        title="Review not found"
        description="It may have been removed, or you no longer have access."
      />
    );
  }

  async function handleDelete(targetJobId: string) {
    if (confirm('Are you sure you want to delete this review job?')) {
      await deleteJob.mutateAsync(targetJobId);
      router.replace('/repositories');
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-5xl pb-16">
      {/* Header with Navigation & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-6">
        <div className="flex flex-col gap-1.5">
          <Link
            href="/"
            className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-sm font-bold text-primary">
              #{job.pullRequest?.githubPrNumber}
            </span>
            <h1 className="text-xl font-semibold tracking-tight">{job.pullRequest?.title}</h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground font-mono">
            <span>Author: @{job.pullRequest?.authorLogin}</span>
            <span>&bull;</span>
            <span>PR Created: {new Date(job.pullRequest?.createdAt || job.createdAt).toLocaleString()}</span>
            {job.pullRequest?.headSha && (
              <>
                <span>&bull;</span>
                <span className="inline-flex items-center gap-1 text-foreground bg-muted/80 px-2 py-0.5 rounded border border-border/60">
                  <GitCommit className="h-3 w-3 text-primary" />
                  {job.pullRequest.headSha.slice(0, 7)}
                </span>
              </>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-primary text-[11px] font-medium">
              <Layers className="h-3 w-3" />
              {runs.length} {runs.length === 1 ? 'Review Run' : 'Review Runs'}
            </span>
          </div>
        </div>

        {/* Global PR Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => retryJob.mutate(job.id)}
            disabled={retryJob.isPending}
            className="flex items-center gap-1.5 font-mono text-xs"
          >
            <RotateCw className={`h-3.5 w-3.5 ${retryJob.isPending ? 'animate-spin' : ''}`} />
            {retryJob.isPending ? 'Re-triggering...' : 'Re-run Review'}
          </Button>
        </div>
      </div>

      {/* Quick Jump Bar for Multiple Runs */}
      {runs.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
          <span className="text-muted-foreground uppercase tracking-wider text-[11px] font-semibold shrink-0">
            Jump to Run:
          </span>
          {runs.map((run, idx) => {
            const runNum = runs.length - idx;
            const isLatest = idx === 0;
            const isCurrentUrl = run.id === params.id;
            const webhookEvt = run.events?.find((e) => e.step === 'webhook_received');
            const sha =
              (webhookEvt?.detail as Record<string, unknown> | null)?.headSha as string | undefined ||
              job.pullRequest?.headSha;

            return (
              <a
                key={run.id}
                href={`#run-${run.id}`}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-all shrink-0 ${
                  isCurrentUrl
                    ? 'border-primary bg-primary/10 text-primary font-medium shadow-sm'
                    : 'border-border bg-card hover:bg-accent/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Run #{runNum}</span>
                {isLatest && (
                  <span className="rounded bg-primary/20 px-1 py-0.2 text-[10px] text-primary">
                    Latest
                  </span>
                )}
                {sha && (
                  <span className="text-[10px] opacity-70">({sha.slice(0, 7)})</span>
                )}
              </a>
            );
          })}
        </div>
      )}

      {/* Runs Timeline - Scrollable List of All Review Events */}
      <div className="flex flex-col gap-10">
        {runs.map((run, idx) => {
          const runNum = runs.length - idx;
          const isLatest = idx === 0;
          const isCurrentUrl = run.id === params.id;
          const inFlight = run.status !== 'COMPLETED' && run.status !== 'FAILED';

          const webhookEvt = run.events?.find((e) => e.step === 'webhook_received');
          const detail = webhookEvt?.detail as Record<string, unknown> | null;
          const action = (detail?.action as string) || (runNum === 1 ? 'opened' : 'synchronize');
          const sha = (detail?.headSha as string) || job.pullRequest?.headSha;
          const findings = run.summaryComment?.findings || [];

          const totalDuration =
            run.startedAt && run.completedAt
              ? formatDuration(new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime())
              : null;

          return (
            <div
              key={run.id}
              id={`run-${run.id}`}
              className={`flex flex-col gap-6 rounded-xl border p-6 bg-card/60 transition-all ${
                isCurrentUrl
                  ? 'border-primary/50 shadow-md ring-1 ring-primary/20'
                  : 'border-border/80'
              }`}
            >
              {/* Run Card Header */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-sm font-bold text-foreground">
                      Run #{runNum}
                    </span>
                    {isLatest && (
                      <span className="rounded-full bg-primary/20 border border-primary/30 px-2 py-0.5 text-[10px] font-mono text-primary font-semibold">
                        Latest Run
                      </span>
                    )}
                    {sha && (
                      <span className="inline-flex items-center gap-1 font-mono text-xs bg-muted/80 border border-border/70 px-2 py-0.5 rounded text-foreground">
                        <GitCommit className="h-3 w-3 text-primary" />
                        Commit: {sha.slice(0, 7)}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 font-mono text-xs bg-secondary/80 border border-border/60 px-2 py-0.5 rounded text-muted-foreground uppercase tracking-wide text-[10px]">
                      <GitPullRequest className="h-3 w-3" />
                      {action === 'opened' ? 'PR Opened' : action === 'synchronize' ? 'New Commit Pushed' : action}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(run.createdAt).toLocaleString()}
                    </span>
                    {totalDuration && (
                      <>
                        <span>&bull;</span>
                        <span className="text-foreground font-medium">
                          Duration: {totalDuration}
                        </span>
                      </>
                    )}
                    {run.attemptCount > 1 && (
                      <>
                        <span>&bull;</span>
                        <span className="inline-flex items-center gap-0.5">
                          <Hash className="h-3 w-3" />
                          Attempt {run.attemptCount}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status and Single-Run Controls */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <StatusBadge status={run.status} />

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => retryJob.mutate(run.id)}
                    disabled={retryJob.isPending}
                    title="Retry this specific run"
                    className="flex items-center gap-1 font-mono text-xs h-8"
                  >
                    <RotateCw className={`h-3 w-3 ${retryJob.isPending ? 'animate-spin' : ''}`} />
                    Retry
                  </Button>

                  {inFlight && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cancelJob.mutate(run.id)}
                      disabled={cancelJob.isPending}
                      className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-destructive h-8"
                    >
                      <Ban className="h-3 w-3" />
                      Cancel
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(run.id)}
                    disabled={deleteJob.isPending}
                    className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-destructive h-8 px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Visual Stepper */}
              <PipelineStepper status={run.status} />

              {/* Error Callout Banner if failed */}
              {run.error && (
                <div className="flex items-start justify-between gap-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive shadow-sm">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Review Run #{runNum} Failed</p>
                      <p className="font-mono text-xs mt-1 opacity-90">{run.error}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => retryJob.mutate(run.id)}
                    disabled={retryJob.isPending}
                    className="shrink-0 text-xs font-mono"
                  >
                    Retry Now
                  </Button>
                </div>
              )}

              {/* Pipeline Activity Log for this run */}
              {run.events && run.events.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                    Pipeline Activity &bull; Run #{runNum}
                  </h2>
                  <PipelineActivityLog
                    events={run.events}
                    startedAt={run.startedAt}
                    completedAt={run.completedAt}
                  />
                </div>
              )}

              {/* Findings for this run */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                    Findings &bull; Run #{runNum} ({findings.length})
                  </h2>
                </div>

                {findings.length > 0 ? (
                  <FindingsList findings={findings} />
                ) : run.status === 'COMPLETED' ? (
                  <div className="flex items-center gap-2 rounded-lg border border-diff-add/30 bg-diff-add/5 p-4 text-sm text-diff-add font-mono">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Clean code! No issues or findings detected in this run.</span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-card/40 p-4 text-xs font-mono text-muted-foreground">
                    Review is still in progress...
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Conversation Thread (Shared for the PR) */}
      {job.conversationMessages && job.conversationMessages.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border pt-8">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            Conversation Thread
          </h2>
          <ConversationThread messages={job.conversationMessages} />
        </div>
      )}
    </div>
  );
}
