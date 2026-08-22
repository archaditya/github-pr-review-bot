'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRepository } from '@/hooks/use-repository';
import { useReviewJobs } from '@/hooks/use-review-jobs';
import { useUpdateRepository } from '@/hooks/use-update-repository';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function RepositoryDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: repository, isLoading: repoLoading } = useRepository(params.id);
  const { data: jobs, isLoading: jobsLoading } = useReviewJobs(params.id);
  const updateRepository = useUpdateRepository(params.id);

  if (repoLoading) return <Skeleton className="h-24 w-full rounded-lg" />;

  if (!repository) {
    return (
      <EmptyState
        title="Repository not found"
        description="It may have been removed, or you no longer have access."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-xl font-semibold tracking-tight">{repository.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {repository.isActive ? 'Reviews are active on this repository' : 'Reviews are paused'}
          </p>
        </div>
        <Button
          variant={repository.isActive ? 'outline' : 'default'}
          onClick={() => updateRepository.mutate(!repository.isActive)}
          disabled={updateRepository.isPending}
        >
          {repository.isActive ? 'Pause reviews' : 'Resume reviews'}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Review activity
        </h2>

        {jobsLoading && (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        )}

        {jobs && jobs.length === 0 && (
          <EmptyState
            title="No reviews yet"
            description="Open a pull request on this repository to trigger one."
          />
        )}

        {jobs && jobs.length > 0 && (
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/review-jobs/${job.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    #{job.pullRequest?.githubPrNumber} {job.pullRequest?.title}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    @{job.pullRequest?.authorLogin}
                  </span>
                </div>
                <StatusBadge status={job.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
