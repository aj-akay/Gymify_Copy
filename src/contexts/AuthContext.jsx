import { createContext, useContext, useEffect, useState } from 'react';
import { memberApiEnabled, memberRequest } from '../services/memberApi';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(memberApiEnabled);
  const [error, setError] = useState('');

  async function refreshSession(signal) {
    const data = await memberRequest('/auth/session', { signal });
    if (data.user && typeof data.user.id !== 'string') throw new Error('Invalid session response.');
    setUser(data.user || null);
    return data.user;
  }

  useEffect(() => {
    if (!memberApiEnabled) return;
    const controller = new AbortController();
    refreshSession(controller.signal).catch(e => {
      if (e.name !== 'AbortError' && e.status !== 401) setError('Could not check your session. Please sign in again.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function login(email, password) {
    if (!memberApiEnabled) throw new Error('Account services are not connected yet.');
    await memberRequest('/auth/login', { method: 'POST', body: { email, password } });
    const sessionUser = await refreshSession();
    if (!sessionUser) throw new Error('No session was returned. Please try signing in again.');
    setError('');
  }

  async function logout() {
    await memberRequest('/auth/logout', { method: 'POST' });
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, error, login, logout, enabled: memberApiEnabled }}>
    {children}
  </AuthContext.Provider>;
}
