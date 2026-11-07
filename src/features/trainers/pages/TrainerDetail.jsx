import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { fetchApi } from '../../../services/api';
import { memberRequest } from '../../../services/memberApi';
import { useAuth } from '../../auth/context/AuthContext';

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TrainerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, subscription } = useAuth();
  const [trainer, setTrainer] = useState(null);
  const [requests, setRequests] = useState([]);
  const [privateDetails, setPrivateDetails] = useState(null);
  const [sessionTime, setSessionTime] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refreshRequests = useCallback(async () => {
    if (!user) {
      setRequests([]);
      setPrivateDetails(null);
      return;
    }
    const currentRequests = await memberRequest('/me/trainer-requests');
    setRequests(currentRequests.filter((request) => request.trainer_id === id));
    const accepted = currentRequests.some((request) => request.kind === 'connection' && request.status === 'accepted' && request.trainer_id === id);
    if (accepted || user.id === id) setPrivateDetails(await memberRequest(`/trainers/${encodeURIComponent(id)}/private`));
    else setPrivateDetails(null);
  }, [id, user]);

  useEffect(() => {
    const controller = new AbortController();
    fetchApi(`/trainers/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(setTrainer)
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      });
    if (user?.role === 'gym_goer') {
      refreshRequests().catch((requestError) => {
        if (requestError.status !== 401) setError(requestError.message);
      });
    }
    return () => controller.abort();
  }, [id, user, refreshRequests]);

  async function submitRequest(kind) {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/trainers/${id}`)}`);
      return;
    }
    if (user.role !== 'gym_goer') {
      setError('Trainer connections are available to gym-goer accounts.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const requestedStart = kind === 'session' ? new Date(sessionTime) : null;
      if (kind === 'session' && (!sessionTime || !Number.isFinite(requestedStart.getTime()))) {
        throw new Error('Choose a valid date and time.');
      }
      await memberRequest(`/trainers/${encodeURIComponent(id)}/requests`, {
        method: 'POST',
        body: {
          kind,
          message: message.trim(),
          requestedStart: requestedStart?.toISOString(),
          requestedEnd: requestedStart ? new Date(requestedStart.getTime() + 60 * 60 * 1000).toISOString() : undefined,
        },
      });
      setMessage('');
      setSessionTime('');
      await refreshRequests();
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Could not send this request.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !trainer) return <div className="container page"><p className="form-error" role="alert">{error}</p><Link className="text-link" to="/trainers">Back to trainers</Link></div>;
  if (!trainer) return <div className="container page" role="status">Loading trainer...</div>;

  const connection = requests.find((request) => request.kind === 'connection');
  const connected = connection?.status === 'accepted';
  const connectionPending = connection?.status === 'pending';
  const sessionRequests = requests.filter((request) => request.kind === 'session');
  const monthlyCap = subscription?.tier === 'premium' && ['active', 'trialing'].includes(subscription.status) ? 20 : 5;

  return <div className="container page trainer-profile-page">
    <Link className="text-link" to="/trainers"><ArrowLeft size={16} /> All trainers</Link>
    <section className="trainer-profile-card">
      {trainer.avatarUrl
        ? <img className="trainer-profile-avatar" src={trainer.avatarUrl} alt="" />
        : <div className="trainer-profile-avatar trainer-avatar-placeholder" aria-hidden="true">{trainer.name.slice(0, 1).toUpperCase()}</div>}
      <div>
        <span className="eyebrow">VERIFIED TRAINER</span>
        <h1>{trainer.name}</h1>
        <p>{trainer.bio || 'A verified trainer in the GYMIFY community.'}</p>
        <p>{trainer.serviceAreas.join(' · ') || 'Naga City'}</p>
        {trainer.gyms.map((gym) => <span className="trainer-meta" key={`${gym.name}-${gym.area}`}>{gym.name} · {gym.area}</span>)}
        <div className="tags">{trainer.specialties.map((tag) => <span key={tag}>{tag}</span>)}</div>
      </div>
    </section>

    {user?.id === id && <p className="form-notice">This is your public profile. Edit your trainer profile and availability in the <Link to="/trainer/dashboard">trainer dashboard</Link>.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}

    {!user && <section className="form-panel"><h2>Request a private connection</h2><p>Sign in as a gym-goer to request a connection. A trainer must accept before their contact information and schedule are shared.</p><Link className="button" to={`/login?next=${encodeURIComponent(`/trainers/${id}`)}`}>Sign in to connect</Link><p className="trainer-meta">Free accounts can send 5 trainer connection or session requests per month. Premium accounts can send 20.</p></section>}

    {user?.role === 'gym_goer' && !connectionPending && !connected && <section className="form-panel"><h2>Connect with {trainer.name}</h2><p>Your note goes to the trainer privately. If accepted, you can view their contact details and request a time.</p><label className="trainer-message">Message <textarea value={message} maxLength={1000} rows={3} onChange={(event) => setMessage(event.target.value)} placeholder="Tell the trainer what you are looking for." /></label><button className="button" disabled={busy} onClick={() => submitRequest('connection')}>{busy ? 'Sending...' : 'Request connection'}</button><p className="trainer-meta">Your plan allows up to {monthlyCap} combined connection and session requests per month. <Link to="/plans">Compare plans</Link>.</p></section>}
    {connectionPending && <p className="form-notice">Connection request sent. The trainer’s contact details and availability remain private until they accept.</p>}
    {connection?.status === 'declined' && <p className="form-notice">This trainer declined the connection request. You can try again next month if you still have requests available.</p>}

    {connected && <section className="trainer-private-panel">
      <h2>You’re connected</h2>
      <p>The trainer accepted your request. Their contact details and weekly availability are now visible to you.</p>
      {privateDetails?.contact && <div className="trainer-contact">
        <h3>Contact {trainer.name}</h3>
        {privateDetails.contact.contact_preference !== 'phone' && privateDetails.contact.contact_email && <p>Email: <a href={`mailto:${privateDetails.contact.contact_email}`}>{privateDetails.contact.contact_email}</a></p>}
        {privateDetails.contact.contact_preference !== 'email' && privateDetails.contact.contact_phone && <p>Phone: <a href={`tel:${privateDetails.contact.contact_phone}`}>{privateDetails.contact.contact_phone}</a></p>}
      </div>}
      <h3>Weekly availability (Asia/Manila)</h3>
      {privateDetails?.availability?.length
        ? <ul className="availability-list">{privateDetails.availability.map((slot) => <li key={slot.id || `${slot.weekday}-${slot.starts_at}`}>{weekdays[slot.weekday]} · {slot.starts_at.slice(0, 5)}–{slot.ends_at.slice(0, 5)}</li>)}</ul>
        : <p>The trainer has not added availability yet. Contact them to arrange a time.</p>}
      <h3>Request a training session</h3>
      <p>Session requests are requests only—not confirmed appointments or payments. The trainer will respond to you.</p>
      <form className="stack-form" onSubmit={(event) => { event.preventDefault(); submitRequest('session'); }}>
        <label>Proposed start time (your local time)<input type="datetime-local" value={sessionTime} onChange={(event) => setSessionTime(event.target.value)} required /></label>
        <label>Note <textarea value={message} maxLength={1000} rows={3} onChange={(event) => setMessage(event.target.value)} placeholder="Optional details for the trainer." /></label>
        <button className="button" disabled={busy}>{busy ? 'Sending...' : 'Request 1-hour session'}</button>
      </form>
      {sessionRequests.length > 0 && <div><h3>Your session requests</h3><ul className="availability-list">{sessionRequests.map((request) => <li key={request.id}>{new Date(request.requested_start).toLocaleString()} · {request.status}</li>)}</ul></div>}
      <p className="trainer-footnote">You arrange and pay the trainer directly. GYMIFY’s Premium subscription covers app features only.</p>
    </section>}
  </div>;
}
