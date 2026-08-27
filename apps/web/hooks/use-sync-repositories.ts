'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Repository } from '@/types/api';

export function useSyncRepositories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ data: Repository[] }>('/repositories/sync');
      return data.data;
    },
    onSuccess: (repositories) => {
      queryClient.setQueryData(['repositories'], repositories);
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });
}
