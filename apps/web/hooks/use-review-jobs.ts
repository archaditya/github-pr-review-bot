'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ReviewJob } from '@/types/api';

export function useReviewJobs(repositoryId: string) {
  return useQuery({
    queryKey: ['review-jobs', repositoryId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: ReviewJob[] }>('/review-jobs', {
        params: { repositoryId },
      });
      return data.data;
    },
    enabled: Boolean(repositoryId),
  });
}
