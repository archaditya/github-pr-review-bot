'use client';

import { useState } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  ImageIcon,
  PenSquare,
  Twitter,
  Linkedin,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SocialPostPreview } from '@/components/social-post-preview';
import {
  useGenerateStandaloneDrafts,
  useUpdateSocialDraft,
  usePublishAllPosts,
  useRecentSocialPosts,
} from '@/hooks/use-social-posts';

const REPO_OPTIONS = [
  { value: '', label: 'General / No specific project' },
  { value: 'bytevault', label: 'ByteVault — File Management' },
  { value: 'bytevault-fe', label: 'ByteVault Frontend' },
  { value: 'verkin', label: 'Verkin — Social Media' },
  { value: 'course-bot', label: 'Course Bot — AI Education' },
  { value: 'github-pr-review-bot', label: 'PR Review Bot — DevTools' },
  { value: 'vps-infra-configs', label: 'Infrastructure' },
];

export default function CreatePostPage() {
  const [input, setInput] = useState('');
  const [repoContext, setRepoContext] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const generateDrafts = useGenerateStandaloneDrafts();
  const updateDraft = useUpdateSocialDraft();
  const publishAll = usePublishAllPosts();
  const { data: recentPosts } = useRecentSocialPosts(10);

  const generatedPosts = generateDrafts.data;
  const hasDrafts = generatedPosts && generatedPosts.length > 0;
  const draftPosts = generatedPosts?.filter((p) => p.status === 'draft') || [];

  function handleGenerate() {
    if (!input.trim()) return;
    generateDrafts.mutate({
      input: input.trim(),
      repoContext: repoContext || undefined,
      imageUrl: imageUrl || undefined,
    });
  }

  function handlePublishBoth() {
    const ids = draftPosts.map((p) => p.id);
    if (ids.length > 0) {
      publishAll.mutate({ postIds: ids });
    }
  }

  function handleReset() {
    setInput('');
    setRepoContext('');
    setImageUrl('');
    generateDrafts.reset();
  }

  return (
    <div className="flex flex-col gap-8 max-w-5xl pb-16">
      {/* Header */}
      <div className="flex flex-col gap-1.5 border-b border-border pb-6">
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <PenSquare className="h-5 w-5 text-primary" />
          Create Social Post
        </h1>
        <p className="text-sm text-muted-foreground font-mono">
          Share your ideas, progress, or updates on X and LinkedIn
        </p>
      </div>

      {/* Input Section */}
      <Card className="bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">What do you want to post about?</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Idea input */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Share your idea, thought, feature update, or anything you want to post about..."
            rows={4}
            className="w-full rounded-lg border border-border bg-background p-4 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
          />

          {/* Project context */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                Project Context
              </label>
              <select
                value={repoContext}
                onChange={(e) => setRepoContext(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {REPO_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Image URL */}
            <div className="flex-1">
              <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                Image URL (optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://... or leave empty for AI-generated"
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
                />
                {imageUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setImageUrl('')}
                    className="shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Image preview */}
          {imageUrl && (
            <div className="rounded-lg overflow-hidden border border-border/40 max-h-48">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Post image preview"
                className="w-full h-48 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleGenerate}
              disabled={!input.trim() || generateDrafts.isPending}
              className="flex items-center gap-1.5 font-mono text-xs"
            >
              {generateDrafts.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {generateDrafts.isPending
                ? 'Generating...'
                : hasDrafts
                  ? 'Regenerate Drafts'
                  : 'Generate Posts'}
            </Button>

            {hasDrafts && (
              <>
                <Button
                  onClick={handlePublishBoth}
                  disabled={publishAll.isPending || draftPosts.length === 0}
                  className="flex items-center gap-1.5 font-mono text-xs bg-gradient-to-r from-primary/90 to-[#0A66C2] hover:opacity-90"
                >
                  {publishAll.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {publishAll.isPending ? 'Publishing...' : 'Publish Both'}
                </Button>

                <Button variant="ghost" size="sm" onClick={handleReset} className="font-mono text-xs">
                  Start Over
                </Button>
              </>
            )}
          </div>

          {/* Generation error */}
          {generateDrafts.isError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive font-mono">
              Failed to generate: {generateDrafts.error?.message || 'Unknown error'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generated drafts */}
      {hasDrafts && (
        <div className="flex flex-col gap-4">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            Generated Drafts
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {generatedPosts.map((post) => (
              <SocialPostPreview
                key={post.id}
                post={post}
                onUpdateText={(editedText) => updateDraft.mutate({ id: post.id, editedText })}
                onUpdateImage={(newImageUrl) => updateDraft.mutate({ id: post.id, imageUrl: newImageUrl })}
                isUpdating={updateDraft.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Publish results */}
      {publishAll.isSuccess && (
        <div className="rounded-lg border border-diff-add/30 bg-diff-add/5 p-3 text-xs font-mono text-diff-add text-center">
          ✅ Posts published successfully!
        </div>
      )}

      {/* Recent Posts History */}
      {recentPosts && recentPosts.length > 0 && (
        <div className="flex flex-col gap-4 border-t border-border pt-8">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            Recent Posts
          </h2>
          <div className="flex flex-col gap-2">
            {recentPosts.map((post) => (
              <div
                key={post.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-3 text-xs font-mono"
              >
                <div className="flex items-center gap-3">
                  {post.platform === 'x' ? (
                    <Twitter className="h-3.5 w-3.5 text-foreground" />
                  ) : (
                    <Linkedin className="h-3.5 w-3.5 text-[#0A66C2]" />
                  )}
                  <span className="text-foreground truncate max-w-md">
                    {(post.editedText || post.draftText).slice(0, 80)}
                    {(post.editedText || post.draftText).length > 80 ? '...' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] ${
                      post.status === 'published'
                        ? 'bg-diff-add/10 text-diff-add border border-diff-add/20'
                        : post.status === 'failed'
                          ? 'bg-destructive/10 text-destructive border border-destructive/20'
                          : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                    }`}
                  >
                    {post.status}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
