import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface MergeResult {
  merged: boolean;
  sha: string;
  message: string;
}

export function useMergePR() {
  return useMutation<MergeResult, Error, { pullRequestId: string; mergeMethod?: string }>({
    mutationFn: async ({ pullRequestId, mergeMethod }) => {
      const { data } = await apiClient.post(`/pull-requests/${pullRequestId}/merge`, {
        mergeMethod: mergeMethod || 'merge',
      });
      return data;
    },
  });
}
