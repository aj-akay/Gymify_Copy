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
      setError(requestError.message || 'Could not open billing. Please try again.');
      setBusy(false);
    }
  }

  async function refreshPlan() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await refreshAccount();
      setNotice('Your subscription status is up to date.');
    } catch (requestError) {
      setError(requestError.message || 'Could not refresh your plan.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="container page plans-page">
    <span className="eyebrow">SIMPLE MEMBERSHIP. MORE ROOM TO CONNECT.</span>
    <h1>Choose your GYMIFY plan.</h1>
    <p className="page-intro">Gym discovery is free. Premium is an app subscription for more trainer connection and session requests—not a gym membership or trainer fee.</p>
    {checkoutStatus === 'success' && <div className="form-notice" role="status">Checkout completed. Your plan updates after Stripe confirms the subscription. <button className="text-link" onClick={refreshPlan} disabled={busy}>Refresh status</button></div>}
    {checkoutStatus === 'cancelled' && <div className="form-notice" role="status">Checkout was cancelled. You are still on the Free plan.</div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="form-success" role="status">{notice}</p>}
    {user && <p className="plan-status">Your current plan: <strong>{premium ? 'Premium' : 'Free'}</strong>{subscription?.current_period_end && premium ? ` · renews ${new Date(subscription.current_period_end).toLocaleDateString()}` : ''}</p>}
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
        <p className="plan-price">₱175 <span>/ month</span></p>
        <ul>{premiumFeatures.map((feature) => <li key={feature}><Check size={17} />{feature}</li>)}</ul>
        {!user && <Link className="button" to="/signup?next=%2Fplans">Choose Premium</Link>}
        {user?.role === 'gym_goer' && !premium && <button className="button" disabled={busy} onClick={() => openBilling('/billing/checkout')}>{busy ? 'Opening secure checkout...' : 'Subscribe to Premium'}</button>}
        {premium && <button className="button button-secondary" disabled={busy} onClick={() => openBilling('/billing/portal')}>{busy ? 'Opening billing...' : 'Manage subscription'}</button>}
        {user && user.role !== 'gym_goer' && <p className="trainer-meta">Premium app subscriptions are for gym-goer accounts.</p>}
      </article>
    </div>
    <p className="plan-footnote">Payments for gym memberships and trainer sessions are arranged directly with the gym or trainer. GYMIFY only collects its own Premium app subscription. Cancel Premium through the secure billing portal.</p>
  </div>;
}
