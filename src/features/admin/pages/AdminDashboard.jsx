import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Building2, Check, Clock3, Dumbbell, RefreshCw, X } from 'lucide-react';
import { memberRequest } from '../../../services/memberApi';
import { useAuth } from '../../auth/context/AuthContext';
import { useToast } from '../../../shared/contexts/ToastContext';

const trainerFilters = [
  { value: 'pending', label: 'Needs review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];
const inquiryFilters = [
  { value: 'pending', label: 'New' },
  { value: 'under_review', label: 'Under review' },
  { value: 'approved', label: 'Approved' },
  { value: 'declined', label: 'Declined' },
];
const inquiryStatusLabels = { pending: 'Received', under_review: 'Under review', approved: 'Approved', declined: 'Declined' };

function formatDate(value) {
  if (!value) return 'Date unavailable';
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminDashboard({ initialSection = 'overview' }) {
  const { user } = useAuth();
  const notify = useToast();
  const [section, setSection] = useState(initialSection);
  const [trainerFilter, setTrainerFilter] = useState('pending');
  const [inquiryFilter, setInquiryFilter] = useState('pending');
  const [trainers, setTrainers] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const [lastChecked, setLastChecked] = useState(null);
  const hasLoaded = useRef(false);
  const lastPendingIds = useRef({ trainers: new Set(), inquiries: new Set() });

  useEffect(() => setSection(initialSection), [initialSection]);

  const load = useCallback(async ({ announce = true } = {}) => {
    const [trainerResult, inquiryResult] = await Promise.all([
      memberRequest('/admin/trainers'),
      memberRequest('/admin/partnership-inquiries'),
    ]);
    const nextTrainers = Array.isArray(trainerResult) ? trainerResult : [];
    const nextInquiries = Array.isArray(inquiryResult) ? inquiryResult : [];
    const pendingTrainerIds = new Set(nextTrainers.filter((item) => item.verification_status === 'pending').map((item) => item.user_id));
    const pendingInquiryIds = new Set(nextInquiries.filter((item) => ['pending', 'under_review'].includes(item.status)).map((item) => item.id));
    if (announce && hasLoaded.current) {
      const newTrainers = [...pendingTrainerIds].filter((id) => !lastPendingIds.current.trainers.has(id)).length;
      const newInquiries = [...pendingInquiryIds].filter((id) => !lastPendingIds.current.inquiries.has(id)).length;
      const messages = [];
      if (newTrainers) messages.push(`${newTrainers} new trainer ${newTrainers === 1 ? 'profile' : 'profiles'}`);
      if (newInquiries) messages.push(`${newInquiries} new gym ${newInquiries === 1 ? 'inquiry' : 'inquiries'}`);
      if (messages.length) notify(`${messages.join(' and ')} need your review.`, 'info');
    }
    hasLoaded.current = true;
    lastPendingIds.current = { trainers: pendingTrainerIds, inquiries: pendingInquiryIds };
    setTrainers(nextTrainers);
    setInquiries(nextInquiries);
    setLastChecked(new Date());
    setError('');
  }, [notify]);

  useEffect(() => {
    if (user?.role !== 'admin') {
      setLoading(false);
      return undefined;
    }
    let active = true;
    const refresh = async (quiet = false) => {
      try {
        await load({ announce: !quiet });
      } catch (loadError) {
        if (active) setError(loadError.message || 'Could not load admin requests. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void refresh(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(false);
    }, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [load, user?.role]);

  const pendingTrainers = trainers.filter((item) => item.verification_status === 'pending').length;
  const pendingInquiries = inquiries.filter((item) => ['pending', 'under_review'].includes(item.status)).length;
  const newInquiries = inquiries.filter((item) => item.status === 'pending').length;
  const reviewingInquiries = inquiries.filter((item) => item.status === 'under_review').length;
  const totalPending = pendingTrainers + pendingInquiries;
  const visibleTrainers = useMemo(() => trainers.filter((item) => item.verification_status === trainerFilter), [trainers, trainerFilter]);
  const visibleInquiries = useMemo(() => inquiries.filter((item) => item.status === inquiryFilter), [inquiries, inquiryFilter]);

  async function refreshNow() {
    setRefreshing(true);
    try {
      await load({ announce: false });
      notify('Admin requests are up to date.');
    } catch (loadError) {
      const message = loadError.message || 'Could not refresh requests. Please try again.';
      setError(message);
      notify(message, 'error');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  async function reviewTrainer(trainer, status) {
    const key = `trainer:${trainer.user_id}`;
    setBusyKey(key);
    setError('');
    try {
      await memberRequest(`/admin/trainers/${trainer.user_id}`, { method: 'PATCH', body: { status } });
      await load({ announce: false });
      notify(`${trainer.display_name}'s profile was ${status}.`);
    } catch (actionError) {
      const message = actionError.message || 'Could not update this trainer profile.';
      setError(message);
      notify(message, 'error');
    } finally {
      setBusyKey('');
    }
  }

  async function reviewInquiry(inquiry, status) {
    const key = `inquiry:${inquiry.id}`;
    setBusyKey(key);
    setError('');
    try {
      const result = await memberRequest(`/admin/partnership-inquiries/${inquiry.id}`, { method: 'PATCH', body: { status } });
      await load({ announce: false });
      notify(result?.emailDelivery?.owner
        ? `Inquiry from ${inquiry.gym_name} marked ${inquiryStatusLabels[status] || status}. The owner was emailed.`
        : `Inquiry from ${inquiry.gym_name} marked ${inquiryStatusLabels[status] || status}. Email update was not sent; check the email configuration.`,
      result?.emailDelivery?.owner ? 'success' : 'info');
    } catch (actionError) {
      const message = actionError.message || 'Could not update this gym inquiry.';
      setError(message);
      notify(message, 'error');
    } finally {
      setBusyKey('');
    }
  }

  if (user?.role !== 'admin') {
    return <div className="container page"><span className="eyebrow">RESTRICTED AREA</span><h1>Admin access required.</h1><p>This page is available to GYMIFY administrators.</p><Link className="button button-secondary" to="/">Return to GYMIFY</Link></div>;
  }

  return <div className="container page admin-reviews">
    <span className="eyebrow">GYMIFY ADMIN</span>
    <h1>Admin dashboard</h1>
    <p className="page-intro">Review trainer profiles and respond to gym partnership inquiries from one place.</p>

    <div className={`admin-notification-bar ${totalPending ? 'has-pending' : 'all-clear'}`} role="status" aria-live="polite">
      <span className="admin-notification-icon"><Bell size={20} aria-hidden="true" /></span>
      <div className="admin-notification-copy">
        <strong>{loading ? 'Checking for new requests…' : error && !lastChecked ? 'Could not check for new requests' : totalPending ? `${totalPending} item${totalPending === 1 ? '' : 's'} need your attention` : 'You’re all caught up'}</strong>
        <span>{loading ? 'Loading the latest submissions.' : `${pendingTrainers} trainer ${pendingTrainers === 1 ? 'profile' : 'profiles'} · ${pendingInquiries} open gym ${pendingInquiries === 1 ? 'inquiry' : 'inquiries'}${lastChecked ? ` · checked ${lastChecked.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}`}</span>
      </div>
      <button className="admin-refresh-button" type="button" onClick={refreshNow} disabled={refreshing || loading}>
        <RefreshCw size={16} className={refreshing ? 'is-spinning' : ''} aria-hidden="true" />{refreshing ? 'Checking…' : 'Refresh'}
      </button>
    </div>

    {error && <p className="form-error" role="alert">{error}</p>}

    <nav className="admin-dashboard-tabs" aria-label="Admin dashboard sections">
      <button type="button" className={section === 'overview' ? 'active' : ''} aria-pressed={section === 'overview'} onClick={() => setSection('overview')}>Overview</button>
      <button type="button" className={section === 'trainers' ? 'active' : ''} aria-pressed={section === 'trainers'} onClick={() => setSection('trainers')}>Trainer profiles <span>{pendingTrainers}</span></button>
      <button type="button" className={section === 'inquiries' ? 'active' : ''} aria-pressed={section === 'inquiries'} onClick={() => setSection('inquiries')}>Gym inquiries <span>{pendingInquiries}</span></button>
    </nav>

    {section === 'overview' && <section className="admin-overview" aria-labelledby="admin-overview-title">
      <h2 id="admin-overview-title">Review queue</h2>
      <div className="admin-overview-grid">
        <article className="admin-overview-card">
          <span className="admin-overview-icon"><Dumbbell size={20} aria-hidden="true" /></span>
          <p>Trainer profiles</p><strong>{pendingTrainers}</strong><small>{pendingTrainers ? 'Waiting for approval' : 'No profiles waiting'}</small>
          <button type="button" className="text-link" onClick={() => setSection('trainers')}>Review profiles <span aria-hidden="true">→</span></button>
        </article>
        <article className="admin-overview-card">
          <span className="admin-overview-icon"><Building2 size={20} aria-hidden="true" /></span>
          <p>Gym partnership inquiries</p><strong>{pendingInquiries}</strong><small>{pendingInquiries ? `${newInquiries} new · ${reviewingInquiries} under review` : 'No inquiries waiting'}</small>
          <button type="button" className="text-link" onClick={() => setSection('inquiries')}>View inquiries <span aria-hidden="true">→</span></button>
        </article>
      </div>
      <p className="admin-refresh-note"><Clock3 size={15} aria-hidden="true" /> New items refresh automatically while this page is open.</p>
    </section>}

    {section === 'trainers' && <section aria-labelledby="admin-trainers-title">
      <div className="admin-section-heading"><div><h2 id="admin-trainers-title">Trainer profiles</h2><p>Approve profiles to make them visible in trainer discovery.</p></div></div>
      <div className="admin-review-filters" aria-label="Filter trainer profiles">
        {trainerFilters.map((item) => <button type="button" key={item.value} className={trainerFilter === item.value ? 'active' : ''} aria-pressed={trainerFilter === item.value} onClick={() => setTrainerFilter(item.value)}>
          {item.label}{item.value === 'pending' && <span className="admin-review-count">{pendingTrainers}</span>}
        </button>)}
      </div>
      {loading ? <p role="status">Loading trainer profiles…</p> : !visibleTrainers.length ? <div className="admin-review-empty"><h2>{trainerFilter === 'pending' ? 'You’re all caught up.' : `No ${trainerFilter} profiles.`}</h2><p>{trainerFilter === 'pending' ? 'New trainer profiles will appear here.' : 'Profiles with this status will appear here.'}</p></div> :
        <div className="admin-review-list">{visibleTrainers.map((trainer) => {
          const key = `trainer:${trainer.user_id}`;
          return <article className="admin-review-card" key={trainer.user_id}>
            <div className="admin-review-heading">
              {trainer.avatar_url ? <img src={trainer.avatar_url} alt="" /> : <div className="admin-review-avatar" aria-hidden="true">{trainer.display_name.slice(0, 1).toUpperCase()}</div>}
              <div><span className={`admin-review-status status-${trainer.verification_status}`}>{trainer.verification_status}</span><h3>{trainer.display_name}</h3><p>Updated {formatDate(trainer.updated_at)}</p></div>
            </div>
            <p className="admin-review-bio">{trainer.bio || 'No bio provided.'}</p>
            <div className="admin-review-details">
              <div><strong>Specialties</strong><span>{trainer.specialties?.length ? trainer.specialties.join(', ') : 'Not provided'}</span></div>
              <div><strong>Service areas</strong><span>{trainer.service_areas?.length ? trainer.service_areas.join(', ') : 'Not provided'}</span></div>
            </div>
            <div className="admin-review-actions">
              {trainer.verification_status !== 'approved' && <button className="button" disabled={Boolean(busyKey)} onClick={() => reviewTrainer(trainer, 'approved')}><Check size={16} />{busyKey === key ? 'Updating…' : 'Approve profile'}</button>}
              {trainer.verification_status !== 'rejected' && <button className="button button-secondary" disabled={Boolean(busyKey)} onClick={() => reviewTrainer(trainer, 'rejected')}><X size={16} />{busyKey === key ? 'Updating…' : 'Reject profile'}</button>}
            </div>
          </article>;
        })}</div>}
    </section>}

    {section === 'inquiries' && <section aria-labelledby="admin-inquiries-title">
      <div className="admin-section-heading"><div><h2 id="admin-inquiries-title">Gym partnership inquiries</h2><p>Mark submissions received, move them into review, then approve or decline. Approval records the inquiry review; it does not create a gym listing or account.</p></div></div>
      <div className="admin-review-filters" aria-label="Filter gym inquiries">
        {inquiryFilters.map((item) => <button type="button" key={item.value} className={inquiryFilter === item.value ? 'active' : ''} aria-pressed={inquiryFilter === item.value} onClick={() => setInquiryFilter(item.value)}>
          {item.label}{item.value === 'pending' && <span className="admin-review-count">{newInquiries}</span>}{item.value === 'under_review' && <span className="admin-review-count">{reviewingInquiries}</span>}
        </button>)}
      </div>
      {loading ? <p role="status">Loading gym inquiries…</p> : !visibleInquiries.length ? <div className="admin-review-empty"><h2>{inquiryFilter === 'pending' ? 'No new inquiries.' : `No ${inquiryFilter} inquiries.`}</h2><p>New gym partnership submissions will appear here.</p></div> :
        <div className="admin-review-list">{visibleInquiries.map((inquiry) => {
          const key = `inquiry:${inquiry.id}`;
          return <article className="admin-review-card admin-inquiry-card" key={inquiry.id}>
            <div className="admin-review-heading">
              <div className="admin-review-avatar"><Building2 size={23} aria-hidden="true" /></div>
              <div><span className={`admin-review-status status-${inquiry.status === 'declined' ? 'rejected' : inquiry.status}`}>{inquiryStatusLabels[inquiry.status] || inquiry.status}</span><h3>{inquiry.gym_name}</h3><p>Received {formatDate(inquiry.created_at)}{inquiry.reviewed_at ? ` · updated ${formatDate(inquiry.reviewed_at)}` : ''}</p></div>
            </div>
            <div className="admin-review-details">
              <div><strong>Contact</strong><span>{inquiry.contact_name}</span></div>
              <div><strong>Email</strong><a href={`mailto:${inquiry.email}`}>{inquiry.email}</a></div>
              <div><strong>Phone</strong><span>{inquiry.phone || 'Not provided'}</span></div>
              <div><strong>Area</strong><span>{inquiry.location}</span></div>
            </div>
            {inquiry.message && <p className="admin-review-bio">{inquiry.message}</p>}
            <div className="admin-review-actions">
              {inquiry.status === 'pending' && <button className="button button-secondary" disabled={Boolean(busyKey)} onClick={() => reviewInquiry(inquiry, 'under_review')}><Clock3 size={16} />{busyKey === key ? 'Updating…' : 'Start review'}</button>}
              {inquiry.status !== 'approved' && <button className="button" disabled={Boolean(busyKey)} onClick={() => reviewInquiry(inquiry, 'approved')}><Check size={16} />{busyKey === key ? 'Updating…' : 'Approve inquiry'}</button>}
              {inquiry.status !== 'declined' && inquiry.status !== 'approved' && <button className="button button-secondary" disabled={Boolean(busyKey)} onClick={() => reviewInquiry(inquiry, 'declined')}><X size={16} />{busyKey === key ? 'Updating…' : 'Decline'}</button>}
              {inquiry.status === 'declined' && <button className="button button-secondary" disabled={Boolean(busyKey)} onClick={() => reviewInquiry(inquiry, 'under_review')}><Clock3 size={16} />{busyKey === key ? 'Updating…' : 'Reopen review'}</button>}
            </div>
          </article>;
        })}</div>}
    </section>}
  </div>;
}
