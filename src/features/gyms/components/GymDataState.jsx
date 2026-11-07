import { useGyms } from '../context/GymsContext';

export default function GymDataState({ children }) {
  const { loading, error, retry } = useGyms();
  if (loading) return <div className="container page empty" role="status">Loading gyms...</div>;
  if (error) return <section className="container page"><div className="form-panel"><h2>We couldn�t load the gyms.</h2><p role="alert">{error}</p><button className="button" onClick={retry}>Try again</button></div></section>;
  return children;
}
