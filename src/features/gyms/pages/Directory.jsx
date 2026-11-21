import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGyms } from '../context/GymsContext';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import SampleNote from '../components/SampleNote.jsx';
import GymCard from '../components/GymCard.jsx';

export default function Directory() {
  const { gyms, equipmentOptions, amenityOptions } = useGyms();
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get('q') || '');
  const [budget, setBudget] = useState(() => searchParams.get('budget') || '');
  const [equipment, setEquipment] = useState(() => searchParams.getAll('equipment'));
  const [amenities, setAmenities] = useState(() => searchParams.getAll('amenities'));
  const [sort, setSort] = useState(() => searchParams.get('sort') || 'featured');

  useEffect(() => {
    const next = new URLSearchParams();
    if (q.trim()) next.set('q', q.trim());
    if (budget) next.set('budget', budget);
    equipment.forEach((value) => next.append('equipment', value));
    amenities.forEach((value) => next.append('amenities', value));
    if (sort !== 'featured') next.set('sort', sort);
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [q, budget, equipment, amenities, sort, searchParams, setSearchParams]);

  const results = useMemo(() => gyms
    .filter((gym) => `${gym.name} ${gym.area} ${gym.category}`.toLowerCase().includes(q.trim().toLowerCase()))
    .filter((gym) => !budget || gym.monthly <= Number(budget))
    .filter((gym) => equipment.every((value) => gym.equipment.includes(value)))
    .filter((gym) => amenities.every((value) => gym.amenities.includes(value)))
    .sort((a, b) => sort === 'low' ? a.monthly - b.monthly : sort === 'high' ? b.monthly - a.monthly : 0),
  [gyms, q, budget, equipment, amenities, sort]);

  const activeCount = Number(Boolean(q.trim())) + Number(Boolean(budget)) + equipment.length + amenities.length;
  const sampleResults = results.length > 0 && results.every((gym) => gym.sample);
  function flip(value, values, setValues) {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }
  function reset() {
    setQ('');
    setBudget('');
    setEquipment([]);
    setAmenities([]);
    setSort('featured');
  }

  return <div className="container page">
    <span className="eyebrow">YOUR NEXT ROUTINE STARTS HERE</span>
    <h1>Find your fit in Naga.</h1>
    <p className="page-intro">Explore local gyms and compare the details that matter to you.</p>
    <SampleNote gyms={gyms} />

    <div className="directory-layout">
      <aside className="filters" aria-label="Gym search filters">
        <div className="filters-heading"><h2><SlidersHorizontal size={18} /> Refine your search</h2>{activeCount > 0 && <span className="filter-count">{activeCount} active</span>}</div>
        <label className="filter-label" htmlFor="search">Gym or area</label>
        <div className="search-input"><Search size={17} /><input id="search" placeholder="Try a name or area" value={q} onChange={(event) => setQ(event.target.value)} /></div>
        <label className="filter-label" htmlFor="budget">Monthly budget</label>
        <select id="budget" value={budget} onChange={(event) => setBudget(event.target.value)}><option value="">Any price</option><option value="1000">Up to ₱1,000</option><option value="1500">Up to ₱1,500</option><option value="2000">Up to ₱2,000</option></select>
        {[["Equipment", equipmentOptions, equipment, setEquipment], ["Amenities", amenityOptions, amenities, setAmenities]].map(([label, options, values, setValues]) => <fieldset key={label}>
          <legend>{label}</legend>
          {options.map((value) => <label className="check-label" key={value}><input type="checkbox" checked={values.includes(value)} onChange={() => flip(value, values, setValues)} />{value}</label>)}
          {!options.length && <p className="filter-help">Options will appear when gym listings are available.</p>}
        </fieldset>)}
        {activeCount > 0 && <button className="text-link reset" type="button" onClick={reset}>Clear all filters <X size={15} /></button>}
      </aside>

      <section aria-labelledby="results-title">
        <div className="results-heading">
          <p id="results-title" aria-live="polite" aria-atomic="true"><strong>{results.length}</strong> {sampleResults ? 'sample ' : ''}{results.length === 1 ? 'gym' : 'gyms'} to explore</p>
          <label>Sort by <select aria-label="Sort gyms" value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></label>
        </div>
        {activeCount > 0 && <div className="active-filters" aria-label="Active filters">
          {q.trim() && <button type="button" onClick={() => setQ('')}>Search: {q.trim()} <X size={14} aria-hidden="true" /><span className="sr-only">Remove search filter</span></button>}
          {budget && <button type="button" onClick={() => setBudget('')}>Up to ₱{Number(budget).toLocaleString()} <X size={14} aria-hidden="true" /><span className="sr-only">Remove budget filter</span></button>}
          {equipment.map((value) => <button type="button" key={value} onClick={() => flip(value, equipment, setEquipment)}>{value} <X size={14} aria-hidden="true" /><span className="sr-only">Remove equipment filter</span></button>)}
          {amenities.map((value) => <button type="button" key={value} onClick={() => flip(value, amenities, setAmenities)}>{value} <X size={14} aria-hidden="true" /><span className="sr-only">Remove amenity filter</span></button>)}
        </div>}
        <div className="directory-grid">{results.map((gym) => <GymCard gym={gym} key={gym.id} />)}</div>
        {!results.length && <div className="empty" role="status"><Search size={36} /><h2>No gyms match those filters.</h2><p>Remove a filter or try a different name, area, or budget.</p>{activeCount > 0 && <button className="button" type="button" onClick={reset}>Clear filters</button>}</div>}
      </section>
    </div>
  </div>;
}
