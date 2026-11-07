import { useGyms } from '../context/GymsContext';
import { Link } from 'react-router-dom';
import { useSavedGyms } from '../context/SavedContext';
import GymCard from '../components/GymCard';

export default function Saved() {
  const { gyms } = useGyms();
  const { savedIds, loading, error, retry } = useSavedGyms();
  const saved = gyms.filter(g => savedIds.includes(g.id));
  const unavailable = savedIds.filter(id => !gyms.some(g => g.id === id));
  return <section className="container page">
    <span className="eyebrow">YOUR OWN TRAINING SHORTLIST</span><h1>Saved gyms.</h1>
    <p className="page-intro">Keep your favorites together while you find your fit.</p>
    {loading ? <p role="status">Loading saved gyms...</p> : error ? <div className="form-panel"><p className="form-error" role="alert">{error}</p><button className="button" onClick={retry}>Try again</button></div> : <>
      {Boolean(unavailable.length) && <p className="form-notice">Some saved listings are no longer available in the current directory.</p>}
      {saved.length ? <div className="gym-grid">{saved.map(g => <GymCard key={g.id} gym={g} />)}</div> : <div className="empty"><h2>Your shortlist starts here.</h2><p>Save a gym from its card or detail page, then return here.</p><Link className="button" to="/gyms">Explore gyms</Link></div>}
    </>}
  </section>;
}
