'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { UserFeatures, UserUsage } from '@/types/api';

export interface SettingsData {
  role: 'admin' | 'user';
  status: 'active' | 'pending' | 'suspended';
  features: UserFeatures;
  preferences: Record<string, any>;
  usage: UserUsage;
  hasOpenaiKey: boolean;
  maskedOpenaiKey: string | null;
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: SettingsData }>('/settings');
      return data.data;
    },
  });
}

export function useSaveAiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (apiKey: string) => {
      const { data } = await apiClient.put<{ data: { success: boolean; maskedKey: string } }>('/settings/ai-key', {
        apiKey,
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useRemoveAiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete<{ data: { success: boolean } }>('/settings/ai-key');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useTestAiKey() {
  return useMutation({
    mutationFn: async (apiKey?: string) => {
      const { data } = await apiClient.post<{ data: { valid: boolean; error?: string; modelCount?: number } }>(
        '/settings/test-ai-key',
        apiKey ? { apiKey } : {}
      );
      return data.data;
    },
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { preferences?: Record<string, any>; allowedSocialPlatforms?: string[] }) => {
      const { data } = await apiClient.put<{ data: any }>('/settings/preferences', payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
