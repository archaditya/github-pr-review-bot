import { create } from 'zustand';

/**
 * Zustand is reserved for UI state that has no server counterpart — sidebar collapse,
 * modal open/closed, etc. Anything that comes from apps/api (repos, jobs, the current
 * user) goes through TanStack Query hooks instead (hooks/), never duplicated here.
 */
interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
