import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, revokeSession, setToken } from './api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  const logout = useCallback((revoke = true) => {
    const token = getToken();
    if (revoke !== false && token) revokeSession(token);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const onLogout = () => logout(false);
    const onStorage = (e) => {
      if (e.key !== 'inboxly_token') return;
      if (!e.newValue) {
        setUser(null);
      } else {
        api.get('/auth/me').then((d) => setUser(d.user)).catch(() => setUser(null));
      }
    };
    window.addEventListener('inboxly:logout', onLogout);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('inboxly:logout', onLogout);
      window.removeEventListener('storage', onStorage);
    };
  }, [logout]);

  useEffect(() => {
    if (!getToken()) return;
    api
      .get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const finish = (d) => {
    setToken(d.token);
    setUser(d.user);
    return d.user;
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      logout,
      demo: async (role) => finish(await api.post('/auth/demo', { role })),
      login: async (email, password) => finish(await api.post('/auth/login', { email, password })),
      register: async (name, email, password) => finish(await api.post('/auth/register', { name, email, password })),
      completeOnboarding: async () => setUser((await api.patch('/auth/onboarding')).user),
    }),
    [user, loading, logout]
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
