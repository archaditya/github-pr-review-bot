'use client';

import { useRepositories } from '@/hooks/use-repositories';
import { useSyncRepositories } from '@/hooks/use-sync-repositories';
import { RepoListItem } from '@/components/repo-list-item';
import { EmptyState } from '@/components/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export default function RepositoriesPage() {
  const { data: repositories, isLoading, isError } = useRepositories();
  const syncRepos = useSyncRepositories();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Repositories</h1>
          <p className="text-sm text-muted-foreground">
            Every repository archadi-bot has been installed on.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncRepos.mutate()}
          disabled={syncRepos.isPending}
          className="flex items-center gap-1.5 font-mono text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncRepos.isPending ? 'animate-spin' : ''}`} />
          {syncRepos.isPending ? 'Syncing...' : 'Sync Repositories'}
        </Button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}

      {isError && (
        <EmptyState
          title="Couldn't load repositories"
          description="Check that the API is reachable and that you're signed in."
        />
      )}

      {repositories && repositories.length === 0 && (
        <EmptyState
          title="No repositories yet"
          description="Install the GitHub App on your repositories and open a PR to start getting AI reviews."
          action={
            <Button asChild size="sm">
              <a
                href="https://github.com/apps/archadi-pr-review-bot/installations/new"
                target="_blank"
                rel="noreferrer"
              >
                Install GitHub App
              </a>
            </Button>
          }
        />
      )}

      {repositories && repositories.length > 0 && (
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {repositories.map((repo) => (
            <RepoListItem key={repo.id} repository={repo} />
          ))}
        </div>
      )}
    </div>
  );
}
