import React, { createContext, useContext, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useLocation, useParams } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Building2, Check, Clock, Dumbbell, GitCompareArrows,
  MapPin, Menu, Plus, Search, ShieldCheck, SlidersHorizontal, Users, X,
} from 'lucide-react';
import { fetchApi } from './api';
import { heroImage, money } from './data/gyms';
import './styles.css';

const CompareContext = createContext(null);

function readSavedComparison() {
  try {
    const saved = JSON.parse(localStorage.getItem('gymify-compare') || '[]');
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string').slice(0, 3) : [];
  } catch {
    return [];
  }
}

function useApiResource(path) {
  const [attempt, setAttempt] = useState(0);
  const [resource, setResource] = useState({ data: null, error: null, loading: true });

  useEffect(() => {
    const controller = new AbortController();
    setResource({ data: null, error: null, loading: true });
    fetchApi(path, { signal: controller.signal })
      .then((data) => setResource({ data, error: null, loading: false }))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setResource({ data: null, error: error.message, errorCode: error.code, status: error.status, loading: false });
        }
      });
    return () => controller.abort();
  }, [path, attempt]);

  return { ...resource, retry: () => setAttempt((value) => value + 1) };
}

function App() {
  const [selected, setSelected] = useState(readSavedComparison);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('gymify-compare', JSON.stringify(selected));
    } catch {
      setNotice('Comparison changes could not be saved in this browser.');
    }
  }, [selected]);

  function toggle(id) {
    if (selected.includes(id)) {
      setSelected((current) => current.filter((value) => value !== id));
    } else if (selected.length < 3) {
      setSelected((current) => [...current, id]);
    } else {
      setNotice('You can compare up to 3 gyms. Remove one to add another.');
    }
  }

  return (
    <CompareContext.Provider value={{ selected, toggle, setSelected }}>
      <BrowserRouter>
        <ScrollTop />
        <Navbar />
        <main id="main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/gyms" element={<Directory />} />
            <Route path="/gyms/:id" element={<Detail />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="*" element={<div className="container empty"><h1>Page not found.</h1><Link className="button" to="/">Back home <ArrowRight /></Link></div>} />
          </Routes>
        </main>
        <Footer />
        {notice && <div className="toast" role="alert">{notice}<button aria-label="Dismiss" onClick={() => setNotice('')}><X size={18} /></button></div>}
      </BrowserRouter>
    </CompareContext.Provider>
  );
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = pathname === '/'
      ? 'GYMIFY — Find your fit in Naga'
      : `GYMIFY — ${pathname.startsWith('/gyms/') ? 'Sample gym details' : pathname.slice(1).replace(/^./, (character) => character.toUpperCase())}`;
  }, [pathname]);
  return null;
}

function Brand() {
  return <Link to="/" className="brand" aria-label="Gymify home"><span className="brand-icon"><Dumbbell size={22} /></span>GYMIFY<span className="brand-dot">.</span></Link>;
}

function Navbar() {
  const [open, setOpen] = useState(false);
  const { selected } = useContext(CompareContext);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
      <header>
        <div className="container nav">
          <Brand />
          <button className="menu-toggle icon-button" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
          <nav className={open ? 'nav-links open' : 'nav-links'} aria-label="Main navigation">
            <Link className={pathname === '/gyms' ? 'active' : ''} to="/gyms">Explore gyms</Link>
            <Link className={pathname === '/compare' ? 'active' : ''} to="/compare">Compare gyms {selected.length > 0 && <span className="count">{selected.length}</span>}</Link>
            <Link className="nav-partner" to="/partners">For gym owners <ArrowUpRight size={16} /></Link>
          </nav>
        </div>
      </header>
    </>
  );
}

function SampleNote() {
  return <div className="sample-note"><ShieldCheck size={16} /><span>Built for discovery. All listings, rates, and details are <strong>sample data</strong>. Photos are illustrative stock images.</span></div>;
}

function ResourceFeedback({ loading, error, retry, emptyMessage }) {
  if (loading) return <div className="empty" role="status" aria-live="polite"><p>Loading gym information…</p></div>;
  if (error) {
    return (
      <div className="empty" role="alert">
        <h2>Gym information is unavailable.</h2>
        <p>{error}</p>
        <button className="button" onClick={retry}>Try again</button>
      </div>
    );
  }
  if (emptyMessage) return <div className="empty"><Search size={36} /><h2>{emptyMessage}</h2><p>Try a different search or adjust your filters.</p></div>;
  return null;
}

function Home() {
  const [query, setQuery] = useState('');
  const resource = useApiResource('/gyms?featured=true');
  const gyms = resource.data || [];
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <span className="eyebrow"><span className="live-dot" /> YOUR CITY. YOUR NEXT CHAPTER.</span>
          <h1>Find your gym.<br />Build your <span>momentum.</span></h1>
          <p>The right space changes everything. Discover and compare gyms in Naga City, and find where you belong.</p>
          <form className="hero-search" action="/gyms">
            <Search size={20} />
            <input name="q" aria-label="Search gyms or neighborhood" placeholder="Try a gym or neighborhood" value={query} onChange={(event) => setQuery(event.target.value)} />
            <button className="button" type="submit">Find my gym <ArrowUpRight size={18} /></button>
          </form>
          <div className="hero-location"><MapPin size={15} /> Naga City, Camarines Sur <span>·</span> A local-first discovery experience</div>
          <div className="hero-bottom"><div className="mini-icon"><Dumbbell size={19} /></div><div><strong>Your goals. Your budget. Your fit.</strong><small>Less searching. More showing up.</small></div></div>
        </div>
        <div className="hero-visual">
          <img src={heroImage} alt="Illustrative gym interior with strength training equipment" />
          <div className="image-shade" />
          <span className="image-tag">A STRONGER YOU STARTS HERE</span>
          <div className="hero-image-text">Make room<br />for progress.</div>
          <span className="photo-credit">ILLUSTRATIVE STOCK PHOTO</span>
          <div className="floating-card"><span className="orange-icon"><MapPin size={22} /></span><div><strong>Big goals. Local gyms.</strong><small>Discover your fit in Naga City</small></div><ArrowUpRight size={22} /></div>
        </div>
      </section>
      <div className="container"><SampleNote /></div>
      <section className="why-strip container">
        <div><span className="step-number">01</span><div><strong>Discover your options</strong><small>Find a space that fits your routine.</small></div></div>
        <div><span className="step-number">02</span><div><strong>Compare what matters</strong><small>Rates, equipment, and the essentials.</small></div></div>
        <div><span className="step-number">03</span><div><strong>Take the next step</strong><small>Pick your gym. Start your chapter.</small></div></div>
      </section>
      <section className="section container">
        <div className="section-heading">
          <div><span className="eyebrow">FIND YOUR TRAINING GROUND</span><h2>Different spaces. Same drive.</h2><p>A first look at the places your next routine could begin.</p></div>
          <Link className="text-link" to="/gyms">Explore all gyms <ArrowUpRight size={19} /></Link>
        </div>
        <ResourceFeedback {...resource} />
        {!resource.loading && !resource.error && <div className="gym-grid">{gyms.map((gym) => <GymCard key={gym.id} gym={gym} />)}</div>}
      </section>
      <section className="container compare-banner">
        <div className="banner-icon"><GitCompareArrows size={35} /></div>
        <div><span className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</span><h2>Your next gym, side by side.</h2><p>Compare up to 3 gyms. Make a choice that works for you.</p></div>
        <Link to="/compare" className="button dark">Compare gyms <ArrowUpRight size={18} /></Link>
      </section>
      <section className="container partner-home">
        <div><span className="eyebrow">FOR THE PEOPLE BUILDING STRONGER COMMUNITIES</span><h2>Your gym. Their next beginning.</h2><p>Help Naga’s gym-goers find your space. Let’s grow the local fitness community together.</p><Link to="/partners" className="text-link">Partner with GYMIFY <ArrowUpRight size={18} /></Link></div>
        <div className="partner-art"><Building2 size={70} strokeWidth={1} /><span>LOCAL SPACES.<br /><strong>LASTING IMPACT.</strong></span></div>
      </section>
    </>
  );
}

function GymCard({ gym }) {
  const { selected, toggle } = useContext(CompareContext);
  const added = selected.includes(gym.id);
  return (
    <article className="gym-card">
      <Link to={`/gyms/${gym.id}`} className="card-image">
        <img loading="lazy" src={gym.image} alt={`Illustrative stock fitness photo for ${gym.name}`} />
        <span className="sample-badge">SAMPLE LISTING</span><span className="card-category">{gym.category}</span>
      </Link>
      <div className="card-body">
        <div className="location"><MapPin size={14} />{gym.area}, Naga City</div>
        <Link className="card-name" to={`/gyms/${gym.id}`}>{gym.name}<ArrowUpRight size={19} /></Link>
        <div className="tags">{gym.equipment.slice(0, 2).map((item) => <span key={item}>{item}</span>)}<span>+{gym.equipment.length + gym.amenities.length - 2} more</span></div>
        <div className="card-bottom">
          <div><strong>{money(gym.monthly)}</strong><span> / month</span><small>Sample monthly rate</small></div>
          <button className={`compare-add ${added ? 'added' : ''}`} onClick={() => toggle(gym.id)} aria-label={`${added ? 'Remove' : 'Add'} ${gym.name} ${added ? 'from' : 'to'} comparison`}>{added ? <Check size={15} /> : <Plus size={15} />} {added ? 'Added' : 'Compare'}</button>
        </div>
      </div>
    </article>
  );
}

function Directory() {
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('q') || '');
  const [budget, setBudget] = useState('');
  const [equipment, setEquipment] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const [sort, setSort] = useState('featured');
  const parameters = new URLSearchParams();
  if (query.trim()) parameters.set('q', query.trim());
  if (budget) parameters.set('budget', budget);
  for (const item of equipment) parameters.append('equipment', item);
  for (const item of amenities) parameters.append('amenities', item);
  parameters.set('sort', sort);
  const resource = useApiResource(`/gyms?${parameters.toString()}`);
  const filterResource = useApiResource('/gyms/options');
  const results = resource.data || [];

  function flip(value, values, setValues) {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }
  function reset() {
    setQuery('');
    setBudget('');
    setEquipment([]);
    setAmenities([]);
    setSort('featured');
  }

  return (
    <div className="container page">
      <span className="eyebrow">YOUR NEXT ROUTINE STARTS HERE</span><h1>Find your fit in Naga.</h1>
      <p className="page-intro">Explore local possibilities. Compare the details that matter to you.</p><SampleNote />
      <div className="directory-layout">
        <aside className="filters">
          <h3><SlidersHorizontal size={18} /> Refine your search</h3>
          <label className="filter-label" htmlFor="search">Gym or neighborhood</label>
          <div className="search-input"><Search size={17} /><input id="search" placeholder="Search gyms…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <label className="filter-label" htmlFor="budget">Monthly budget</label>
          <select id="budget" value={budget} onChange={(event) => setBudget(event.target.value)}>
            <option value="">Any price</option><option value="1000">Up to ₱1,000</option><option value="1500">Up to ₱1,500</option><option value="2000">Up to ₱2,000</option>
          </select>
          {filterResource.loading && <p role="status">Loading filter options…</p>}
          {filterResource.error && <div role="alert"><p>{filterResource.error}</p><button className="text-link" onClick={filterResource.retry}>Retry loading filters</button></div>}
          {filterResource.data && [
            ['Equipment', filterResource.data.equipment, equipment, setEquipment],
            ['Amenities', filterResource.data.amenities, amenities, setAmenities],
          ].map(([label, options, values, setValues]) => (
            <fieldset key={label}><legend>{label}</legend>{options.map((item) => <label className="check-label" key={item}><input type="checkbox" checked={values.includes(item)} onChange={() => flip(item, values, setValues)} />{item}</label>)}</fieldset>
          ))}
          <button className="text-link reset" onClick={reset}>Reset filters <X size={14} /></button>
        </aside>
        <section>
          <div className="results-heading">
            <p><strong>{resource.loading || resource.error ? '—' : results.length}</strong> sample {results.length === 1 ? 'gym' : 'gyms'} to explore</p>
            <label>Sort by <select aria-label="Sort gyms" value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></label>
          </div>
          <ResourceFeedback {...resource} emptyMessage={!resource.loading && !resource.error && !results.length ? 'No gyms match just yet.' : undefined} />
          {!resource.loading && !resource.error && results.length > 0 && <div className="directory-grid">{results.map((gym) => <GymCard gym={gym} key={gym.id} />)}</div>}
        </section>
      </div>
    </div>
  );
}

function Detail() {
  const { id } = useParams();
  const resource = useApiResource(`/gyms/${encodeURIComponent(id)}`);
  const gym = resource.data;
  const { selected, toggle } = useContext(CompareContext);
  if (resource.errorCode === 'GYM_NOT_FOUND') {
    return <div className="container empty"><h1>Gym not found</h1><Link className="button" to="/gyms">Explore gyms</Link></div>;
  }
  if (resource.loading || resource.error) {
    return <div className="container page"><Link className="text-link back" to="/gyms">← All gyms</Link><ResourceFeedback {...resource} /></div>;
  }
  if (!gym) {
    return <div className="container empty"><h1>Gym not found</h1><Link className="button" to="/gyms">Explore gyms</Link></div>;
  }
  return (
    <div className="container page">
      <Link className="text-link back" to="/gyms">← All gyms</Link><SampleNote />
      <div className="detail-heading">
        <div><span className="eyebrow">{gym.category} · SAMPLE LISTING</span><h1>{gym.name}</h1><p className="location"><MapPin size={17} />{gym.area}, Naga City</p></div>
        <button className="button" onClick={() => toggle(gym.id)}>{selected.includes(gym.id) ? <Check size={18} /> : <Plus size={18} />} {selected.includes(gym.id) ? 'Added to comparison' : 'Add to comparison'}</button>
      </div>
      <img className="detail-photo" src={gym.image} alt="Illustrative stock gym photo; not the actual venue" />
      <p className="caption">Illustrative stock photo — does not depict an actual listed venue.</p>
      <div className="detail-grid">
        <div>
          <section><h2>Room for your next chapter.</h2><p>{gym.description}</p></section>
          <section><h2>Equipment</h2><div className="feature-list">{gym.equipment.map((item) => <span key={item}><Dumbbell size={18} />{item}</span>)}</div></section>
          <section><h2>Amenities</h2><div className="feature-list">{gym.amenities.map((item) => <span key={item}><Check size={18} />{item}</span>)}</div></section>
          <section>
            <h2>Location &amp; hours</h2><p><MapPin size={17} /> {gym.address}</p><p><Clock size={17} /> {gym.hours}</p>
            <a className="text-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${gym.area}, Naga City Philippines`)}`} target="_blank" rel="noreferrer">Explore sample area on Google Maps <ArrowUpRight size={17} /></a>
            <p className="caption">Area search only. A verified gym address is not available.</p>
          </section>
        </div>
        <aside className="rates">
          <span className="eyebrow">SAMPLE RATES</span><h2>A routine within reach.</h2>
          <div className="rate-line"><span>Monthly membership</span><strong>{money(gym.monthly)}</strong></div>
          <div className="rate-line"><span>Day pass</span><strong>{money(gym.day)}</strong></div>
          <p>Illustrative prices only. No membership or booking is available through this demo.</p>
          <hr /><h3>Contact the gym</h3>
          {gym.contactUrl ? <a className="button" href={gym.contactUrl}>Contact gym <ArrowUpRight size={18} /></a> : <p>Contact links are not available for sample listings. Verified phone, email, and social links can be added here later.</p>}
        </aside>
      </div>
    </div>
  );
}

function Compare() {
  const { selected, toggle, setSelected } = useContext(CompareContext);
  const resource = useApiResource('/gyms');
  const gyms = resource.data || [];
  const chosen = selected.map((id) => gyms.find((gym) => gym.id === id)).filter(Boolean);

  useEffect(() => {
    if (!resource.data) return;
    const validIds = new Set(resource.data.map((gym) => gym.id));
    if (selected.some((id) => !validIds.has(id))) {
      setSelected((current) => current.filter((id) => validIds.has(id)));
    }
  }, [resource.data, selected, setSelected]);

  return (
    <div className="container page">
      <span className="eyebrow">MAKE YOUR NEXT MOVE WITH CLARITY</span><h1>Find your kind of fit.</h1>
      <p className="page-intro">Choose 2–3 gyms and compare the essentials, side by side.</p><SampleNote />
      <ResourceFeedback {...resource} />
      {!resource.loading && !resource.error && <>
        <div className="compare-picker">{gyms.map((gym) => <button key={gym.id} onClick={() => toggle(gym.id)} className={selected.includes(gym.id) ? 'selected' : ''} aria-pressed={selected.includes(gym.id)}>{selected.includes(gym.id) ? <Check size={16} /> : <Plus size={16} />} {gym.name}</button>)}</div>
        {chosen.length < 2
          ? <div className="empty"><GitCompareArrows size={40} /><h2>{chosen.length ? 'One more to get the full picture.' : 'A better fit starts with a little comparison.'}</h2><p>Select {chosen.length ? 'another gym' : '2–3 gyms'} above to compare sample rates, facilities, and hours.</p><Link className="text-link" to="/gyms">Explore the directory <ArrowRight size={18} /></Link></div>
          : <ComparisonTable gyms={chosen} onRemove={toggle} />}
      </>}
    </div>
  );
}

function ComparisonTable({ gyms, onRemove }) {
  const rows = [
    ['Monthly rate', (gym) => money(gym.monthly)],
    ['Day pass', (gym) => money(gym.day)],
    ['Neighborhood', (gym) => gym.area],
    ['Equipment', (gym) => gym.equipment.join(' · ')],
    ['Amenities', (gym) => gym.amenities.join(' · ')],
    ['Operating hours', (gym) => gym.hours],
  ];
  return (
    <div className="table-scroll" tabIndex="0" aria-label="Gym comparison; scroll horizontally on smaller screens">
      <table>
        <caption>Sample gym comparison — all details are illustrative</caption>
        <thead><tr><th scope="col">The essentials</th>{gyms.map((gym) => <th key={gym.id} scope="col"><img src={gym.image} alt="Illustrative fitness stock photo" /><Link to={`/gyms/${gym.id}`}>{gym.name} <ArrowUpRight size={15} /></Link><button className="remove" onClick={() => onRemove(gym.id)} aria-label={`Remove ${gym.name}`}><X size={16} /></button></th>)}</tr></thead>
        <tbody>{rows.map(([label, format]) => <tr key={label}><th scope="row">{label}</th>{gyms.map((gym) => <td key={gym.id}>{format(gym)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Partners() {
  const hosted = import.meta.env.VITE_PARTNER_FORM_URL;
  let safeUrl;
  try {
    const url = new URL(hosted);
    if (url.protocol === 'https:') safeUrl = url.href;
  } catch {
    safeUrl = undefined;
  }
  return (
    <div className="container page partners">
      <span className="eyebrow">STRONGER SPACES. STRONGER COMMUNITIES.</span>
      <h1>Your next member<br />is looking for <em>you.</em></h1>
      <p className="page-intro">Be part of a simpler way to discover fitness in Naga City. Help people find the place where they’ll keep showing up.</p>
      <div className="benefit-grid">
        {[[MapPin, 'Be discovered locally', 'Introduce your space to people looking for a gym in their neighborhood.'], [Dumbbell, 'Show what makes you, you', 'Bring your equipment, facilities, rates, and training environment into focus.'], [Users, 'Help people find their fit', 'Give future members the information they need to take their first step.']].map(([Icon, title, body]) => <article key={title}><Icon size={28} /><h2>{title}</h2><p>{body}</p></article>)}
      </div>
      <div className="inquiry">
        <Building2 size={34} /><h2>Let’s build Naga’s fitness map.</h2>
        <p>Interested in listing your gym? Share your business details through our inquiry channel when it becomes available.</p>
        {safeUrl ? <a className="button" href={safeUrl} target="_blank" rel="noreferrer">Send a partnership inquiry <ArrowUpRight size={18} /></a> : <div className="demo-label">Demo preview · Partnership inquiries are not connected yet.</div>}
        <small>GYMIFY is an MVP. No gyms or partnerships on this site are verified.</small>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer>
      <div className="container footer-main">
        <div><Brand /><p>Find your place.<br />Keep showing up.</p></div>
        <div className="footer-links"><Link to="/gyms">Explore gyms</Link><Link to="/compare">Compare gyms</Link><Link to="/partners">Partner with us</Link></div>
        <div className="footer-local"><MapPin size={16} /> Made for Naga City, Philippines.<small>A local vision. A stronger community.</small></div>
      </div>
      <div className="container footer-bottom"><span>© {new Date().getFullYear()} GYMIFY. Built for your next chapter.</span><span>Demo MVP · All gym listings are samples</span></div>
    </footer>
  );
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
