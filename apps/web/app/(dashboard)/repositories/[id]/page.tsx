'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Database,
  RefreshCw,
  GitBranch,
  GitCommit,
  FileCode2,
  Clock,
  AlertCircle,
  RotateCcw,
  Trash2,
  Ban,
  Play,
  RotateCw,
  Info,
  Hash,
  ChevronDown,
  ChevronRight,
  TreePine,
  Workflow,
  Waypoints,
  MessageSquareCode,
} from 'lucide-react';
import { useRepository } from '@/hooks/use-repository';
import { useReviewJobs } from '@/hooks/use-review-jobs';
import { useUpdateRepository } from '@/hooks/use-update-repository';
import { useReindexRepository } from '@/hooks/use-reindex-repository';
import { useResetIndexRepository } from '@/hooks/use-reset-index-repository';
import {
  useCancelReviewJob,
  useDeleteReviewJob,
  useRetryReviewJob,
} from '@/hooks/use-review-job-actions';
import { StatusBadge, IndexStatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function RepositoryDetailPage() {
  const params = useParams<{ id: string }>();
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const { data: repository, isLoading: repoLoading } = useRepository(params.id);
  const { data: jobs, isLoading: jobsLoading } = useReviewJobs(params.id);
  const updateRepository = useUpdateRepository(params.id);
  const reindexRepository = useReindexRepository(params.id);
  const resetIndexRepository = useResetIndexRepository(params.id);

  const cancelJob = useCancelReviewJob();
  const deleteJob = useDeleteReviewJob();
  const retryJob = useRetryReviewJob();

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
          {isIndexing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetIndexRepository.mutate()}
              disabled={resetIndexRepository.isPending}
              className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-destructive"
              title="Reset stuck indexing state"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Index
            </Button>
          )}

          <Link href={`/repositories/${repository.id}/chat`}>
            <Button
              variant="default"
              size="sm"
              className="flex items-center gap-1.5 font-mono text-xs bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
            >
              <MessageSquareCode className="h-3.5 w-3.5" />
              Chat with Repo
            </Button>
          </Link>

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
        <div className="flex items-start justify-between gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Indexing Failed</p>
              <p className="font-mono text-xs opacity-90">{repository.indexError}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetIndexRepository.mutate()}
            className="text-xs shrink-0"
          >
            Clear Error
          </Button>
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

        {/* How Indexing Works — expandable section */}
        <div className="mt-4 pt-3 border-t border-border">
          <button
            onClick={() => setShowHowItWorks((prev) => !prev)}
            className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <Info className="h-3 w-3" />
            <span>How Indexing Works</span>
            {showHowItWorks ? (
              <ChevronDown className="h-3 w-3 ml-auto" />
            ) : (
              <ChevronRight className="h-3 w-3 ml-auto" />
            )}
          </button>

          {showHowItWorks && (
            <div className="mt-3 flex flex-col gap-3 text-[11px] text-muted-foreground">
              {/* Pipeline stages */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5 rounded-md border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center gap-1.5 font-mono font-medium text-foreground">
                    <TreePine className="h-3 w-3 text-primary" />
                    1. Parse (Tree-sitter)
                  </div>
                  <p className="leading-relaxed">
                    Each source file is parsed using Tree-sitter to build an AST (Abstract Syntax Tree).
                    Tree-sitter provides <strong className="text-foreground">syntax-level</strong> parsing — functions, classes, imports, exports.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 rounded-md border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center gap-1.5 font-mono font-medium text-foreground">
                    <Workflow className="h-3 w-3 text-primary" />
                    2. Extract Symbols
                  </div>
                  <p className="leading-relaxed">
                    From each AST, we extract <strong className="text-foreground">symbols</strong> (functions, classes, variables)
                    and <strong className="text-foreground">edges</strong> (calls, imports, exports) — the building blocks of the knowledge graph.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 rounded-md border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center gap-1.5 font-mono font-medium text-foreground">
                    <Waypoints className="h-3 w-3 text-primary" />
                    3. Build Graph (Neo4j)
                  </div>
                  <p className="leading-relaxed">
                    Symbols and edges are stored in <strong className="text-foreground">Neo4j</strong> as a persistent code knowledge graph.
                    During PR review, this graph powers blast-radius analysis — callers, callees, affected endpoints.
                  </p>
                </div>
              </div>

              {/* Incremental indexing note */}
              <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3">
                <Hash className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-mono font-medium text-foreground">Incremental Indexing (SHA256)</p>
                  <p className="leading-relaxed mt-1">
                    Every file&apos;s content is hashed (SHA256). On subsequent pushes to the default branch,
                    only files where <code className="text-foreground bg-muted px-1 rounded">hash_old ≠ hash_new</code> are re-parsed.
                    Unchanged files are skipped entirely. Deleted files have their subgraph removed.
                  </p>
                </div>
              </div>

              {/* Clarification */}
              <p className="text-[10px] text-muted-foreground/60 italic">
                Note: Tree-sitter provides syntax/AST parsing only. Call-graph resolution and semantic analysis
                are separate steps built on top of the parsed AST data.
              </p>
            </div>
          )}
        </div>

        {repository.indexedAt && (
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Last indexed: {new Date(repository.indexedAt).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Review Activity */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            Review activity
          </h2>
        </div>

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
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {jobs.map((job) => {
              const inFlight = job.status !== 'COMPLETED' && job.status !== 'FAILED';

              return (
                <div
                  key={job.id}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-accent/40"
                >
                  <Link
                    href={`/review-jobs/${job.id}`}
                    className="flex flex-1 flex-col gap-0.5 overflow-hidden"
                  >
                    <span className="text-sm font-medium hover:underline truncate">
                      #{job.pullRequest?.githubPrNumber} {job.pullRequest?.title}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      @{job.pullRequest?.authorLogin} &bull; {new Date(job.createdAt).toLocaleDateString()}
                    </span>
                    {job.error && (
                      <span className="text-xs text-destructive truncate max-w-md font-mono mt-0.5">
                        Error: {job.error}
                      </span>
                    )}
                  </Link>

                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={job.status} />

                    {/* Job Actions: Retry, Cancel, Delete */}
                    <div className="flex items-center gap-1 border-l border-border pl-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault();
                          retryJob.mutate(job.id);
                        }}
                        disabled={retryJob.isPending}
                        title="Re-run Review"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                      >
                        <RotateCw className={`h-3.5 w-3.5 ${retryJob.isPending ? 'animate-spin' : ''}`} />
                      </Button>

                      {inFlight && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.preventDefault();
                            cancelJob.mutate(job.id);
                          }}
                          disabled={cancelJob.isPending}
                          title="Cancel / Stop Review"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault();
                          deleteJob.mutate(job.id);
                        }}
                        disabled={deleteJob.isPending}
                        title="Delete Review Record"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
