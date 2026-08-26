import Link from 'next/link';
import { ChevronRight, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IndexStatusBadge } from '@/components/status-badge';
import type { Repository } from '@/types/api';

export function RepoListItem({ repository }: { repository: Repository }) {
  return (
    <Link
      href={`/repositories/${repository.id}`}
      className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-accent"
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            repository.isActive ? 'bg-diff-add' : 'bg-muted-foreground',
          )}
        />
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-sm font-medium">{repository.fullName}</span>
          {repository.indexStatus === 'INDEXED' && (
            <span className="font-mono text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Database className="h-2.5 w-2.5" />
              {repository.fileCount} files &bull; {repository.symbolCount} symbols
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <IndexStatusBadge status={repository.indexStatus} />
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}
