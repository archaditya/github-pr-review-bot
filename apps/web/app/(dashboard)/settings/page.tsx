'use client';

import { useState, useEffect } from 'react';
import {
  Key,
  Copy,
  Check,
  Plus,
  Trash2,
  Ban,
  Share2,
  ExternalLink,
  HelpCircle,
} from 'lucide-react';
import { useApiKeys, useCreateApiKey, useRevokeApiKey, useDeleteApiKey } from '@/hooks/use-api-keys';
import {
  useSettings,
  useUpdatePreferences,
} from '@/hooks/use-settings';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';

type TabType = 'platforms' | 'appkeys';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('platforms');

  // User & Settings
  const { data: currentUser } = useCurrentUser();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const updatePreferences = useUpdatePreferences();

  // App Keys (Tab 2)
  const { data: apiKeys, isLoading: apiKeysLoading } = useApiKeys();
  const createApiKey = useCreateApiKey();
  const revokeApiKey = useRevokeApiKey();
  const deleteApiKey = useDeleteApiKey();

  // Platform Preferences State
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    'linkedin',
    'instagram',
    'facebook',
  ]);
  const [platformsInitialized, setPlatformsInitialized] = useState(false);

  // App Keys State
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

  useEffect(() => {
    if (settings && !platformsInitialized) {
      const allowed = settings.features?.allowed_social_platforms || ['linkedin', 'instagram', 'facebook'];
      setSelectedPlatforms(allowed);
      setPlatformsInitialized(true);
    }
  }, [settings, platformsInitialized]);

  // Handlers for Platform Preferences
  function togglePlatform(platform: string) {
    if (selectedPlatforms.includes(platform)) {
      if (selectedPlatforms.length === 1) {
        alert('You must have at least one social platform enabled.');
        return;
      }
      setSelectedPlatforms(selectedPlatforms.filter((p) => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  }

  async function handleSavePlatforms() {
    await updatePreferences.mutateAsync({
      allowedSocialPlatforms: selectedPlatforms,
    });
    alert('Platform preferences updated successfully!');
  }

  // Handlers for App Keys
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
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-mono text-2xl font-bold tracking-tight">Settings & Controls</h1>
        <p className="text-sm text-muted-foreground">
          Manage your social platform opt-ins, posting preferences, and app security keys.
        </p>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-border gap-2 pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab('platforms')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'platforms'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Share2 className="h-4 w-4" />
          <span>Platform Opt-in</span>
        </button>

        <button
          onClick={() => setActiveTab('appkeys')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'appkeys'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Key className="h-4 w-4" />
          <span>App Keys & Devices</span>
        </button>
      </div>

      {/* Tab 1: Platform Preferences */}
      {activeTab === 'platforms' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 space-y-6">
            <div>
              <h2 className="text-base font-semibold">Social Platform Opt-In</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose which channels the AI Studio generates drafts for. Opt out of specific platforms to streamline generation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* LinkedIn */}
              <div
                onClick={() => togglePlatform('linkedin')}
                className={`cursor-pointer rounded-lg border p-4 transition-all ${
                  selectedPlatforms.includes('linkedin')
                    ? 'border-blue-500 bg-blue-500/5'
                    : 'border-border bg-background opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-base font-bold text-blue-400">in</span>
                    <span className="text-sm font-semibold">LinkedIn</span>
                  </div>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                    ACTIVE
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Posts to your personal LinkedIn profile via official v2 UGC API.
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    readOnly
                    checked={selectedPlatforms.includes('linkedin')}
                    className="rounded border-border text-primary"
                  />
                  <span>{selectedPlatforms.includes('linkedin') ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>

              {/* Instagram */}
              <div
                onClick={() => togglePlatform('instagram')}
                className={`cursor-pointer rounded-lg border p-4 transition-all ${
                  selectedPlatforms.includes('instagram')
                    ? 'border-pink-500 bg-pink-500/5'
                    : 'border-border bg-background opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-base font-bold text-pink-400">ig</span>
                    <span className="text-sm font-semibold">Instagram</span>
                  </div>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                    ACTIVE
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Publishes photo container with engineering caption via Meta Graph API.
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    readOnly
                    checked={selectedPlatforms.includes('instagram')}
                    className="rounded border-border text-primary"
                  />
                  <span>{selectedPlatforms.includes('instagram') ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>

              {/* Facebook */}
              <div
                onClick={() => togglePlatform('facebook')}
                className={`cursor-pointer rounded-lg border p-4 transition-all ${
                  selectedPlatforms.includes('facebook')
                    ? 'border-indigo-500 bg-indigo-500/5'
                    : 'border-border bg-background opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-base font-bold text-indigo-400">fb</span>
                    <span className="text-sm font-semibold">Facebook Page</span>
                  </div>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                    ACTIVE
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Publishes feed update with media attachment directly to your connected Page.
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    readOnly
                    checked={selectedPlatforms.includes('facebook')}
                    className="rounded border-border text-primary"
                  />
                  <span>{selectedPlatforms.includes('facebook') ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>

              {/* X (Twitter) */}
              <div
                onClick={() => togglePlatform('x')}
                className={`cursor-pointer rounded-lg border p-4 transition-all ${
                  selectedPlatforms.includes('x')
                    ? 'border-neutral-500 bg-neutral-500/5'
                    : 'border-border bg-background opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-base font-bold text-foreground">𝕏</span>
                    <span className="text-sm font-semibold">X (Twitter)</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Posts tweets directly via X API v2.
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    readOnly
                    checked={selectedPlatforms.includes('x')}
                    className="rounded border-border text-primary"
                  />
                  <span>{selectedPlatforms.includes('x') ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button onClick={handleSavePlatforms} disabled={updatePreferences.isPending}>
                {updatePreferences.isPending ? 'Saving Preferences...' : 'Save Platform Preferences'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: App Keys & Devices */}
      {activeTab === 'appkeys' && (
        <div className="space-y-8">
          {/* Quick Browser Connect */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Active Browser Key</h2>
            <p className="text-xs text-muted-foreground mt-0.5 mb-4">
              Enter any valid App Key to authenticate this browser without logging into GitHub.
            </p>
            <form onSubmit={handleSaveBrowserKey} className="flex gap-2">
              <input
                type="text"
                value={browserKeyInput}
                onChange={(e) => setBrowserKeyInput(e.target.value)}
                placeholder="prbot_..."
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <Button type="submit">Save in Browser</Button>
            </form>
            {activeBrowserKey && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Active key configured: <span className="font-mono text-foreground">{activeBrowserKey.slice(0, 16)}...</span>
              </div>
            )}
          </div>

          {/* Create New Key */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Create New App Key</h2>
            <p className="text-xs text-muted-foreground mt-0.5 mb-4">
              Generate an API key for CLI, remote office setups, or headless automation.
            </p>
            <form onSubmit={handleCreateKey} className="flex gap-2">
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g. Office Laptop, CI Bot)"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <Button type="submit" disabled={!newKeyName.trim() || createApiKey.isPending}>
                <Plus className="mr-1.5 h-4 w-4" />
                {createApiKey.isPending ? 'Generating...' : 'Create Key'}
              </Button>
            </form>

            {createdRawKey && (
              <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-xs font-semibold text-emerald-400">
                  Key generated successfully! Copy it now — you won&apos;t be able to see it again:
                </p>
                <div className="mt-2 flex items-center justify-between rounded bg-background/80 px-3 py-2 font-mono text-sm">
                  <span className="text-foreground break-all">{createdRawKey}</span>
                  <button
                    onClick={() => handleCopy(createdRawKey)}
                    className="ml-3 shrink-0 rounded p-1 hover:bg-accent"
                    title="Copy to clipboard"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Keys List */}
          <div>
            <h2 className="mb-4 text-base font-semibold">Manage Existing Keys</h2>
            {apiKeysLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : !apiKeys || apiKeys.length === 0 ? (
              <EmptyState
                icon={Key}
                title="No App Keys yet"
                description="Create an App Key above to connect remote devices or automate actions."
              />
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border bg-card">
                {apiKeys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{key.name}</span>
                        {(key.isRevoked || !key.isActive) && (
                          <span className="rounded bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] text-red-500">
                            Revoked
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-xs text-muted-foreground mt-0.5">{key.keyPrefix}...</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {key.isActive && !key.isRevoked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeApiKey.mutate(key.id)}
                          title="Revoke key"
                        >
                          <Ban className="h-4 w-4 text-amber-500" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteApiKey.mutate(key.id)}
                        title="Delete key"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
