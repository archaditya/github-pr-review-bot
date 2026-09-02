'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Github, Key, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function LoginPage() {
  const router = useRouter();
  const [appKey, setAppKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-login if valid key already present in localStorage
  useEffect(() => {
    const existingKey = localStorage.getItem('prbot_app_key');
    if (existingKey) {
      apiClient
        .get('/auth/me', { headers: { 'X-App-Key': existingKey } })
        .then(() => router.replace('/'))
        .catch(() => {});
    }
  }, [router]);

  const handleKeyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appKey.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const cleanKey = appKey.trim();
      const res = await apiClient.get('/auth/me', {
        headers: { 'X-App-Key': cleanKey },
      });

      if (res.data?.data) {
        localStorage.setItem('prbot_app_key', cleanKey);
        router.replace('/');
      } else {
        setError('Invalid App Key. Please check the key and try again.');
      }
    } catch {
      setError('Failed to authenticate with this App Key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 bg-background">
      <div className="flex flex-col items-center gap-2 text-center max-w-md">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          archadi-pr-review
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sign in to your Dashboard
        </h1>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Access your indexed repositories, code knowledge graph, and PR reviews.
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4">
        {/* GitHub OAuth Login */}
        <Button size="lg" className="w-full flex items-center justify-center gap-2" asChild>
          <a href={`${API_URL}/auth/github/login`}>
            <Github className="h-4 w-4" />
            Continue with GitHub
          </a>
        </Button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-border/60" />
          <span className="text-[11px] font-mono text-muted-foreground uppercase">
            or use app key
          </span>
          <div className="flex-1 h-px bg-border/60" />
        </div>

        {/* Office / Remote Machine App Key Login */}
        <form onSubmit={handleKeyLogin} className="flex flex-col gap-3">
          <div className="relative">
            <input
              type="password"
              placeholder="Paste App Key (prbot_...)"
              value={appKey}
              onChange={(e) => setAppKey(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border/60 bg-secondary/20 text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-lg">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="outline"
            disabled={!appKey.trim() || loading}
            className="w-full flex items-center justify-center gap-2 text-xs font-mono"
          >
            {loading ? (
              'Verifying Key...'
            ) : (
              <>
                <Key className="h-3.5 w-3.5 text-primary" />
                Access with App Key
                <ArrowRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
              </>
            )}
          </Button>

          <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1 mt-1">
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            Perfect for office PCs — no personal GitHub login needed.
          </p>
        </form>
      </div>
    </main>
  );
}
