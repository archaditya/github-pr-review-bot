'use client';

import { useState, useEffect } from 'react';
import { Key, Copy, Check, Plus, Trash2, Ban, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useApiKeys, useCreateApiKey, useRevokeApiKey, useDeleteApiKey } from '@/hooks/use-api-keys';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';

export default function SettingsPage() {
  const { data: apiKeys, isLoading } = useApiKeys();
  const createApiKey = useCreateApiKey();
  const revokeApiKey = useRevokeApiKey();
  const deleteApiKey = useDeleteApiKey();

  const [newKeyName, setNewKeyName] = useState('');
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeBrowserKey, setActiveBrowserKey] = useState<string>('');
  const [browserKeyInput, setBrowserKeyInput] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('prbot_app_key') || '';
      setActiveBrowserKey(stored);
      setBrowserKeyInput(stored);
    }
  }, []);

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    const result = await createApiKey.mutateAsync(newKeyName.trim());
    if (result.rawKey) {
      setCreatedRawKey(result.rawKey);
    }
    setNewKeyName('');
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleSaveBrowserKey(e: React.FormEvent) {
    e.preventDefault();
    const clean = browserKeyInput.trim();
    if (typeof window !== 'undefined') {
      if (clean) {
        localStorage.setItem('prbot_app_key', clean);
      } else {
        localStorage.removeItem('prbot_app_key');
      }
      setActiveBrowserKey(clean);
      window.dispatchEvent(new StorageEvent('storage', { key: 'prbot_app_key', newValue: clean }));
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">App Keys & Access Control</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage application keys for personal authentication and private API access.
        </p>
      </div>

      {/* Browser Active Key Configuration Card */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-semibold">
            Active Browser Authentication Key
          </h2>
        </div>

        <p className="text-xs text-muted-foreground">
          This dashboard sends the <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[11px]">X-App-Key</code> header with every request and establishes the real-time WebSocket connection.
        </p>

        <form onSubmit={handleSaveBrowserKey} className="flex flex-col sm:flex-row items-center gap-2.5">
          <input
            type="password"
            placeholder="prbot_..."
            value={browserKeyInput}
            onChange={(e) => setBrowserKeyInput(e.target.value)}
            className="w-full flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button type="submit" size="sm" className="whitespace-nowrap">
            {activeBrowserKey ? 'Update Browser Key' : 'Set Browser Key'}
          </Button>
        </form>

        {activeBrowserKey ? (
          <div className="flex items-center gap-2 text-xs text-diff-add font-mono">
            <Check className="h-3.5 w-3.5" />
            <span>Active key configured ({activeBrowserKey.substring(0, 10)}...)</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
            <span>No active browser key configured.</span>
          </div>
        )}
      </div>

      {/* Created Key Banner */}
      {createdRawKey && (
        <div className="rounded-lg border border-diff-add/50 bg-diff-add/10 p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-diff-add font-semibold text-sm">
            <Check className="h-4 w-4" />
            <span>New App Key Created Successfully</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Copy this key now. It will <strong className="text-foreground">never be shown again</strong>.
          </p>

          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-background/80 p-2.5 font-mono text-xs text-foreground break-all border border-border">
              {createdRawKey}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopy(createdRawKey)}
              className="flex items-center gap-1.5"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-diff-add" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                localStorage.setItem('prbot_app_key', createdRawKey);
                setActiveBrowserKey(createdRawKey);
                setBrowserKeyInput(createdRawKey);
                window.dispatchEvent(new StorageEvent('storage', { key: 'prbot_app_key', newValue: createdRawKey }));
              }}
              className="text-xs"
            >
              Use this key in this browser session
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCreatedRawKey(null)}
              className="text-xs text-muted-foreground"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Generate New Key Card */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Plus className="h-4 w-4 text-primary" />
          <h2 className="font-mono text-xs uppercase tracking-widest text-foreground font-semibold">
            Generate New Key
          </h2>
        </div>

        <form onSubmit={handleCreateKey} className="flex flex-col sm:flex-row items-center gap-2.5">
          <input
            type="text"
            placeholder="Label (e.g. Production VPS, CLI, Laptop)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="w-full flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            required
          />
          <Button type="submit" size="sm" disabled={createApiKey.isPending} className="whitespace-nowrap">
            {createApiKey.isPending ? 'Generating...' : 'Generate Key'}
          </Button>
        </form>
      </div>

      {/* API Keys List */}
      <div className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Existing Keys
        </h2>

        {isLoading && (
          <div className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        )}

        {apiKeys && apiKeys.length === 0 && (
          <EmptyState
            title="No API keys generated"
            description="Create an app key above to authorize your personal access."
          />
        )}

        {apiKeys && apiKeys.length > 0 && (
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 transition-colors"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Key className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold">{key.name}</span>
                    <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {key.keyPrefix}...
                    </span>
                    {key.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-diff-add/10 px-2 py-0.5 font-mono text-[10px] text-diff-add">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 font-mono text-[10px] text-destructive">
                        Revoked
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                    <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                    <span>&bull;</span>
                    <span>Last used: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {key.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => revokeApiKey.mutate(key.id)}
                      disabled={revokeApiKey.isPending}
                      className="text-xs flex items-center gap-1 text-muted-foreground hover:text-destructive"
                    >
                      <Ban className="h-3 w-3" />
                      Revoke
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteApiKey.mutate(key.id)}
                    disabled={deleteApiKey.isPending}
                    className="text-xs text-muted-foreground hover:text-destructive"
                    title="Delete Key"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
