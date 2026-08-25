'use client';

import { useRepositories } from '@/hooks/use-repositories';
import { RepoListItem } from '@/components/repo-list-item';
import { EmptyState } from '@/components/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

export default function RepositoriesPage() {
  const { data: repositories, isLoading, isError } = useRepositories();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Repositories</h1>
        <p className="text-sm text-muted-foreground">
          Every repository archadi-bot has been installed on.
        </p>
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
