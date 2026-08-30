import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, setSessionLostHandler } from '@/api/client';
import { tokens } from '@/api/tokens';
import type { AuthTokens, CurrentUser } from '@/types';

interface AuthState {
  user: CurrentUser | null;
  /** True until the first session restore finishes. Guards render the spinner on it. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: string[]) => boolean;
  hasPermission: (permission: string) => boolean;
}

export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    setSessionLostHandler(() => {
      if (mounted.current) setUser(null);
    });
  }, []);

  /**
   * Restore the session on load.
   *
   * The access token lives in memory, so after a refresh there is none. If a refresh
   * token survived, exchange it and fetch the profile. A failure here is the ordinary
   * logged-out case, not an error worth showing anybody.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tokens.getRefresh()) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const { data } = await api.get<CurrentUser>('/auth/me');
        if (!cancelled) setUser(data);
      } catch {
        tokens.clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<AuthTokens>('/auth/login', { email, password });
    tokens.setAccess(data.accessToken);
    tokens.setRefresh(data.refreshToken);
    const me = await api.get<CurrentUser>('/auth/me');
    setUser(me.data);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokens.getRefresh();
    try {
      // Best effort: the server revokes the refresh token so a copy of it is dead.
      // If this fails the local session still ends — never trap someone in a session.
      // Same contract as refresh: the refresh token goes in the header.
      if (refreshToken) {
        await api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${refreshToken}` } });
      }
    } catch {
      /* ignore */
    } finally {
      tokens.clear();
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login,
      logout,
      hasRole: (...roles) => !!user && roles.some((r) => user.roles.includes(r)),
      hasPermission: (permission) => !!user?.permissions?.includes(permission),
    }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
