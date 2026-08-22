'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Repository } from '@/types/api';

export function useUpdateRepository(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (isActive: boolean) => {
      const { data } = await apiClient.patch<{ data: Repository }>(`/repositories/${id}`, {
        isActive,
      });
      return data.data;
    },
    onSuccess: (repository) => {
      queryClient.setQueryData(['repositories', id], repository);
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });
}
