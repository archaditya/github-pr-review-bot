'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ReviewJobDetail, ReviewJobStatus } from '@/types/api';

const TERMINAL_STATUSES: ReviewJobStatus[] = ['COMPLETED', 'FAILED'];

export function useReviewJob(id: string) {
  return useQuery({
    queryKey: ['review-jobs', 'detail', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: ReviewJobDetail }>(`/review-jobs/${id}`);
      return data.data;
    },
    enabled: Boolean(id),
    // Poll while the pipeline is still running so the stepper/findings update live;
    // stop once the job reaches a terminal state (mirrors ReviewJob's state machine,
    // docs/architecture/data-model.md).
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && !TERMINAL_STATUSES.includes(status) ? 3000 : false;
    },
  });
}
