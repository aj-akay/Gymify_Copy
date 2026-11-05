import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { memberApiEnabled, memberRequest, safeReturnPath } from '../services/memberApi';

// Shared sign-in, sign-up, and recovery layout. No passwords are stored locally.
export default function AuthPage({ mode = 'login' }) {
  const { user, loading, login } = useAuth();
  const [params] = useSearchParams();
  const next = safeReturnPath(params.get('next'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const signup = mode === 'signup';
  const recovery = mode === 'recovery';
  const title = signup ? 'Make room for your next chapter.' : recovery ? 'Let�s get you back in.' : 'Welcome back to GYMIFY.';
  if (loading) return <div className="container page empty" role="status">Checking your session...</div>;
  if (user && !recovery) return <Navigate to={next} replace />;

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!memberApiEnabled) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    try {
      if (recovery) {
        await memberRequest('/auth/forgot-password', { method: 'POST', body: { email: values.email } });
        setMessage('If an account exists for that email, you�ll receive password reset instructions.');
      } else if (signup) {
        await memberRequest('/auth/register', { method: 'POST', body: { name: values.name, email: values.email, password: values.password } });
        setMessage('Registration received. Check your email for any verification instructions, then sign in.');
        event.target.reset();
      } else await login(values.email, values.password);
    } catch (e) { setError(e.message || 'Could not complete your request. Please try again.'); }
    finally { setBusy(false); }
  }

  return <div className="container page auth-layout">
    <div className="auth-intro"><span className="eyebrow">YOUR CITY. YOUR SHORTLIST.</span><h1>{title}</h1>
      <p>A free account gives your gym search a home. Save your favorites and compare your options.</p>
      <Link className="text-link" to="/gyms">Explore gyms without an account ?</Link>
    </div>
    <section className="form-panel" aria-labelledby="auth-title">
      <h2 id="auth-title">{signup ? 'Create an account' : recovery ? 'Reset your password' : 'Sign in'}</h2>
      {!memberApiEnabled && <p className="form-notice">Frontend preview: account services are not connected yet. No account will be created and credentials will not be sent.</p>}
      <form onSubmit={submit} className="stack-form" aria-busy={busy}>
        {signup && <label>Your name<input name="name" autoComplete="name" required maxLength={80} /></label>}
        <label>Email address<input type="email" name="email" autoComplete="email" required maxLength={254} /></label>
        {!recovery && <label>Password<input type="password" name="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 8 : undefined} maxLength={128} />{signup && <small>Use at least 8 characters.</small>}</label>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
        <button className="button" disabled={busy || !memberApiEnabled} type="submit">{busy ? 'Please wait...' : !memberApiEnabled ? 'Account service coming soon' : signup ? 'Create account' : recovery ? 'Send reset instructions' : 'Sign in'}</button>
      </form>
      <div className="form-links">
        {!recovery && <Link to={`${signup ? '/login' : '/signup'}?next=${encodeURIComponent(next)}`}>{signup ? 'Already have an account? Sign in' : 'New here? Create an account'}</Link>}
        {!signup && <Link to={recovery ? '/login' : '/forgot-password'}>{recovery ? 'Back to sign in' : 'Forgot password?'}</Link>}
      </div>
    </section>
  </div>;
}
