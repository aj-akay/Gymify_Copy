import { Link, useLocation } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function MemberGate({ children, title = 'Your next move, saved.' }) {
  const { user, loading, enabled, error } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <div className="container page empty" role="status">Checking your session...</div>;
  if (user) return children;
  return <section className="container page member-gate">
    <LockKeyhole size={32} aria-hidden="true" />
    <span className="eyebrow">FREE, OPTIONAL ACCOUNT</span>
    <h1>{title}</h1>
    <p>Browse every gym freely. Sign in to compare gyms and keep your saved list together.</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    {!enabled && <p className="form-notice">Account screens are available to preview. Sign-in and account storage are awaiting backend integration.</p>}
    <div className="action-row">
      <Link className="button" to={`/login?next=${encodeURIComponent(pathname)}`}>Sign in</Link>
      <Link className="button dark" to={`/signup?next=${encodeURIComponent(pathname)}`}>Create an account</Link>
      <Link className="text-link" to="/gyms">Keep exploring gyms</Link>
    </div>
  </section>;
}
