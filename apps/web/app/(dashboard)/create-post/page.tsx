'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  ImageIcon,
  PenSquare,
  Twitter,
  Linkedin,
  X,
  Upload,
  CheckCircle2,
  Circle,
  Layers,
  Bot,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SocialPostPreview } from '@/components/social-post-preview';
import type { SocialPost } from '@/types/api';
import {
  useGenerateStandaloneDrafts,
  useUpdateSocialDraft,
  usePublishAllPosts,
  usePublishSinglePost,
  useRecentSocialPosts,
} from '@/hooks/use-social-posts';

const REPO_OPTIONS = [
  { value: '', label: 'General / No specific project' },
  { value: 'github-pr-review-bot', label: 'PR Review Bot — DevTools' },
  { value: 'bytevault', label: 'ByteVault — File Management' },
  { value: 'bytevault-fe', label: 'ByteVault Frontend' },
  { value: 'verkin', label: 'Verkin — Social Media' },
  { value: 'course-bot', label: 'Course Bot — AI Education' },
  { value: 'vps-infra-configs', label: 'Infrastructure' },
];

const PIPELINE_STEPS = [
  {
    label: 'Analyzing Project Context',
    detail: 'Loading repository voice, developer intent, and target platforms...',
    icon: Layers,
  },
  {
    label: 'Extracting Feature Highlights',
    detail: 'Synthesizing technical scope, architecture decisions, and value...',
    icon: Zap,
  },
  {
    label: 'Drafting X & LinkedIn Content',
    detail: 'Generating tailored 280-char hook for X and deep-dive story for LinkedIn...',
    icon: Bot,
  },
  {
    label: 'Finalizing Media & Tags',
    detail: 'Optimizing code formatting, developer hashtags, and visual preview...',
    icon: Sparkles,
  },
];

export default function CreatePostPage() {
  const [input, setInput] = useState('');
  const [repoContext, setRepoContext] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [pipelineStep, setPipelineStep] = useState(0);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateDrafts = useGenerateStandaloneDrafts();
  const updateDraft = useUpdateSocialDraft();
  const publishAll = usePublishAllPosts();
  const publishSingle = usePublishSinglePost();
  const { data: recentPosts } = useRecentSocialPosts(10);

  // Animate pipeline stepper during generation
  useEffect(() => {
    if (!generateDrafts.isPending) {
      setPipelineStep(0);
      return;
    }

    setPipelineStep(0);
    const t1 = setTimeout(() => setPipelineStep(1), 1800);
    const t2 = setTimeout(() => setPipelineStep(2), 4200);
    const t3 = setTimeout(() => setPipelineStep(3), 7500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [generateDrafts.isPending]);

  const hasDrafts = posts.length > 0;
  const draftPosts = posts.filter((p) => p.status === 'draft' || p.status === 'failed');

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('File size must be under 8MB');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveImage() {
    setImageUrl('');
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleGenerate() {
    if (!input.trim()) return;
    generateDrafts.mutate(
      {
        input: input.trim(),
        repoContext: repoContext || undefined,
        imageUrl: imageUrl || undefined,
      },
      {
        onSuccess: (data) => {
          setPosts(data);
        },
      }
    );
  }

  function handlePublishBoth() {
    const ids = draftPosts.map((p) => p.id);
    if (ids.length > 0) {
      publishAll.mutate(
        { postIds: ids },
        {
          onSuccess: (results) => {
            setPosts((prev) =>
              prev.map((p) => {
                const res = results.find((r) => r.id === p.id);
                if (res) {
                  return {
                    ...p,
                    status: res.status as any,
                    error: res.error || null,
                  };
                }
                return p;
              })
            );
          },
        }
      );
    }
  }

  function handlePublishSingle(id: string) {
    setPublishingId(id);
    publishSingle.mutate(id, {
      onSuccess: (results) => {
        setPosts((prev) =>
          prev.map((p) => {
            const res = results.find((r) => r.id === p.id);
            if (res) {
              return {
                ...p,
                status: res.status as any,
                error: res.error || null,
              };
            }
            return p;
          })
        );
        setPublishingId(null);
      },
      onError: () => {
        setPublishingId(null);
      },
    });
  }

  function handleReset() {
    setInput('');
    setRepoContext('');
    setImageUrl('');
    setFileName('');
    setPosts([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
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

          {/* Project context & Image */}
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

            {/* Image (Upload or URL) */}
            <div className="flex-1">
              <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                Image (Upload file or URL)
              </label>
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 font-mono text-xs flex items-center gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {fileName ? 'Change' : 'Upload'}
                </Button>
                <input
                  type="url"
                  value={fileName ? `[File: ${fileName}]` : imageUrl}
                  onChange={(e) => {
                    setFileName('');
                    setImageUrl(e.target.value);
                  }}
                  readOnly={!!fileName}
                  placeholder="Or paste https:// image URL..."
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
                />
                {imageUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveImage}
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
            <div className="relative rounded-lg overflow-hidden border border-border/40 max-h-56 bg-black/20 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Post image preview"
                className="max-h-56 w-auto object-contain rounded-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 text-xs font-mono h-7 px-2 bg-background/80 hover:bg-background"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Remove
              </Button>
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

          {/* AI Generation Pipeline Stepper */}
          {generateDrafts.isPending && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 mt-2 flex flex-col gap-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                  </div>
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                    AI Generation Pipeline Active
                  </span>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">
                  Step {pipelineStep + 1} of {PIPELINE_STEPS.length}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-border/60 h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary via-indigo-500 to-emerald-400 transition-all duration-700 ease-out"
                  style={{
                    width:
                      pipelineStep === 0
                        ? '25%'
                        : pipelineStep === 1
                          ? '55%'
                          : pipelineStep === 2
                            ? '80%'
                            : '95%',
                  }}
                />
              </div>

              {/* Steps List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {PIPELINE_STEPS.map((step, idx) => {
                  const isDone = pipelineStep > idx;
                  const isCurrent = pipelineStep === idx;
                  const Icon = step.icon;

                  return (
                    <div
                      key={step.label}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                        isCurrent
                          ? 'border-primary/40 bg-background shadow-sm ring-1 ring-primary/20'
                          : isDone
                            ? 'border-emerald-500/20 bg-emerald-500/5'
                            : 'border-border/30 bg-card/20 opacity-50'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : isCurrent ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span
                          className={`font-mono text-xs font-medium flex items-center gap-1.5 ${
                            isCurrent
                              ? 'text-foreground font-semibold'
                              : isDone
                                ? 'text-emerald-400'
                                : 'text-muted-foreground'
                          }`}
                        >
                          <Icon className="h-3 w-3 shrink-0" />
                          {step.label}
                        </span>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">
                          {step.detail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Terminal live status ticker */}
              <div className="rounded-md bg-black/40 border border-border/40 px-3 py-2 font-mono text-[11px] text-muted-foreground flex items-center justify-between">
                <span className="truncate">
                  <span className="text-primary font-bold mr-2">&gt;</span>
                  {pipelineStep === 0 && `Analyzing context for [${repoContext || 'General'}]...`}
                  {pipelineStep === 1 && 'Extracting engineering highlights & PR architectural changes...'}
                  {pipelineStep === 2 && 'Synthesizing 280-char X draft + LinkedIn multi-paragraph deep dive...'}
                  {pipelineStep === 3 && 'Attaching media asset & structuring final post format...'}
                </span>
                <span className="text-[10px] text-muted-foreground/60 shrink-0 ml-2 animate-pulse">
                  processing
                </span>
              </div>
            </div>
          )}

          {/* Publishing Pipeline Stepper */}
          {publishAll.isPending && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 mt-2 flex flex-col gap-3 animate-in fade-in duration-300">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Publishing to Social Networks
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                <div className="flex items-center gap-2 p-2.5 rounded-md border border-border/40 bg-background/50">
                  <Twitter className="h-3.5 w-3.5 text-foreground shrink-0" />
                  <span>Posting tweet to X API v2...</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-md border border-border/40 bg-background/50">
                  <Linkedin className="h-3.5 w-3.5 text-[#0A66C2] shrink-0" />
                  <span>Uploading asset & publishing to LinkedIn...</span>
                </div>
              </div>
            </div>
          )}

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
            {posts.map((post) => (
              <SocialPostPreview
                key={post.id}
                post={post}
                onUpdateText={(editedText) => {
                  setPosts((prev) =>
                    prev.map((p) => (p.id === post.id ? { ...p, editedText } : p))
                  );
                  updateDraft.mutate({ id: post.id, editedText });
                }}
                onUpdateImage={(newImageUrl) => {
                  setPosts((prev) =>
                    prev.map((p) => (p.id === post.id ? { ...p, imageUrl: newImageUrl } : p))
                  );
                  updateDraft.mutate({ id: post.id, imageUrl: newImageUrl });
                }}
                onPublish={() => handlePublishSingle(post.id)}
                isPublishing={publishingId === post.id}
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
