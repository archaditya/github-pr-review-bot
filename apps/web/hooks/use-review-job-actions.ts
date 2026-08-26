import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ReviewJob } from '@/types/api';

export function useCancelReviewJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reviewJobId: string) => {
      const response = await apiClient.post<{ data: ReviewJob }>(
        `/review-jobs/${reviewJobId}/cancel`,
      );
      return response.data.data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['review-jobs', updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ['review-jobs'] });
    },
  });
}

export function useRetryReviewJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reviewJobId: string) => {
      const response = await apiClient.post<{ data: ReviewJob }>(
        `/review-jobs/${reviewJobId}/retry`,
      );
      return response.data.data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['review-jobs', updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ['review-jobs'] });
    },
  });
}

export function useDeleteReviewJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reviewJobId: string) => {
      await apiClient.delete(`/review-jobs/${reviewJobId}`);
      return reviewJobId;
    },
    onSuccess: (deletedId) => {
      queryClient.removeQueries({ queryKey: ['review-jobs', deletedId] });
      queryClient.invalidateQueries({ queryKey: ['review-jobs'] });
    },
  });
}
