'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Repository } from '@/types/api';

export function useRepositories() {
  return useQuery({
    queryKey: ['repositories'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Repository[] }>('/repositories');
      return data.data;
    },
  });
}
