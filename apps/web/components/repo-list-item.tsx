import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
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
        <span className="font-mono text-sm">{repository.fullName}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
