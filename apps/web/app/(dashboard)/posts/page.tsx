'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Share2,
  PenSquare,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Send,
  Save,
  ImageIcon,
  Filter,
} from 'lucide-react';
import {
  useRecentSocialPosts,
  useUpdateSocialDraft,
  usePublishSinglePost,
} from '@/hooks/use-social-posts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import type { SocialPost } from '@/types/api';

const PLATFORM_META: Record<string, { label: string; color: string; badge: string }> = {
  x: { label: 'X (Twitter)', color: 'text-foreground border-border', badge: 'bg-zinc-800 text-zinc-200' },
  linkedin: { label: 'LinkedIn', color: 'text-blue-400 border-blue-500/30', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  instagram: { label: 'Instagram', color: 'text-pink-400 border-pink-500/30', badge: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
  facebook: { label: 'Facebook', color: 'text-blue-500 border-blue-600/30', badge: 'bg-blue-600/10 text-blue-400 border-blue-600/20' },
};

export default function PostsManagementPage() {
  const { data: posts, isLoading, refetch } = useRecentSocialPosts(100);
  const updateDraft = useUpdateSocialDraft();
  const publishSingle = usePublishSinglePost();

  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingTexts, setEditingTexts] = useState<Record<string, string>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  function getEffectiveText(post: SocialPost): string {
    if (editingTexts[post.id] !== undefined) {
      return editingTexts[post.id];
    }
    return post.editedText || post.draftText || '';
  }

  function handleTextChange(id: string, text: string) {
    setEditingTexts((prev) => ({ ...prev, [id]: text }));
  }

  async function handleSaveDraft(post: SocialPost) {
    const text = getEffectiveText(post);
    await updateDraft.mutateAsync({
      id: post.id,
      editedText: text,
    });
    alert('Draft updated successfully!');
  }

  async function handlePublish(post: SocialPost) {
    const text = getEffectiveText(post);
    if (text !== (post.editedText || post.draftText)) {
      await updateDraft.mutateAsync({ id: post.id, editedText: text });
    }
    await publishSingle.mutateAsync(post.id);
  }

  const filteredPosts = (posts || []).filter((p) => {
    if (platformFilter !== 'all' && p.platform !== platformFilter) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-tight">Social Post Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            View, edit, and publish drafts across LinkedIn, Instagram, Facebook, and X.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Link href="/create-post">
            <Button size="sm" className="gap-1.5">
              <PenSquare className="h-3.5 w-3.5" />
              Create New Post
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
        {/* Platform Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-mono">
          <span className="text-muted-foreground mr-1 text-[11px] uppercase tracking-wider flex items-center gap-1">
            <Filter className="h-3 w-3" />
            Platform:
          </span>
          {['all', 'linkedin', 'instagram', 'facebook', 'x'].map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={`rounded px-2.5 py-1 uppercase transition-colors ${
                platformFilter === p
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="text-muted-foreground mr-1 text-[11px] uppercase tracking-wider">Status:</span>
          {['all', 'draft', 'published', 'failed'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded px-2.5 py-1 uppercase transition-colors ${
                statusFilter === s
                  ? 'bg-accent font-semibold text-foreground border border-border'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Posts List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12">
          <EmptyState
            icon={Share2}
            title="No posts found"
            description="No social posts match your current filter settings. Click Create New Post to draft an announcement."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPosts.map((post) => {
            const currentText = getEffectiveText(post);
            const meta = PLATFORM_META[post.platform] || { label: post.platform, badge: 'bg-muted' };
            const isX = post.platform === 'x';
            const charCount = currentText.length;
            const isOverLimit = isX && charCount > 280;

            return (
              <div
                key={post.id}
                className="flex flex-col rounded-lg border border-border bg-card p-5 space-y-4 hover:border-border/80 transition-colors"
              >
                {/* Post Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 font-mono text-xs font-semibold uppercase border ${meta.badge}`}>
                      {meta.label}
                    </span>
                    {post.pullRequestId && (
                      <span className="text-[11px] font-mono text-muted-foreground">
                        PR Linked
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div>
                    {post.status === 'published' && (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-mono text-xs font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Published
                      </span>
                    )}
                    {post.status === 'draft' && (
                      <span className="inline-flex items-center gap-1 text-amber-400 font-mono text-xs font-medium">
                        <Clock className="h-3.5 w-3.5" />
                        Draft
                      </span>
                    )}
                    {post.status === 'failed' && (
                      <span className="inline-flex items-center gap-1 text-red-400 font-mono text-xs font-medium">
                        <XCircle className="h-3.5 w-3.5" />
                        Failed
                      </span>
                    )}
                  </div>
                </div>

                {/* Error Banner if Failed */}
                {post.status === 'failed' && post.error && (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400 font-mono">
                    {post.error}
                  </div>
                )}

                {/* Draft Text Input */}
                <div className="flex-1 space-y-1">
                  <textarea
                    rows={6}
                    value={currentText}
                    onChange={(e) => handleTextChange(post.id, e.target.value)}
                    disabled={post.status === 'published'}
                    className={`w-full rounded-md border border-border bg-background p-3 text-xs leading-relaxed placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none font-sans ${
                      isOverLimit ? 'border-red-500 text-red-400' : ''
                    }`}
                  />
                  <div className="flex justify-between items-center text-[11px] font-mono text-muted-foreground px-1">
                    <span>
                      {isX ? (
                        <span className={isOverLimit ? 'text-red-400 font-semibold' : ''}>
                          {charCount} / 280 chars
                        </span>
                      ) : (
                        <span>{charCount} chars</span>
                      )}
                    </span>
                    {post.createdAt && (
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                {/* Image Preview Thumbnail */}
                {post.imageUrl && (
                  <div className="flex items-center gap-3 rounded-md border border-border bg-background/50 p-2">
                    <img
                      src={post.imageUrl}
                      alt="Banner diagram"
                      className="h-12 w-12 rounded object-cover cursor-pointer border border-border hover:opacity-80"
                      onClick={() => setPreviewImage(post.imageUrl)}
                    />
                    <div className="text-xs">
                      <p className="font-medium">Technical Diagram Attached</p>
                      <button
                        type="button"
                        onClick={() => setPreviewImage(post.imageUrl)}
                        className="text-primary text-[11px] hover:underline"
                      >
                        Click to view full image
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between border-t border-border pt-3">
                  {post.status === 'published' && post.postUrl ? (
                    <a
                      href={post.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-mono"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View Live Post
                    </a>
                  ) : (
                    <div />
                  )}

                  {post.status !== 'published' && (
                    <div className="flex items-center gap-2 ml-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleSaveDraft(post)}
                        disabled={updateDraft.isPending}
                      >
                        <Save className="h-3 w-3" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handlePublish(post)}
                        disabled={isOverLimit || publishSingle.isPending}
                      >
                        <Send className="h-3 w-3" />
                        {post.status === 'failed' ? 'Retry' : 'Publish'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-lg border border-border bg-card p-2">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute right-3 top-3 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/90"
            >
              ✕
            </button>
            <img
              src={previewImage}
              alt="Diagram Preview"
              className="max-h-[85vh] w-auto rounded object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
