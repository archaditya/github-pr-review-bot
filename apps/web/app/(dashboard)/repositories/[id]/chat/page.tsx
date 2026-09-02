'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, MessageSquareCode, Sparkles } from 'lucide-react';
import { useRepository } from '@/hooks/use-repository';
import { ChatPanel } from '@/components/chat/chat-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';

export default function RepositoryChatPage() {
  const params = useParams<{ id: string }>();
  const { data: repository, isLoading } = useRepository(params.id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-[600px] w-full rounded-2xl" />
      </div>
    );
  }

  if (!repository) {
    return (
      <EmptyState
        title="Repository not found"
        description="Could not load repository information for chat."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Top Navigation & Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/repositories/${repository.id}`}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Back to Repository"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <MessageSquareCode className="h-5 w-5 text-violet-400" />
              <h1 className="font-mono text-lg font-semibold tracking-tight">
                {repository.fullName}
              </h1>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                Chat Mode
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Natural language Q&A grounded in the AST Code Knowledge Graph
            </p>
          </div>
        </div>

        <Link
          href={`/repositories/${repository.id}`}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
        >
          View Repo Dashboard
        </Link>
      </div>

      {/* Main Chat Interface */}
      <ChatPanel repositoryId={repository.id} repositoryName={repository.fullName} />
    </div>
  );
}
