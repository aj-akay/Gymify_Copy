import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import { useSavedGyms } from '../context/SavedContext';

export default function SaveGymButton({ gym }) {
  const { user, loading: sessionLoading } = useAuth();
  const { savedIds, ready, loading, error: loadError, toggleSaved } = useSavedGyms();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saved = savedIds.includes(gym.id);
  async function save() {
    if (!user) { navigate(`/login?next=${encodeURIComponent(pathname)}`); return; }
    setError('');
    setBusy(true);
    try { await toggleSaved(gym.id); } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="save-control">
    <button className={'save-button ' + (saved ? 'is-saved' : '')} type="button" onClick={save} disabled={sessionLoading || busy || (Boolean(user) && (loading || !ready))} aria-pressed={saved} aria-label={`${saved ? 'Unsave' : 'Save'} ${gym.name}`}>
      {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />} {busy ? 'Saving...' : saved ? 'Saved' : 'Save gym'}
    </button>
    {error && <p className="form-error" role="alert">{error}</p>}
    {user && loadError && <span className="save-hint">Saved list unavailable. <a href="/saved">Retry from Saved gyms</a></span>}
  </div>;
}
