import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { gyms, equipmentOptions, amenityOptions } from "../data/gyms";
import SampleNote from '../components/SampleNote.jsx';
import GymCard from '../components/GymCard.jsx';
import Compare from './Compare.jsx';

export default function Directory() {
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get('q') || '');
  const [budget, setBudget] = useState('');
  const [equipment, setEquipment] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const [sort, setSort] = useState('featured');
  function flip(value, arr, set) {
    set(arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value]);
  }
  const results = gyms.filter(g => (g.name + ' ' + g.area + ' ' + g.category).toLowerCase().includes(q.toLowerCase()) && (!budget || g.monthly <= Number(budget)) && equipment.every(x => g.equipment.includes(x)) && amenities.every(x => g.amenities.includes(x))).sort((a, b) => sort === 'low' ? a.monthly - b.monthly : sort === 'high' ? b.monthly - a.monthly : 0);
  function reset() {
    setQ('');
    setBudget('');
    setEquipment([]);
    setAmenities([]);
    setSort('featured');
  }
  return <div className="container page"><span className="eyebrow">YOUR NEXT ROUTINE STARTS HERE</span><h1>Find your fit in Naga.</h1><p className="page-intro">Explore local possibilities. Compare the details that matter to you.</p><SampleNote /><div className="directory-layout"><aside className="filters"><h3><SlidersHorizontal size={18} /> Refine your search</h3><label className="filter-label" htmlFor="search">Gym or neighborhood</label><div className="search-input"><Search size={17} /><input id="search" placeholder="Search gyms…" value={q} onChange={e => setQ(e.target.value)} /></div><label className="filter-label" htmlFor="budget">Monthly budget</label><select id="budget" value={budget} onChange={e => setBudget(e.target.value)}><option value="">Any price</option><option value="1000">Up to ₱1,000</option><option value="1500">Up to ₱1,500</option><option value="2000">Up to ₱2,000</option></select>{[["Equipment", equipmentOptions, equipment, setEquipment], ["Amenities", amenityOptions, amenities, setAmenities]].map(([label, options, values, set]) => <fieldset key={label}><legend>{label}</legend>{options.map(x => <label className="check-label" key={x}><input type="checkbox" checked={values.includes(x)} onChange={() => flip(x, values, set)} />{x}</label>)}</fieldset>)}<button className="text-link reset" onClick={reset}>Reset filters <X size={14} /></button></aside><section><div className="results-heading"><p><strong>{results.length}</strong> sample {results.length === 1 ? 'gym' : 'gyms'} to explore</p><label>Sort by <select aria-label="Sort gyms" value={sort} onChange={e => setSort(e.target.value)}><option value="featured">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></label></div><div className="directory-grid">{results.map(g => <GymCard gym={g} key={g.id} />)}</div>{!results.length && <div className="empty"><Search size={36} /><h2>No gyms match just yet.</h2><p>Try a different search or adjust your filters.</p><button className="button" onClick={reset}>Clear filters</button></div>}</section></div></div>;
}
