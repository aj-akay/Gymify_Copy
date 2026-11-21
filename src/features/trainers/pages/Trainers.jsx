import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Search } from 'lucide-react';
import { fetchApi } from '../../../services/api';
import DemoTrainerCard from '../components/DemoTrainerCard';

export default function Trainers() {
  const [query, setQuery] = useState('');
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setLoading(true);
      setError('');
      fetchApi(`/trainers?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((data) => {
          if (!Array.isArray(data)) throw new Error('Trainer listings are temporarily unavailable. Please try again.');
          setTrainers(data);
        })
        .catch((requestError) => {
          if (requestError.name !== 'AbortError') {
            const message = requestError.message || 'Could not load trainer profiles. Please try again.';
            setError(message);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, revision]);

  return <div className="container page trainer-directory">
    <span className="eyebrow">FIND YOUR TRAINING PARTNER</span>
    <h1>Meet trainers in Naga.</h1>
    <p className="page-intro">Explore verified trainer profiles and request a private connection. Contact details and availability stay private until a trainer accepts.</p>
    <label className="trainer-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search specialties or area" aria-label="Search trainers" /></label>
    {error && <div className="form-error trainer-error" role="alert"><p>{error}</p><button className="button" type="button" onClick={() => setRevision((value) => value + 1)}>Try again</button></div>}
    {loading && <p className="trainer-loading" role="status" aria-live="polite"><span className="loading-spinner" aria-hidden="true" />Finding trainers…</p>}
    {!loading && !error && !trainers.length && <div className="empty trainer-empty" role="status"><h2>{query.trim() ? 'No verified trainers match that search.' : 'No verified trainers listed yet.'}</h2><p>{query.trim() ? 'Try a different specialty or area. You can still preview the demo trainer above.' : 'Try the demo profile above to see how connection and schedule access work.'}</p>{query.trim() && <button className="button button-secondary" type="button" onClick={() => setQuery('')}>Clear search</button>}</div>}
    {!loading && !error && trainers.length > 0 && <p className="trainer-results" aria-live="polite">{trainers.length} verified {trainers.length === 1 ? 'trainer profile' : 'trainer profiles'}</p>}
    <div className="trainer-grid">
      <DemoTrainerCard />
      {!error && trainers.map((trainer) => <article className="trainer-card" key={trainer.id}>
        {trainer.avatarUrl
          ? <img className="trainer-avatar" src={trainer.avatarUrl} alt="" />
          : <div className="trainer-avatar trainer-avatar-placeholder" aria-hidden="true">{trainer.name.slice(0, 1).toUpperCase()}</div>}
        <div className="trainer-card-body">
          <h2>{trainer.name}</h2>
          <p>{trainer.bio || 'Verified GYMIFY trainer'}</p>
          <p className="trainer-meta">{trainer.serviceAreas.join(' · ') || 'Naga City'}</p>
          {trainer.gyms.length > 0 && <p className="trainer-meta">Works with {trainer.gyms.map((gym) => gym.name).join(', ')}</p>}
          <div className="tags">{trainer.specialties.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div>
          <Link className="text-link" to={`/trainers/${trainer.id}`}>View profile <ArrowUpRight size={16} /></Link>
        </div>
      </article>)}
    </div>
    <p className="trainer-footnote">Trainer profiles are reviewed before appearing publicly. GYMIFY helps you connect; trainers and gym-goers arrange and pay for training directly.</p>
  </div>;
}
