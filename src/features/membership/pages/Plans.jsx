import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check } from 'lucide-react';
import { memberRequest } from '../../../services/memberApi';
import { useAuth } from '../../auth/context/AuthContext';

const freeFeatures = [
  'Browse gyms and verified trainer profiles',
  'Save and compare gyms',
  '5 trainer connection or session requests each month',
];
const premiumFeatures = [
  'Everything in Free',
  '20 trainer connection or session requests each month',
  'More room to request trainer connections and sessions',
];

export default function Plans() {
  const { user, subscription, refreshAccount } = useAuth();
  const { search } = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const premium = subscription?.tier === 'premium' && ['active', 'trialing'].includes(subscription.status);
  const checkoutStatus = new URLSearchParams(search).get('checkout');

  async function openBilling(path) {
    if (!user) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { url } = await memberRequest(path, { method: 'POST' });
      window.location.assign(url);
    } catch (requestError) {
      const message = requestError.message || 'Could not open billing. Please try again.';
      setError(message);
      setBusy(false);
    }
  }

  async function refreshPlan() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await refreshAccount();
      setNotice('Your Premium access status is up to date.');
    } catch (requestError) {
      const message = requestError.message || 'Could not refresh your plan. Please try again.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="container page plans-page">
    <span className="eyebrow">SIMPLE MEMBERSHIP. MORE ROOM TO CONNECT.</span>
    <h1>Choose your GYMIFY plan.</h1>
    <p className="page-intro">Gym discovery is free. Premium is a 30-day app pass that raises your trainer requests—not a gym membership or trainer fee.</p>
    {checkoutStatus === 'success' && <div className="form-notice" role="status">Thanks! PayMongo is confirming your payment. Your Premium access starts after confirmation. <button className="text-link" onClick={refreshPlan} disabled={busy}>Refresh status</button></div>}
    {checkoutStatus === 'cancelled' && <div className="form-notice" role="status">Checkout was cancelled. No payment was taken, and your current access is unchanged.</div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="form-success" role="status">{notice}</p>}
    {user && <p className="plan-status">Your current plan: <strong>{premium ? 'Premium' : 'Free'}</strong>{subscription?.current_period_end && premium ? ` · access through ${new Date(subscription.current_period_end).toLocaleDateString()}` : ''}</p>}
    <div className="plan-grid">
      <article className="plan-card">
        <span className="eyebrow">FREE</span>
        <h2>Start exploring</h2>
        <p className="plan-price">₱0 <span>/ forever</span></p>
        <ul>{freeFeatures.map((feature) => <li key={feature}><Check size={17} />{feature}</li>)}</ul>
        {!user && <Link className="button button-secondary" to="/signup?next=%2Fplans">Create a free account</Link>}
      </article>
      <article className="plan-card plan-card-premium">
        <span className="eyebrow">PREMIUM</span>
        <h2>Make more connections</h2>
        <p className="plan-price">₱175 <span>/ 30 days</span></p>
        <ul>{premiumFeatures.map((feature) => <li key={feature}><Check size={17} />{feature}</li>)}</ul>
        <p className="premium-payment-note">Pay with GCash, card, Maya, or QR Ph. No automatic charges; renew manually every 30 days.</p>
        {!user && <Link className="button" to="/signup?next=%2Fplans">Choose Premium</Link>}
        {user?.role === 'gym_goer' && <button className="button" disabled={busy} onClick={() => openBilling('/billing/checkout')}>{busy ? 'Opening secure checkout...' : premium ? 'Add 30 days · ₱175' : 'Get Premium · ₱175'}</button>}
        {user && user.role !== 'gym_goer' && <p className="trainer-meta">Premium app passes are available to gym-goer accounts.</p>}
      </article>
    </div>
    <p className="plan-footnote">Premium is a one-time 30-day purchase and does not auto-renew. Pay for another 30 days any time. Payments for gym memberships and trainer sessions are arranged directly with the gym or trainer.</p>
  </div>;
}
