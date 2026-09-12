'use client';

import { Loader2, Sparkles, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SocialPostPreview } from '@/components/social-post-preview';
import {
  useSocialPostsForPR,
  useGenerateSocialDrafts,
  useUpdateSocialDraft,
  usePublishAllPosts,
} from '@/hooks/use-social-posts';

interface SocialPostPanelProps {
  pullRequestId: string;
}

export function SocialPostPanel({ pullRequestId }: SocialPostPanelProps) {
  const { data: posts, isLoading } = useSocialPostsForPR(pullRequestId);
  const generateDrafts = useGenerateSocialDrafts();
  const updateDraft = useUpdateSocialDraft();
  const publishAll = usePublishAllPosts();

  const hasDrafts = posts && posts.length > 0;
  const draftPosts = posts?.filter((p) => p.status === 'draft') || [];
  const allPublished = hasDrafts && posts.every((p) => p.status === 'published');
  const canPublish = draftPosts.length > 0;

  function handleGenerate() {
    generateDrafts.mutate({ pullRequestId });
  }

  function handlePublishBoth() {
    const ids = draftPosts.map((p) => p.id);
    if (ids.length > 0) {
      publishAll.mutate({ postIds: ids });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-semibold">
          Social Posts
        </h2>
        <div className="flex items-center gap-2">
          {!hasDrafts && (
            <Button
              onClick={handleGenerate}
              disabled={generateDrafts.isPending}
              className="flex items-center gap-1.5 font-mono text-xs"
              size="sm"
            >
              {generateDrafts.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {generateDrafts.isPending ? 'Generating...' : 'Generate Drafts'}
            </Button>
          )}

          {hasDrafts && (
            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={generateDrafts.isPending}
              className="flex items-center gap-1.5 font-mono text-xs"
              size="sm"
            >
              {generateDrafts.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Regenerate
            </Button>
          )}

          {canPublish && (
            <Button
              onClick={handlePublishBoth}
              disabled={publishAll.isPending}
              className="flex items-center gap-1.5 font-mono text-xs bg-gradient-to-r from-primary to-[#0A66C2] hover:opacity-90"
              size="sm"
            >
              {publishAll.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {publishAll.isPending ? 'Publishing...' : 'Publish Both'}
            </Button>
          )}
        </div>
      </div>

      {/* Generation error */}
      {generateDrafts.isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive font-mono">
          Failed to generate drafts: {generateDrafts.error?.message || 'Unknown error'}
        </div>
      )}

      {/* Post cards */}
      {hasDrafts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {posts.map((post) => (
            <SocialPostPreview
              key={post.id}
              post={post}
              onUpdateText={(editedText) => updateDraft.mutate({ id: post.id, editedText })}
              onUpdateImage={(imageUrl) => updateDraft.mutate({ id: post.id, imageUrl })}
              isUpdating={updateDraft.isPending}
            />
          ))}
        </div>
      )}

      {/* Publish results */}
      {publishAll.isSuccess && (
        <div className="rounded-lg border border-diff-add/30 bg-diff-add/5 p-3 text-xs font-mono text-diff-add">
          ✅ Posts published successfully!
        </div>
      )}

      {publishAll.isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive font-mono">
          Publishing failed: {publishAll.error?.message || 'Unknown error'}
        </div>
      )}

      {/* All published state */}
      {allPublished && (
        <div className="rounded-lg border border-diff-add/30 bg-diff-add/5 p-3 text-xs font-mono text-diff-add text-center">
          All posts for this PR have been published ✨
        </div>
      )}
    </div>
  );
}
