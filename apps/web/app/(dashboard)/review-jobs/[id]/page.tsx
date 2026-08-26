'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RotateCw, Ban, Trash2, AlertCircle } from 'lucide-react';
import { useReviewJob } from '@/hooks/use-review-job';
import {
  useCancelReviewJob,
  useDeleteReviewJob,
  useRetryReviewJob,
} from '@/hooks/use-review-job-actions';
import { PipelineStepper } from '@/components/pipeline-stepper';
import { FindingsList } from '@/components/findings-list';
import { ConversationThread } from '@/components/conversation-thread';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReviewJobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: job, isLoading } = useReviewJob(params.id);

  const cancelJob = useCancelReviewJob();
  const deleteJob = useDeleteReviewJob();
  const retryJob = useRetryReviewJob();

  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;

  if (!job) {
    return (
      <EmptyState
        title="Review not found"
        description="It may have been removed, or you no longer have access."
      />
    );
  }

  const inFlight = job.status !== 'COMPLETED' && job.status !== 'FAILED';

  async function handleDelete() {
    if (confirm('Are you sure you want to delete this review job?')) {
      await deleteJob.mutateAsync(job.id);
      router.replace(job.pullRequest ? `/repositories` : '/');
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      {/* Header with Navigation & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <Link
            href="/"
            className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground font-semibold">
              #{job.pullRequest?.githubPrNumber}
            </span>
            <h1 className="text-xl font-semibold tracking-tight">{job.pullRequest?.title}</h1>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Author: @{job.pullRequest?.authorLogin} &bull; Created: {new Date(job.createdAt).toLocaleString()}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => retryJob.mutate(job.id)}
            disabled={retryJob.isPending}
            className="flex items-center gap-1.5 font-mono text-xs"
          >
            <RotateCw className={`h-3.5 w-3.5 ${retryJob.isPending ? 'animate-spin' : ''}`} />
            {retryJob.isPending ? 'Re-triggering...' : 'Retry Review'}
          </Button>

          {inFlight && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => cancelJob.mutate(job.id)}
              disabled={cancelJob.isPending}
              className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-destructive"
            >
              <Ban className="h-3.5 w-3.5" />
              Cancel
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleteJob.isPending}
            className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Visual Pipeline Stepper */}
      <PipelineStepper status={job.status} />

      {/* Error Callout Banner */}
      {job.error && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive shadow-sm">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Review Pipeline Failed</p>
              <p className="font-mono text-xs mt-1 opacity-90">{job.error}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => retryJob.mutate(job.id)}
            disabled={retryJob.isPending}
            className="shrink-0 text-xs font-mono"
          >
            Retry Now
          </Button>
        </div>
      )}

      {/* Findings */}
      {job.summaryComment && (
        <div className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            Findings ({job.summaryComment.findings?.length || 0})
          </h2>
          <FindingsList findings={job.summaryComment.findings || []} />
        </div>
      )}

      {/* Conversation Thread */}
      {job.conversationMessages && job.conversationMessages.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            Conversation Thread
          </h2>
          <ConversationThread messages={job.conversationMessages} />
        </div>
      )}
    </div>
  );
}
