import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { memberRequest } from '../services/memberApi';

const SavedContext = createContext(null);
export const useSavedGyms = () => useContext(SavedContext);

export function SavedProvider({ children }) {
  const { user } = useAuth();
  const [savedIds, setSavedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const currentUser = useRef(user?.id);
  currentUser.current = user?.id;
  const [loadedUser, setLoadedUser] = useState(null);

  useEffect(() => {
    setSavedIds([]);
    setLoadedUser(null);
    setError('');
    if (!user) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    memberRequest('/me/saved-gyms', { signal: controller.signal })
      .then(data => {
        if (!Array.isArray(data.gymIds)) throw new Error('Invalid saved gym response.');
        if (!controller.signal.aborted) { setSavedIds(data.gymIds); setLoadedUser(user.id); }
      })
      .catch(e => { if (e.name !== 'AbortError') setError('Could not load saved gyms. Please retry.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user?.id, revision]);

  async function toggleSaved(id) {
    if (!user || loadedUser !== user.id) throw new Error('Saved gyms are not ready. Please retry loading your list.');
    const owner = user.id;
    const exists = savedIds.includes(id);
    await memberRequest(`/me/saved-gyms/${encodeURIComponent(id)}`, { method: exists ? 'DELETE' : 'PUT' });
    if (currentUser.current === owner) setSavedIds(ids => exists ? ids.filter(x => x !== id) : [...new Set([...ids, id])]);
  }

  return <SavedContext.Provider value={{ savedIds: loadedUser === user?.id ? savedIds : [], loading: loading || Boolean(user && loadedUser !== user.id && !error), error, ready: Boolean(user && loadedUser === user.id), toggleSaved, retry: () => setRevision(n => n + 1) }}>{children}</SavedContext.Provider>;
}
