'use client';

import Link from 'next/link';
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useRepositories } from '@/hooks/use-repositories';
import { useUIStore } from '@/store/ui-store';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

export function AppSidebar() {
  const { data: user } = useCurrentUser();
  const { data: repositories } = useRepositories();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

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
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={repo.fullName}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  repo.isActive ? 'bg-diff-add' : 'bg-muted-foreground',
                )}
              />
              {!sidebarCollapsed && <span className="truncate font-mono text-xs">{repo.fullName}</span>}
            </Link>
          ))}
        </div>
      </nav>

      <div className="border-t border-border px-4 py-3">
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
