import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { memberRequest } from '../../../services/memberApi';
import { useAuth } from '../../auth/context/AuthContext';

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const emptySlots = weekdays.map((_, weekday) => ({ weekday, startsAt: '', endsAt: '', timezone: 'Asia/Manila' }));

export default function TrainerDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [slots, setSlots] = useState(emptySlots);
  const [contact, setContact] = useState({ contactEmail: '', contactPhone: '', contactPreference: 'email' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [trainerProfile, trainerRequests] = await Promise.all([
      memberRequest('/me/trainer-profile'),
      memberRequest('/me/trainer-requests'),
    ]);
    setProfile(trainerProfile);
    setRequests(trainerRequests.filter((request) => request.trainer_id === user.id));
    setContact({
      contactEmail: trainerProfile.contact?.contact_email || '',
      contactPhone: trainerProfile.contact?.contact_phone || '',
      contactPreference: trainerProfile.contact?.contact_preference || 'email',
    });
    const nextSlots = emptySlots.map((slot) => ({ ...slot }));
    for (const slot of trainerProfile.availability || []) {
      nextSlots[slot.weekday] = {
        ...slot,
        startsAt: slot.starts_at.slice(0, 5),
        endsAt: slot.ends_at.slice(0, 5),
      };
    }
    setSlots(nextSlots);
  }, [user.id]);

  useEffect(() => {
    load().catch((requestError) => setError(requestError.message || 'Could not load your trainer dashboard.'));
  }, [load]);

  async function saveProfile(event) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    setNotice('');
    if (slots.some((slot) => Boolean(slot.startsAt) !== Boolean(slot.endsAt))) {
      setError('Choose both a start and end time for each availability day.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await memberRequest('/me/trainer-profile', { method: 'PUT', body: {
        bio: form.bio,
        specialties: form.specialties.split(',').map((item) => item.trim()).filter(Boolean),
        serviceAreas: form.serviceAreas.split(',').map((item) => item.trim()).filter(Boolean),
        avatarUrl: form.avatarUrl.trim(),
      } });
      await memberRequest('/me/trainer-contact', { method: 'PUT', body: contact });
      await memberRequest('/me/trainer-availability', { method: 'PUT', body: {
        slots: slots.filter((slot) => slot.startsAt && slot.endsAt)
          .map(({ weekday, startsAt, endsAt, timezone }) => ({ weekday, startsAt, endsAt, timezone })),
      } });
      await load();
      setNotice('Your profile and weekly availability were saved.');
    } catch (requestError) {
      setError(requestError.message || 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  async function updateRequest(request, status) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await memberRequest(`/me/trainer-requests/${request.id}`, { method: 'PATCH', body: { status } });
      await load();
      setNotice(`Request ${status}.`);
    } catch (requestError) {
      setError(requestError.message || 'Could not update request.');
    } finally {
      setBusy(false);
    }
  }

  if (user?.role !== 'trainer') {
    return <div className="container page"><h1>Trainer account required.</h1><p>Choose Trainer when creating an account to use this dashboard.</p><Link className="button" to="/signup">Create a trainer account</Link></div>;
  }
  if (!profile && !error) return <div className="container page" role="status">Loading your trainer dashboard...</div>;

  return <div className="container page trainer-dashboard">
    <span className="eyebrow">YOUR TRAINER SPACE</span>
    <h1>Trainer dashboard.</h1>
    <p className="page-intro">Your profile appears in discovery after the GYMIFY team verifies it. Contact details and availability are shared only after you accept a connection.</p>
    {profile?.verification_status !== 'approved' && <p className="form-notice">Your profile is {profile?.verification_status || 'pending review'}. It is not visible publicly until approved.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="form-success" role="status">{notice}</p>}
    {profile && <form className="form-panel stack-form" onSubmit={saveProfile}>
      <h2>Public profile</h2>
      <p>Your name comes from your account. Do not include private contact details in your bio.</p>
      <label>Bio<textarea name="bio" rows={4} maxLength={2000} defaultValue={profile.bio} /></label>
      <label>Specialties <span className="optional">(comma separated)</span><input name="specialties" maxLength={1200} defaultValue={profile.specialties.join(', ')} /></label>
      <label>Service areas <span className="optional">(comma separated)</span><input name="serviceAreas" maxLength={1200} defaultValue={profile.service_areas.join(', ')} /></label>
      <label>Profile image URL <span className="optional">(optional)</span><input name="avatarUrl" type="url" maxLength={2048} defaultValue={profile.avatar_url || ''} /></label>
      <h2>Private contact and availability</h2>
      <p>These details are shown only to gym-goers whose connection requests you accept.</p>
      <label>Preferred contact
        <select value={contact.contactPreference} onChange={(event) => setContact({ ...contact, contactPreference: event.target.value })}>
          <option value="email">Email</option><option value="phone">Phone</option><option value="either">Email or phone</option>
        </select>
      </label>
      <label>Contact email<input type="email" maxLength={254} value={contact.contactEmail || ''} onChange={(event) => setContact({ ...contact, contactEmail: event.target.value })} /></label>
      <label>Contact phone<input type="tel" maxLength={30} value={contact.contactPhone || ''} onChange={(event) => setContact({ ...contact, contactPhone: event.target.value })} /></label>
      <fieldset className="availability-editor"><legend>Weekly availability (Asia/Manila)</legend>
        {slots.map((slot) => <div className="availability-row" key={slot.weekday}>
          <span>{weekdays[slot.weekday]}</span>
          <label>From<input type="time" value={slot.startsAt} onChange={(event) => setSlots(current => current.map(item => item.weekday === slot.weekday ? { ...item, startsAt: event.target.value } : item))} /></label>
          <label>To<input type="time" value={slot.endsAt} onChange={(event) => setSlots(current => current.map(item => item.weekday === slot.weekday ? { ...item, endsAt: event.target.value } : item))} /></label>
        </div>)}
      </fieldset>
      <button className="button" disabled={busy}>{busy ? 'Saving...' : 'Save trainer profile'}</button>
    </form>}
    <section className="trainer-requests">
      <h2>Connection and session requests</h2>
      {!requests.length && <p>No requests yet.</p>}
      {requests.map((request) => <article className="request-card" key={request.id}>
        <span className="eyebrow">{request.kind} · {request.status}</span>
        <h3>{request.requesterName || 'Gym-goer'}</h3>
        {request.message && <p>{request.message}</p>}
        {request.requested_start && <p>Proposed: {new Date(request.requested_start).toLocaleString()} – {new Date(request.requested_end).toLocaleTimeString()}</p>}
        {request.status === 'pending' && <div className="request-actions">
          <button className="button" disabled={busy} onClick={() => updateRequest(request, 'accepted')}>Accept</button>
          <button className="button button-secondary" disabled={busy} onClick={() => updateRequest(request, 'declined')}>Decline</button>
        </div>}
      </article>)}
    </section>
  </div>;
}
