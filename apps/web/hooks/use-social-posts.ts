import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { SocialPost, PublishResult } from '@/types/api';

export function useSocialPostsForPR(prId: string | undefined) {
  return useQuery<SocialPost[]>({
    queryKey: ['social-posts', 'pr', prId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/social-posts/pr/${prId}`);
      return data;
    },
    enabled: !!prId,
  });
}

export function useRecentSocialPosts(limit = 20) {
  return useQuery<SocialPost[]>({
    queryKey: ['social-posts', 'recent', limit],
    queryFn: async () => {
      const { data } = await apiClient.get('/social-posts', { params: { limit } });
      return data;
    },
  });
}

export function useGenerateSocialDrafts() {
  const qc = useQueryClient();
  return useMutation<SocialPost[], Error, { pullRequestId: string }>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post('/social-posts/generate', body);
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['social-posts', 'pr', variables.pullRequestId] });
    },
  });
}

export function useGenerateStandaloneDrafts() {
  const qc = useQueryClient();
  return useMutation<SocialPost[], Error, { input: string; repoContext?: string; imageUrl?: string }>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post('/social-posts/generate-standalone', body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social-posts', 'recent'] });
    },
  });
}

export function useUpdateSocialDraft() {
  const qc = useQueryClient();
  return useMutation<SocialPost, Error, { id: string; editedText?: string; imageUrl?: string | null }>({
    mutationFn: async ({ id, ...body }) => {
      const { data } = await apiClient.patch(`/social-posts/${id}`, body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social-posts'] });
    },
  });
}

export function usePublishAllPosts() {
  const qc = useQueryClient();
  return useMutation<PublishResult[], Error, { postIds: string[] }>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post('/social-posts/publish', body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social-posts'] });
    },
  });
}

export function usePublishSinglePost() {
  const qc = useQueryClient();
  return useMutation<PublishResult[], Error, string>({
    mutationFn: async (id) => {
      const { data } = await apiClient.post(`/social-posts/${id}/publish`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social-posts'] });
    },
  });
}
