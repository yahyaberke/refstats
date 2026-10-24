import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Category, Suggestions } from './types';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ categories: Category[] }>('/categories').then((r) => r.categories),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSuggestions() {
  return useQuery({
    queryKey: ['suggestions'],
    queryFn: () => api.get<Suggestions>('/matches/suggestions'),
    staleTime: 60 * 1000,
  });
}

/** Maç verisi değişince ona bağlı tüm görünümleri (liste, istatistik, takvim) yeniler. */
export function useInvalidateMatchData() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['matches'] }),
      qc.invalidateQueries({ queryKey: ['match'] }),
      qc.invalidateQueries({ queryKey: ['stats'] }),
      qc.invalidateQueries({ queryKey: ['calendar'] }),
      qc.invalidateQueries({ queryKey: ['suggestions'] }),
      qc.invalidateQueries({ queryKey: ['library'] }),
    ]);
}
