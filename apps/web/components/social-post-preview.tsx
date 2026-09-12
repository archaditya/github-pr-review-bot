'use client';

import { useState } from 'react';
import { CheckCircle2, AlertCircle, Twitter, Linkedin, ImageIcon, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { SocialPost } from '@/types/api';

interface SocialPostPreviewProps {
  post: SocialPost;
  onUpdateText: (editedText: string) => void;
  onUpdateImage: (imageUrl: string | null) => void;
  isUpdating?: boolean;
}

const PLATFORM_CONFIG = {
  x: {
    label: 'X (Twitter)',
    Icon: Twitter,
    charLimit: 280,
    color: 'text-foreground',
    bgColor: 'bg-foreground/5',
    borderColor: 'border-foreground/20',
  },
  linkedin: {
    label: 'LinkedIn',
    Icon: Linkedin,
    charLimit: 3000,
    color: 'text-[#0A66C2]',
    bgColor: 'bg-[#0A66C2]/5',
    borderColor: 'border-[#0A66C2]/20',
  },
} as const;

const STATUS_CONFIG = {
  draft: { label: 'Draft', variant: 'outline' as const, className: 'border-yellow-500/30 text-yellow-500' },
  approved: { label: 'Approved', variant: 'outline' as const, className: 'border-blue-500/30 text-blue-500' },
  published: { label: 'Published', variant: 'outline' as const, className: 'border-diff-add/30 text-diff-add' },
  failed: { label: 'Failed', variant: 'outline' as const, className: 'border-destructive/30 text-destructive' },
} as const;

export function SocialPostPreview({ post, onUpdateText, onUpdateImage, isUpdating }: SocialPostPreviewProps) {
  const platform = PLATFORM_CONFIG[post.platform];
  const statusCfg = STATUS_CONFIG[post.status];
  const currentText = post.editedText ?? post.draftText;
  const [localText, setLocalText] = useState(currentText);
  const [isEditing, setIsEditing] = useState(false);
  const charCount = localText.length;
  const isOverLimit = charCount > platform.charLimit;

  function handleSave() {
    if (localText !== currentText) {
      onUpdateText(localText);
    }
    setIsEditing(false);
  }

  return (
    <Card className={`${platform.bgColor} ${platform.borderColor} transition-all`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <platform.Icon className={`h-4 w-4 ${platform.color}`} />
            <CardTitle className={platform.color}>{platform.label}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusCfg.variant} className={`text-[10px] font-mono ${statusCfg.className}`}>
              {post.status === 'published' && <CheckCircle2 className="h-3 w-3 mr-1" />}
              {post.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
              {statusCfg.label}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Image preview */}
        {post.imageUrl && (
          <div className="relative group rounded-lg overflow-hidden border border-border/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.imageUrl}
              alt="Post image"
              className="w-full h-40 object-cover"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <input
                type="file"
                id={`file-replace-${post.id}`}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 8 * 1024 * 1024) {
                    alert('File size must be under 8MB');
                    return;
                  }
                  const reader = new FileReader();
                  reader.onloadend = () => onUpdateImage(reader.result as string);
                  reader.readAsDataURL(file);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="text-white border-white/40 hover:bg-white/20 text-xs font-mono"
                onClick={() => document.getElementById(`file-replace-${post.id}`)?.click()}
              >
                <ImageIcon className="h-3 w-3 mr-1" />
                Upload New
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="text-xs font-mono"
                onClick={() => onUpdateImage(null)}
              >
                Remove
              </Button>
            </div>
          </div>
        )}

        {!post.imageUrl && (
          <div>
            <input
              type="file"
              id={`file-add-${post.id}`}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 8 * 1024 * 1024) {
                  alert('File size must be under 8MB');
                  return;
                }
                const reader = new FileReader();
                reader.onloadend = () => onUpdateImage(reader.result as string);
                reader.readAsDataURL(file);
              }}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => document.getElementById(`file-add-${post.id}`)?.click()}
                className="flex-1 flex items-center justify-center gap-2 h-20 rounded-lg border border-dashed border-border/60 text-xs font-mono text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
              >
                <ImageIcon className="h-4 w-4" />
                Upload Image File
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = prompt('Or enter image URL:');
                  if (url) onUpdateImage(url);
                }}
                className="px-3 flex items-center justify-center rounded-lg border border-border/60 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                Paste URL
              </button>
            </div>
          </div>
        )}

        {/* Text editor */}
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={localText}
              onChange={(e) => setLocalText(e.target.value)}
              rows={post.platform === 'linkedin' ? 8 : 4}
              className="w-full rounded-md border border-border bg-background p-3 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex items-center justify-between">
              <span className={`text-xs font-mono ${isOverLimit ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                {charCount}/{platform.charLimit}
                {isOverLimit && ' ⚠ Over limit'}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setLocalText(currentText); setIsEditing(false); }}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isUpdating}>
                  {isUpdating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Save
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div
            onClick={() => post.status === 'draft' && setIsEditing(true)}
            className={`rounded-md border border-border/40 bg-background/60 p-3 text-sm whitespace-pre-wrap ${
              post.status === 'draft' ? 'cursor-text hover:border-primary/40' : ''
            }`}
          >
            {currentText}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
              <span className={`text-[10px] font-mono ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                {charCount} chars
              </span>
              {post.status === 'draft' && (
                <span className="text-[10px] font-mono text-muted-foreground">Click to edit</span>
              )}
            </div>
          </div>
        )}

        {/* Error message */}
        {post.error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="font-mono">{post.error}</span>
          </div>
        )}

        {/* Published reference */}
        {post.status === 'published' && post.externalPostId && (
          <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-diff-add" />
            Published: {post.externalPostId}
            {post.publishedAt && ` • ${new Date(post.publishedAt).toLocaleString()}`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
