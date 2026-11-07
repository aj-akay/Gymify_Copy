import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { memberApiEnabled, safeReturnPath } from '../../../services/memberApi';

// Shared sign-in, sign-up, and recovery layout. No passwords are stored locally.
export default function AuthPage({ mode = 'login' }) {
  const { user, loading, login, register, recoverPassword, updatePassword, logout } = useAuth();
  const [params] = useSearchParams();
  const next = safeReturnPath(params.get('next'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const signup = mode === 'signup';
  const recovery = mode === 'recovery';
  const newPassword = mode === 'new-password';
  const passwordReset = recovery || newPassword;
  const title = signup ? 'Make room for your next chapter.' : passwordReset ? "Let's get you back in." : 'Welcome back to GYMIFY.';
  if (loading) return <div className="container page empty" role="status">Checking your session...</div>;
  if (user && !passwordReset) return <Navigate to={next} replace />;

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!memberApiEnabled) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    try {
      if (recovery) {
        await recoverPassword(values.email);
        setMessage('If an account exists for that email, you’ll receive password reset instructions.');
      } else if (newPassword) {
        await updatePassword(values.password);
        setMessage('Your password has been updated. You can now sign in.');
        await logout();
      } else if (signup) {
        await register({
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
          role: values.role,
        });
        setMessage('Registration received. Check your email to verify your account, then sign in.');
        event.target.reset();
      } else await login(values.email, values.password);
    } catch (e) { setError(e.message || 'Could not complete your request. Please try again.'); }
    finally { setBusy(false); }
  }

  return <div className="container page auth-layout">
    <div className="auth-intro"><span className="eyebrow">YOUR CITY. YOUR SHORTLIST.</span><h1>{title}</h1>
      <p>A Free account lets you save gyms and discover trainers. Premium adds more trainer connection and session requests.</p>
      <Link className="text-link" to="/gyms">Explore gyms without an account ?</Link>
    </div>
    <section className="form-panel" aria-labelledby="auth-title">
      <h2 id="auth-title">{signup ? 'Create an account' : newPassword ? 'Choose a new password' : recovery ? 'Reset your password' : 'Sign in'}</h2>
      {!memberApiEnabled && <p className="form-notice">Account services are not configured yet. No credentials will be sent.</p>}
      <form onSubmit={submit} className="stack-form" aria-busy={busy}>
        {signup && <label>Your name<input name="name" autoComplete="name" required maxLength={80} /></label>}
        {signup && <label>Account type
          <select name="role" defaultValue="gym_goer" required>
            <option value="gym_goer">Gym-goer</option>
            <option value="trainer">Trainer</option>
          </select>
        </label>}
        {!newPassword && <label>Email address<input type="email" name="email" autoComplete="email" required maxLength={254} /></label>}
        {!recovery && <label>{newPassword ? 'New password' : 'Password'}<input type="password" name="password" autoComplete={signup || newPassword ? 'new-password' : 'current-password'} required minLength={signup || newPassword ? 8 : undefined} maxLength={128} />{(signup || newPassword) && <small>Use at least 8 characters.</small>}</label>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
        <button className="button" disabled={busy || !memberApiEnabled || (newPassword && !user)} type="submit">{busy ? 'Please wait...' : !memberApiEnabled ? 'Account service not configured' : signup ? 'Create account' : newPassword ? 'Update password' : recovery ? 'Send reset instructions' : 'Sign in'}</button>
      </form>
      {signup && <p className="form-notice">Gym owners can inquire about a partnership without creating an account. <Link to="/partners#partner-inquiry">Contact GYMIFY</Link>.</p>}
      <div className="form-links">
        {!passwordReset && <Link to={`${signup ? '/login' : '/signup'}?next=${encodeURIComponent(next)}`}>{signup ? 'Already have an account? Sign in' : 'New here? Create an account'}</Link>}
        {!signup && !newPassword && <Link to={recovery ? '/login' : '/forgot-password'}>{recovery ? 'Back to sign in' : 'Forgot password?'}</Link>}
      </div>
    </section>
  </div>;
}
