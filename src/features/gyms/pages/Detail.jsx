import { useGyms } from '../context/GymsContext';
import SaveGymButton from '../components/SaveGymButton';
import { useContext } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowUpRight, MapPin, Dumbbell, Check, Plus, Clock } from 'lucide-react';
import { money } from '../data/gyms';
import { CompareContext } from '../context/CompareContext';
import SampleNote from '../components/SampleNote.jsx';

export default function Detail() {
  const { gyms } = useGyms();
  const {
    id
  } = useParams();
  const g = gyms.find(x => x.id === id);
  const {
    selected,
    toggle
  } = useContext(CompareContext);
  if (!g) return <div className="container empty"><h1>Gym not found</h1><Link className="button" to="/gyms">Explore gyms</Link></div>;
  return <div className="container page"><Link className="text-link back" to="/gyms">← All gyms</Link><SampleNote gyms={[g]} /><div className="detail-heading"><div><span className="eyebrow">{g.category} · {g.sample ? 'SAMPLE LISTING' : 'GYMIFY LISTING'}</span><h1>{g.name}</h1><p className="location"><MapPin size={17} />{g.area}, Naga City</p></div><button className="button" onClick={() => toggle(g.id)}>{selected.includes(g.id) ? <Check size={18} /> : <Plus size={18} />} {selected.includes(g.id) ? 'Added to comparison' : 'Add to comparison'}</button></div><img className="detail-photo" src={g.image} alt={g.sample ? 'Illustrative stock gym photo; not the actual venue' : `Gym interior at ${g.name}`} /><p className="caption">{g.sample ? 'Illustrative stock photo — does not depict an actual listed venue.' : 'Gym photo.'}</p><div className="detail-save"><SaveGymButton gym={g} /></div><div className="detail-grid"><div><section><h2>Room for your next chapter.</h2><p>{g.description}</p></section><section><h2>Equipment</h2><div className="feature-list">{g.equipment.map(x => <span key={x}><Dumbbell size={18} />{x}</span>)}</div></section><section><h2>Amenities</h2><div className="feature-list">{g.amenities.map(x => <span key={x}><Check size={18} />{x}</span>)}</div></section><section><h2>Location & hours</h2><p><MapPin size={17} /> {g.address}</p><p><Clock size={17} /> {g.hours}</p><a className="text-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(g.area + ', Naga City Philippines')}`} target="_blank" rel="noreferrer">{g.sample ? 'Explore sample area on Google Maps' : 'Explore this area on Google Maps'} <ArrowUpRight size={17} /></a>{g.sample && <p className="caption">Area search only. A verified gym address is not available.</p>}</section></div><aside className="rates"><span className="eyebrow">{g.sample ? 'SAMPLE RATES' : 'MEMBERSHIP RATES'}</span><h2>A routine within reach.</h2><div className="rate-line"><span>Monthly membership</span><strong>{money(g.monthly)}</strong></div><div className="rate-line"><span>Day pass</span><strong>{money(g.day)}</strong></div><p>{g.sample ? 'Illustrative prices only. No membership or booking is available through this demo.' : 'GYMIFY does not collect gym membership payments. Contact the gym to confirm current rates.'}</p><hr /><h3>Contact the gym</h3>{g.contactUrl ? <a className="button" href={g.contactUrl}>Contact gym <ArrowUpRight size={18} /></a> : <p>Contact links are not available for this listing yet.</p>}</aside></div></div>;
}
