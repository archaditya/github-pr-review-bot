'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Repository } from '@/types/api';

export function useRepository(id: string) {
  return useQuery({
    queryKey: ['repositories', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Repository }>(`/repositories/${id}`);
      return data.data;
    },
    enabled: Boolean(id),
  });
}
