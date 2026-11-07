import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { memberApiEnabled, memberRequest } from '../../../services/memberApi';
import { supabase } from '../../../lib/supabase';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function authRedirectUrl(path) {
  if (import.meta.env.VITE_GITHUB_PAGES === 'true') {
    return new URL(`${import.meta.env.BASE_URL}#${path}`, window.location.origin).toString();
  }
  return new URL(path, window.location.origin).toString();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState({ tier: 'free', status: 'free', current_period_end: null });
  const [loading, setLoading] = useState(memberApiEnabled);
  const [error, setError] = useState('');

  const refreshAccount = useCallback(async (accessToken, signal) => {
    const data = await memberRequest('/me', { accessToken, signal });
    if (!data.user || typeof data.user.id !== 'string') throw new Error('Invalid account response.');
    setUser(data.user);
    setSubscription(data.subscription || { tier: 'free', status: 'free', current_period_end: null });
    return data.user;
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    const load = async (session) => {
      if (!session) {
        setUser(null);
        setSubscription({ tier: 'free', status: 'free', current_period_end: null });
        setLoading(false);
        return;
      }
      try {
        await refreshAccount(session.access_token);
        if (active) setError('');
      } catch (e) {
        if (active && e.name !== 'AbortError') setError('Could not load your account. Please sign in again.');
      } finally {
        if (active) setLoading(false);
      }
    };
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void load(session);
    });
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) throw sessionError;
      return load(data.session);
    }).catch((e) => {
      if (active) setError('Could not check your session. Please sign in again.');
      console.error('Could not restore the GYMIFY session:', e);
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      authSubscription.unsubscribe();
    };
  }, [refreshAccount]);

  async function login(email, password) {
    if (!supabase) throw new Error('Set the Supabase URL and public key to connect account services.');
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) throw loginError;
    const { data } = await supabase.auth.getSession();
    const sessionUser = await refreshAccount(data.session?.access_token);
    if (!sessionUser) throw new Error('No session was returned. Please try signing in again.');
    setError('');
  }

  async function register({ name, email, password, role }) {
    if (!supabase) throw new Error('Set the Supabase URL and public key to connect account services.');
    const { error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role },
        emailRedirectTo: authRedirectUrl('/login'),
      },
    });
    if (signupError) throw signupError;
  }

  async function recoverPassword(email) {
    if (!supabase) throw new Error('Set the Supabase URL and public key to connect account services.');
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectUrl('/reset-password'),
    });
    if (recoveryError) throw recoveryError;
  }

  async function updatePassword(password) {
    if (!supabase) throw new Error('Set the Supabase URL and public key to connect account services.');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) throw updateError;
  }

  async function logout() {
    if (!supabase) return;
    const { error: logoutError } = await supabase.auth.signOut();
    if (logoutError) throw logoutError;
    setUser(null);
    setSubscription({ tier: 'free', status: 'free', current_period_end: null });
  }

  return <AuthContext.Provider value={{ user, subscription, loading, error, login, register, recoverPassword, updatePassword, refreshAccount, logout, enabled: memberApiEnabled }}>
    {children}
  </AuthContext.Provider>;
}
