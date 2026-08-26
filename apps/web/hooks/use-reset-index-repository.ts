import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Repository } from '@/types/api';

export function useResetIndexRepository(repositoryId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<{ data: Repository }>(
        `/repositories/${repositoryId}/reset-index`,
      );
      return response.data.data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['repositories', repositoryId], updated);
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });
}
