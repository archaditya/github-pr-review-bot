'use client';

import { useParams } from 'next/navigation';
import { useReviewJob } from '@/hooks/use-review-job';
import { PipelineStepper } from '@/components/pipeline-stepper';
import { FindingsList } from '@/components/findings-list';
import { ConversationThread } from '@/components/conversation-thread';
import { EmptyState } from '@/components/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReviewJobDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: job, isLoading } = useReviewJob(params.id);

  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;

  if (!job) {
    return (
      <EmptyState
        title="Review not found"
        description="It may have been removed, or you no longer have access."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <span className="font-mono text-xs text-muted-foreground">
          #{job.pullRequest?.githubPrNumber}
        </span>
        <h1 className="text-xl font-semibold tracking-tight">{job.pullRequest?.title}</h1>
        <p className="font-mono text-xs text-muted-foreground">@{job.pullRequest?.authorLogin}</p>
      </div>

      <PipelineStepper status={job.status} />

      {job.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {job.error}
        </div>
      )}

      {job.summaryComment && (
        <div className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Findings
          </h2>
          <FindingsList findings={job.summaryComment.findings} />
        </div>
      )}

      {job.conversationMessages.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Conversation
          </h2>
          <ConversationThread messages={job.conversationMessages} />
        </div>
      )}
    </div>
  );
}
