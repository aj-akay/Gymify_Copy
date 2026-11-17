import { RefreshCw } from 'lucide-react';
import { useGyms } from '../context/GymsContext';

export default function GymDataState({ children }) {
  const { loading, error, retry } = useGyms();
  if (loading) return <div className="gym-loading" role="status" aria-live="polite"><span className="loading-spinner" aria-hidden="true" />Loading gym listings…</div>;
  if (error) return <section className="gym-error" aria-labelledby="gym-error-title"><div className="form-panel"><span className="eyebrow">LISTINGS UNAVAILABLE</span><h2 id="gym-error-title">We couldn’t load the gyms.</h2><p role="alert">{error}</p><button className="button" onClick={retry}><RefreshCw size={16} /> Try again</button></div></section>;
  return children;
}
