'use client';

import { useState, useEffect } from 'react';
import {
  Key,
  Copy,
  Check,
  Plus,
  Trash2,
  Ban,
  ShieldCheck,
  AlertTriangle,
  Cpu,
  Share2,
  Sliders,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Sparkles,
  Info,
  DollarSign,
} from 'lucide-react';
import { useApiKeys, useCreateApiKey, useRevokeApiKey, useDeleteApiKey } from '@/hooks/use-api-keys';
import {
  useSettings,
  useSaveAiKey,
  useRemoveAiKey,
  useTestAiKey,
  useUpdatePreferences,
} from '@/hooks/use-settings';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';

type TabType = 'byok' | 'platforms' | 'entitlements' | 'appkeys';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('byok');

  // User & Settings
  const { data: currentUser } = useCurrentUser();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const saveAiKey = useSaveAiKey();
  const removeAiKey = useRemoveAiKey();
  const testAiKey = useTestAiKey();
  const updatePreferences = useUpdatePreferences();

  // App Keys (Tab 4)
  const { data: apiKeys, isLoading: apiKeysLoading } = useApiKeys();
  const createApiKey = useCreateApiKey();
  const revokeApiKey = useRevokeApiKey();
  const deleteApiKey = useDeleteApiKey();

  // BYOK State
  const [inputKey, setInputKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    tested: boolean;
    valid?: boolean;
    error?: string;
    modelCount?: number;
  } | null>(null);

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

  // Handlers for BYOK
  async function handleTestKey() {
    setTestStatus(null);
    try {
      const res = await testAiKey.mutateAsync(inputKey.trim() || undefined);
      setTestStatus({
        tested: true,
        valid: res.valid,
        error: res.error,
        modelCount: res.modelCount,
      });
    } catch (err: any) {
      setTestStatus({
        tested: true,
        valid: false,
        error: err?.response?.data?.error?.message || err.message,
      });
    }
  }

  async function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!inputKey.trim()) return;
    await saveAiKey.mutateAsync(inputKey.trim());
    setInputKey('');
    setTestStatus(null);
  }

  async function handleRemoveKey() {
    if (confirm('Are you sure you want to remove your configured OpenAI API key?')) {
      await removeAiKey.mutateAsync();
      setTestStatus(null);
    }
  }

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

  const isSuperAdmin = currentUser?.role === 'admin';
  const hasConfiguredKey = Boolean(settings?.hasOpenaiKey);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-mono text-2xl font-bold tracking-tight">Settings & Engine Control</h1>
        <p className="text-sm text-muted-foreground">
          Manage your Bring-Your-Own-Key (BYOK) OpenAI credentials, social platform opt-ins, quotas, and security keys.
        </p>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-border gap-2 pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab('byok')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'byok'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Cpu className="h-4 w-4" />
          <span>AI Engine (BYOK)</span>
          {hasConfiguredKey ? (
            <span className="h-2 w-2 rounded-full bg-emerald-500" title="Key Active" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-amber-500" title="No Key" />
          )}
        </button>

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
          onClick={() => setActiveTab('entitlements')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'entitlements'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>My Entitlements & Quotas</span>
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

      {/* Tab 1: AI Provider (BYOK) */}
      {activeTab === 'byok' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">OpenAI API Key (BYOK)</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your key is stored encrypted at rest using AES-256-GCM and never logged or exposed.
                </p>
              </div>
              <div>
                {hasConfiguredKey ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-xs font-medium text-emerald-500 border border-emerald-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Key Configured ({settings?.maskedOpenaiKey})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 font-mono text-xs font-medium text-amber-500 border border-amber-500/20">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    No BYOK Key Set
                  </span>
                )}
              </div>
            </div>

            {isSuperAdmin && (
              <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-4 flex gap-3 text-xs text-blue-400">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Super Admin Notice:</span> Your account has <strong>managed provider mode</strong> enabled. Even without setting a custom key here, the platform seamlessly uses your server environment OpenAI key.
                </div>
              </div>
            )}

            {!isSuperAdmin && !hasConfiguredKey && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3 text-xs text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Action Required:</span> External users operate strictly under Bring-Your-Own-Key (BYOK). Please paste your OpenAI API Key (<code className="bg-black/30 px-1 py-0.5 rounded">sk-...</code>) below to unlock code reviews, repo chats, and social post creation without server limits.
                </div>
              </div>
            )}

            {/* Key Input Form */}
            <form onSubmit={handleSaveKey} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  {hasConfiguredKey ? 'Replace Existing OpenAI API Key' : 'Enter OpenAI API Key'}
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="sk-proj-..."
                    className="w-full rounded-md border border-border bg-background px-3 py-2 pr-10 font-mono text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Real-time test results */}
              {testStatus && (
                <div
                  className={`rounded-md p-3 text-xs flex items-center justify-between border ${
                    testStatus.valid
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-red-500/30 bg-red-500/10 text-red-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testStatus.valid ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0" />
                    )}
                    <span>
                      {testStatus.valid
                        ? `Valid OpenAI Key! Connected successfully (${testStatus.modelCount} models available).`
                        : `Key verification failed: ${testStatus.error}`}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={!inputKey.trim() || saveAiKey.isPending}
                >
                  {saveAiKey.isPending ? 'Encrypting & Saving...' : 'Save & Encrypt Key'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={(!inputKey.trim() && !hasConfiguredKey) || testAiKey.isPending}
                  onClick={handleTestKey}
                >
                  {testAiKey.isPending ? 'Verifying with OpenAI...' : 'Test Key Validity'}
                </Button>

                {hasConfiguredKey && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-400 hover:bg-red-500/10 hover:text-red-300 ml-auto"
                    onClick={handleRemoveKey}
                    disabled={removeAiKey.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Remove Key
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 2: Platform Preferences */}
      {activeTab === 'platforms' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 space-y-6">
            <div>
              <h2 className="text-base font-semibold">Social Platform Opt-In</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose which channels the AI Studio generates drafts for. Opt out of costly platforms to save on API usage.
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
                    FREE
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Official LinkedIn Community Management API. Unlimited text & technical diagram posts.
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
                    <span className="font-mono text-base font-bold text-pink-400">IG</span>
                    <span className="text-sm font-semibold">Instagram Business</span>
                  </div>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                    FREE
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Meta Graph API. Requires high-res generated diagrams/photos and engineering captions.
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
                    ? 'border-blue-600 bg-blue-600/5'
                    : 'border-border bg-background opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-base font-bold text-blue-500">fb</span>
                    <span className="text-sm font-semibold">Facebook Page</span>
                  </div>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                    FREE
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Meta Graph API for developer & brand pages. High visibility with direct image hosting.
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
                    ? 'border-amber-500 bg-amber-500/5'
                    : 'border-border bg-background opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-base font-bold text-foreground">𝕏</span>
                    <span className="text-sm font-semibold">X (Twitter)</span>
                  </div>
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    PAID API TIER
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  X API Basic requires $100/mo or pay-per-use credits. Opt out if you prefer to publish only to the 3 free channels.
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    readOnly
                    checked={selectedPlatforms.includes('x')}
                    className="rounded border-border text-primary"
                  />
                  <span>{selectedPlatforms.includes('x') ? 'Enabled' : 'Disabled (Cost Saver)'}</span>
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

      {/* Tab 3: My Entitlements & Quotas */}
      {activeTab === 'entitlements' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 space-y-6">
            <div>
              <h2 className="text-base font-semibold">Account Tier & Feature Allocations</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Features allocated to your account by the system administrator.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-md border border-border bg-background p-4">
                <span className="text-xs text-muted-foreground uppercase font-mono">Role</span>
                <p className="text-lg font-bold font-mono text-primary mt-1 capitalize">
                  {currentUser?.role || 'User'}
                </p>
              </div>

              <div className="rounded-md border border-border bg-background p-4">
                <span className="text-xs text-muted-foreground uppercase font-mono">Status</span>
                <p className="text-lg font-bold font-mono text-emerald-400 mt-1 capitalize">
                  {currentUser?.status || 'Active'}
                </p>
              </div>

              <div className="rounded-md border border-border bg-background p-4">
                <span className="text-xs text-muted-foreground uppercase font-mono">AI Mode</span>
                <p className="text-lg font-bold font-mono text-foreground mt-1 uppercase">
                  {settings?.features?.ai_provider_mode || 'BYOK_ONLY'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                Granted Capabilities
              </h3>

              <div className="divide-y divide-border rounded-lg border border-border bg-background">
                <div className="flex items-center justify-between p-3.5 text-sm">
                  <div>
                    <p className="font-medium">Automated PR Code Reviews</p>
                    <p className="text-xs text-muted-foreground">Bot performs automated inline findings and diff checks on PRs</p>
                  </div>
                  <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${
                    settings?.features?.can_review_prs !== false
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {settings?.features?.can_review_prs !== false ? 'ALLOWED' : 'DISABLED'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 text-sm">
                  <div>
                    <p className="font-medium">Interactive Repository Chat</p>
                    <p className="text-xs text-muted-foreground">Deep graph-grounded question answering over codebase</p>
                  </div>
                  <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${
                    settings?.features?.can_repo_chat !== false
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {settings?.features?.can_repo_chat !== false ? 'ALLOWED' : 'DISABLED'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 text-sm">
                  <div>
                    <p className="font-medium">Social Media Studio</p>
                    <p className="text-xs text-muted-foreground">Generate multi-platform technical engineering announcements</p>
                  </div>
                  <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${
                    settings?.features?.can_social_studio !== false
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {settings?.features?.can_social_studio !== false ? 'ALLOWED' : 'DISABLED'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: App Keys & Devices */}
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
                Create Key
              </Button>
            </form>

            {createdRawKey && (
              <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-xs font-semibold text-emerald-400">
                  Key generated successfully! Copy it now — you won't be able to see it again:
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
