import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Search } from 'lucide-react';
import { fetchApi } from '../../../services/api';

export default function Trainers() {
  const [query, setQuery] = useState('');
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setLoading(true);
      setError('');
      fetchApi(`/trainers?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(setTrainers)
        .catch((requestError) => {
          if (requestError.name !== 'AbortError') setError(requestError.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  return <div className="container page trainer-directory">
    <span className="eyebrow">FIND YOUR TRAINING PARTNER</span>
    <h1>Meet trainers in Naga.</h1>
    <p className="page-intro">Explore verified trainer profiles and request a private connection. Contact details and availability stay private until a trainer accepts.</p>
    <label className="trainer-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search specialties or area" aria-label="Search trainers" /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading && <p role="status">Finding trainers...</p>}
    {!loading && !error && !trainers.length && <div className="empty"><h2>No trainers listed yet.</h2><p>Verified trainer profiles will appear here as they join GYMIFY.</p></div>}
    <div className="trainer-grid">
      {trainers.map((trainer) => <article className="trainer-card" key={trainer.id}>
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
