import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { Me } from '../lib/types';

interface AuthValue {
  user: Me | null;
  loading: boolean;
  setUser: (u: Me | null) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<unknown>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<{ user: Me | null }>('/auth/me').then((r) => r.user),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const setUser = useCallback((u: Me | null) => qc.setQueryData(['me'], u), [qc]);
  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    // Başka kullanıcının verisi önbellekte kalmasın.
    qc.clear();
    qc.setQueryData(['me'], null);
  }, [qc]);
  return (
    <AuthContext.Provider value={{ user: me.data ?? null, loading: me.isLoading, setUser, logout, refresh: me.refetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
