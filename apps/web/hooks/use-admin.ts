'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { User, UserFeatures } from '@/types/api';

export interface AdminStats {
  users: {
    total: number;
    active: number;
    suspended: number;
    pending: number;
  };
  counts: {
    reviews: number;
    socialPosts: number;
    repositories: number;
  };
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: User[] }>('/admin/users');
      return data.data;
    },
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: AdminStats }>('/admin/stats');
      return data.data;
    },
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'pending' | 'suspended' }) => {
      const { data } = await apiClient.patch<{ data: User }>(`/admin/users/${id}/status`, { status });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: 'admin' | 'user' }) => {
      const { data } = await apiClient.patch<{ data: User }>(`/admin/users/${id}/role`, { role });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });
}

export function useUpdateUserFeatures() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, features }: { id: string; features: Partial<UserFeatures> }) => {
      const { data } = await apiClient.patch<{ data: User }>(`/admin/users/${id}/features`, { features });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}
