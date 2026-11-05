import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowRight, X, Check, Plus, GitCompareArrows } from 'lucide-react';
import { gyms, money } from "../data/gyms";
import { CompareContext } from '../contexts/CompareContext';
import SampleNote from '../components/SampleNote.jsx';

export default function Compare() {
  const {
    selected,
    toggle
  } = useContext(CompareContext);
  const chosen = selected.map(id => gyms.find(g => g.id === id));
  return <div className="container page"><span className="eyebrow">MAKE YOUR NEXT MOVE WITH CLARITY</span><h1>Find your kind of fit.</h1><p className="page-intro">Choose 2–3 gyms and compare the essentials, side by side.</p><SampleNote /><div className="compare-picker">{gyms.map(g => <button key={g.id} onClick={() => toggle(g.id)} className={selected.includes(g.id) ? 'selected' : ''} aria-pressed={selected.includes(g.id)}>{selected.includes(g.id) ? <Check size={16} /> : <Plus size={16} />} {g.name}</button>)}</div>{chosen.length < 2 ? <div className="empty"><GitCompareArrows size={40} /><h2>{chosen.length ? 'One more to get the full picture.' : 'A better fit starts with a little comparison.'}</h2><p>Select {chosen.length ? 'another gym' : '2–3 gyms'} above to compare sample rates, facilities, and hours.</p><Link className="text-link" to="/gyms">Explore the directory <ArrowRight size={18} /></Link></div> : <div className="table-scroll" tabIndex="0" aria-label="Gym comparison; scroll horizontally on smaller screens"><table><caption>Sample gym comparison — all details are illustrative</caption><thead><tr><th scope="col">The essentials</th>{chosen.map(g => <th key={g.id} scope="col"><img src={g.image} alt="Illustrative fitness stock photo" /><Link to={'/gyms/' + g.id}>{g.name} <ArrowUpRight size={15} /></Link><button className="remove" onClick={() => toggle(g.id)} aria-label={'Remove ' + g.name}><X size={16} /></button></th>)}</tr></thead><tbody>{[['Monthly rate', g => money(g.monthly)], ['Day pass', g => money(g.day)], ['Neighborhood', g => g.area], ['Equipment', g => g.equipment.join(' · ')], ['Amenities', g => g.amenities.join(' · ')], ['Operating hours', g => g.hours]].map(([label, fn]) => <tr key={label}><th scope="row">{label}</th>{chosen.map(g => <td key={g.id}>{fn(g)}</td>)}</tr>)}</tbody></table></div>}</div>;
}
