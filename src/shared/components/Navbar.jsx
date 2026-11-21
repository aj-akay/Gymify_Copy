import { useState, useEffect, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, X, Menu } from 'lucide-react';
import { CompareContext } from '../../features/gyms/context/CompareContext';
import { useAuth } from '../../features/auth/context/AuthContext';
import Brand from './Brand';
import { useToast } from '../contexts/ToastContext';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { selected } = useContext(CompareContext);
  const { user, loading, logout } = useAuth();
  const notify = useToast();
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); setError(''); }, [pathname]);
  async function signOut() {
    setBusy(true);
    setError('');
    try { await logout(); notify('You have been signed out.'); } catch (e) { setError(e.message || 'Could not sign out. Please try again.'); notify(e.message || 'Could not sign out. Please try again.', 'error'); }
    finally { setBusy(false); }
  }
  return <>
    <a href="#main" className="skip">Skip to content</a>
    <header className="site-header"><div className="container nav">
      <Brand />
      <button className="menu-toggle icon-button" aria-label={open ? 'Close navigation menu' : 'Open navigation menu'} aria-controls="main-navigation" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      <nav id="main-navigation" className={open ? 'nav-links open' : 'nav-links'} aria-label="Main navigation">
        <Link className={pathname === '/gyms' ? 'active' : ''} aria-current={pathname === '/gyms' ? 'page' : undefined} to="/gyms">Explore gyms</Link>
        <Link className={pathname === '/compare' ? 'active' : ''} aria-current={pathname === '/compare' ? 'page' : undefined} to="/compare">Compare gyms {selected.length > 0 && <span className="count" aria-label={`${selected.length} gyms selected`}>{selected.length}</span>}</Link>
        <Link className={pathname === '/saved' ? 'active' : ''} aria-current={pathname === '/saved' ? 'page' : undefined} to="/saved">Saved gyms</Link>
        <Link className={pathname.startsWith('/trainers') ? 'active' : ''} aria-current={pathname.startsWith('/trainers') ? 'page' : undefined} to="/trainers">Find trainers</Link>
        <Link className={pathname === '/plans' ? 'active' : ''} aria-current={pathname === '/plans' ? 'page' : undefined} to="/plans">Plans</Link>
        {user?.role === 'trainer' && <Link className={pathname === '/trainer/dashboard' ? 'active' : ''} to="/trainer/dashboard">Trainer dashboard</Link>}
        {user?.role === 'admin' && <Link className={pathname.startsWith('/admin') ? 'active' : ''} to="/admin">Admin dashboard</Link>}
        <Link className="nav-partner" to="/partners">For gym owners <ArrowUpRight size={16} /></Link>
        {loading ? <span role="status">Checking session...</span> : user ? <button className="nav-auth" onClick={signOut} disabled={busy}>{busy ? 'Signing out...' : 'Sign out'}</button> : <Link className="nav-auth" to="/login">Sign in</Link>}
      </nav>
    </div>{error && <p className="container form-error" role="alert">{error}</p>}</header>
  </>;
}
