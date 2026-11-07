import SaveGymButton from './SaveGymButton';
import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, MapPin, Check, Plus } from 'lucide-react';
import { money } from '../data/gyms';
import { CompareContext } from '../context/CompareContext';

export default function GymCard({
  gym: g
}) {
  const {
    selected,
    toggle
  } = useContext(CompareContext);
  const added = selected.includes(g.id);
  return <article className="gym-card"><Link to={'/gyms/' + g.id} className="card-image"><img loading="lazy" src={g.image} alt={g.sample ? `Illustrative stock fitness photo for ${g.name}` : `${g.name} gym`} />{g.sample && <span className="sample-badge">SAMPLE LISTING</span>}<span className="card-category">{g.category}</span></Link><div className="card-body"><div className="location"><MapPin size={14} />{g.area}, Naga City</div><Link className="card-name" to={'/gyms/' + g.id}>{g.name}<ArrowUpRight size={19} /></Link><div className="tags">{g.equipment.slice(0, 2).map(x => <span key={x}>{x}</span>)}<span>+{g.equipment.length + g.amenities.length - 2} more</span></div><div className="card-bottom"><div><strong>{money(g.monthly)}</strong><span> / month</span><small>{g.sample ? 'Sample monthly rate' : 'Monthly membership'}</small></div><button className={'compare-add ' + (added ? 'added' : '')} onClick={() => toggle(g.id)} aria-label={`${added ? 'Remove' : 'Add'} ${g.name} ${added ? 'from' : 'to'} comparison`}>{added ? <Check size={15} /> : <Plus size={15} />} {added ? 'Added' : 'Compare'}</button></div></div><SaveGymButton gym={g} /></article>;
}
