'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Database, RefreshCw, GitBranch, GitCommit, FileCode2, Clock, AlertCircle } from 'lucide-react';
import { useRepository } from '@/hooks/use-repository';
import { useReviewJobs } from '@/hooks/use-review-jobs';
import { useUpdateRepository } from '@/hooks/use-update-repository';
import { useReindexRepository } from '@/hooks/use-reindex-repository';
import { StatusBadge, IndexStatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function RepositoryDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: repository, isLoading: repoLoading } = useRepository(params.id);
  const { data: jobs, isLoading: jobsLoading } = useReviewJobs(params.id);
  const updateRepository = useUpdateRepository(params.id);
  const reindexRepository = useReindexRepository(params.id);

  if (repoLoading) return <Skeleton className="h-24 w-full rounded-lg" />;

  if (!repository) {
    return (
      <EmptyState
        title="Repository not found"
        description="It may have been removed, or you no longer have access."
      />
    );
  }

  const isIndexing = repository.indexStatus === 'INDEXING' || repository.indexStatus === 'REINDEXING';

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-xl font-semibold tracking-tight">{repository.fullName}</h1>
            <IndexStatusBadge status={repository.indexStatus} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {repository.isActive ? 'Automated PR reviews are enabled' : 'Automated reviews are currently paused'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => reindexRepository.mutate()}
            disabled={isIndexing || reindexRepository.isPending}
            className="flex items-center gap-1.5 font-mono text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isIndexing || reindexRepository.isPending ? 'animate-spin' : ''}`} />
            {isIndexing ? 'Indexing...' : 'Re-index Graph'}
          </Button>

          <Button
            variant={repository.isActive ? 'outline' : 'default'}
            size="sm"
            onClick={() => updateRepository.mutate(!repository.isActive)}
            disabled={updateRepository.isPending}
          >
            {repository.isActive ? 'Pause reviews' : 'Resume reviews'}
          </Button>
        </div>
      </div>

      {/* Index Error Alert */}
      {repository.indexError && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Indexing Failed</p>
            <p className="font-mono text-xs opacity-90">{repository.indexError}</p>
          </div>
        </div>
      )}

      {/* Code Knowledge Graph Card */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-semibold">
              Code Knowledge Graph
            </h2>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">Neo4j Persistent Graph</span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
              <FileCode2 className="h-3 w-3" /> Indexed Files
            </span>
            <span className="font-mono text-base font-semibold">{repository.fileCount || 0}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
              <Database className="h-3 w-3" /> Indexed Symbols
            </span>
            <span className="font-mono text-base font-semibold">{repository.symbolCount || 0}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
              <GitBranch className="h-3 w-3" /> Default Branch
            </span>
            <span className="font-mono text-base font-semibold">{repository.defaultBranch || 'main'}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
              <GitCommit className="h-3 w-3" /> Indexed Commit
            </span>
            <span className="font-mono text-xs font-semibold truncate" title={repository.indexedCommitSha || 'None'}>
              {repository.indexedCommitSha ? repository.indexedCommitSha.substring(0, 8) : '—'}
            </span>
          </div>
        </div>

        {repository.indexedAt && (
          <div className="mt-4 pt-3 border-t border-border flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Last indexed: {new Date(repository.indexedAt).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Review Activity */}
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
            description="Open a pull request on this repository to trigger an automated review."
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
