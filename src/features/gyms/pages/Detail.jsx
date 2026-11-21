import { useContext } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, Clock3, Dumbbell, MapPin, Plus } from 'lucide-react';
import { useGyms } from '../context/GymsContext';
import { CompareContext } from '../context/CompareContext';
import { money } from '../data/gyms';
import SaveGymButton from '../components/SaveGymButton';
import SampleNote from '../components/SampleNote.jsx';

export default function Detail() {
  const { gyms } = useGyms();
  const { id } = useParams();
  const gym = gyms.find((item) => item.id === id);
  const { selected, toggle } = useContext(CompareContext);

  if (!gym) return <div className="container page empty"><h1>Gym not found</h1><Link className="button" to="/gyms">Explore gyms</Link></div>;

  const isCompared = selected.includes(gym.id);
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${gym.area}, Naga City Philippines`)}`;

  return <div className="container page gym-detail-page">
    <Link className="text-link back" to="/gyms"><ArrowLeft size={17} /> All gyms</Link>
    <SampleNote gyms={[gym]} />

    <header className="detail-heading">
      <div className="detail-title">
        <span className="eyebrow">{gym.category} <span aria-hidden="true">·</span> {gym.sample ? 'SAMPLE LISTING' : 'GYMIFY LISTING'}</span>
        <h1>{gym.name}</h1>
        <p className="detail-area"><MapPin size={17} aria-hidden="true" /> {gym.area}, Naga City</p>
      </div>
      <div className="detail-actions">
        <SaveGymButton gym={gym} />
        <button className="button button-secondary" type="button" aria-pressed={isCompared} onClick={() => toggle(gym.id)}>
          {isCompared ? <Check size={17} /> : <Plus size={17} />}
          {isCompared ? 'Added to comparison' : 'Add to comparison'}
        </button>
      </div>
    </header>

    <figure className="detail-figure">
      <img className="detail-photo" src={gym.image} alt={gym.sample ? 'Illustrative stock gym photo; not the actual venue' : `Gym interior at ${gym.name}`} />
      <figcaption className="caption">{gym.sample ? 'Illustrative stock photo; it does not depict this venue.' : 'Gym photo.'}</figcaption>
    </figure>

    <div className="detail-grid">
      <div className="detail-main">
        <section className="detail-section detail-about" aria-labelledby="about-title">
          <span className="eyebrow">ABOUT THIS GYM</span>
          <h2 id="about-title">Room for your next chapter.</h2>
          <p>{gym.description}</p>
        </section>

        <div className="detail-info-grid">
          <section className="detail-info-card" aria-labelledby="equipment-title">
            <div className="detail-section-heading"><span className="detail-icon"><Dumbbell size={18} /></span><h2 id="equipment-title">Equipment</h2></div>
            {gym.equipment.length
              ? <ul className="detail-feature-list">{gym.equipment.map((item) => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}</ul>
              : <p className="detail-muted">Equipment details are not listed yet.</p>}
          </section>
          <section className="detail-info-card" aria-labelledby="amenities-title">
            <div className="detail-section-heading"><span className="detail-icon"><Check size={18} /></span><h2 id="amenities-title">Amenities</h2></div>
            {gym.amenities.length
              ? <ul className="detail-feature-list">{gym.amenities.map((item) => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}</ul>
              : <p className="detail-muted">Amenity details are not listed yet.</p>}
          </section>
        </div>

        <section className="detail-info-card detail-location-card" aria-labelledby="location-title">
          <div className="detail-section-heading"><span className="detail-icon"><MapPin size={18} /></span><h2 id="location-title">Location & hours</h2></div>
          <div className="detail-info-row"><MapPin size={18} aria-hidden="true" /><div><strong>Address</strong><p>{gym.address}</p></div></div>
          <div className="detail-info-row"><Clock3 size={18} aria-hidden="true" /><div><strong>Hours</strong><p>{gym.hours}</p></div></div>
          <a className="text-link detail-map-link" href={mapUrl} target="_blank" rel="noreferrer">
            {gym.sample ? 'Explore this sample area on Google Maps' : 'Open area in Google Maps'} <ArrowUpRight size={17} />
          </a>
          {gym.sample && <p className="detail-muted detail-location-note">Map search shows the area only; a verified gym address is not available.</p>}
        </section>
      </div>

      <aside className="rates" aria-labelledby="rates-title">
        <span className="eyebrow">{gym.sample ? 'SAMPLE RATES' : 'MEMBERSHIP RATES'}</span>
        <h2 id="rates-title">Membership</h2>
        <div className="rate-line"><div><span>Monthly membership</span><small>Recurring access</small></div><strong>{money(gym.monthly)}</strong></div>
        <div className="rate-line"><div><span>Day pass</span><small>Single-day access</small></div><strong>{money(gym.day)}</strong></div>
        <p className="rates-note">{gym.sample ? 'Illustrative prices only. No membership or booking is available through this demo.' : 'Rates may change. Confirm current prices directly with the gym.'}</p>
        <div className="rates-contact">
          <h3>Contact the gym</h3>
          {gym.contactUrl
            ? <a className="button" href={gym.contactUrl} target="_blank" rel="noreferrer">Contact gym <ArrowUpRight size={17} /></a>
            : <p>Contact details are not available for this listing yet.</p>}
        </div>
      </aside>
    </div>
  </div>;
}
