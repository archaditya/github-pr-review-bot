'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, PanelLeftClose, PanelLeftOpen, Key, GitFork, Radio } from 'lucide-react';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useRepositories } from '@/hooks/use-repositories';
import { useWebSocket } from '@/hooks/use-web-socket';
import { useUIStore } from '@/store/ui-store';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

export function AppSidebar() {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();
  const { data: repositories } = useRepositories();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { isConnected: isWsConnected } = useWebSocket();

  async function handleLogout() {
    await apiClient.post('/auth/logout');
    window.location.href = '/login';
  }

  return (
    <aside
      className={cn(
        'flex h-screen shrink-0 flex-col border-r border-border bg-card transition-[width] duration-150',
        sidebarCollapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        {!sidebarCollapsed && (
          <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
            archadi<span className="text-primary">-pr-review</span>
          </Link>
        )}
        <Button variant="ghost" size="icon" onClick={toggleSidebar}>
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <div className="flex flex-col gap-1 px-2 mb-3">
          <Link
            href="/"
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === '/'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
            title="Repositories"
          >
            <GitFork className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>Dashboard</span>}
          </Link>

          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === '/settings'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
            title="App Keys & Settings"
          >
            <Key className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>App Keys</span>}
          </Link>
        </div>

        {!sidebarCollapsed && (
          <p className="px-4 pb-1 pt-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Repositories
          </p>
        )}
        <div className="flex flex-col">
          {repositories?.map((repo) => (
            <Link
              key={repo.id}
              href={`/repositories/${repo.id}`}
              className={cn(
                'flex items-center gap-2.5 px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-foreground',
                pathname === `/repositories/${repo.id}`
                  ? 'bg-accent text-foreground font-medium'
                  : 'text-muted-foreground',
              )}
              title={repo.fullName}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  repo.indexStatus === 'INDEXED'
                    ? 'bg-diff-add'
                    : repo.indexStatus === 'INDEXING' || repo.indexStatus === 'REINDEXING'
                    ? 'bg-primary animate-pulse'
                    : 'bg-muted-foreground',
                )}
              />
              {!sidebarCollapsed && <span className="truncate font-mono text-xs">{repo.fullName}</span>}
            </Link>
          ))}
        </div>
      </nav>

      {/* Real-time connection status & User Profile */}
      <div className="border-t border-border px-4 py-3 flex flex-col gap-2">
        {!sidebarCollapsed && (
          <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground px-0.5">
            <span className="flex items-center gap-1.5">
              <Radio className={cn('h-3 w-3', isWsConnected ? 'text-diff-add animate-pulse' : 'text-muted-foreground')} />
              {isWsConnected ? 'Live Sync' : 'Offline'}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <Avatar className="h-7 w-7">
            <AvatarFallback>{user?.name?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
          </Avatar>
          {!sidebarCollapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-xs font-medium">{user?.name ?? '—'}</span>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
