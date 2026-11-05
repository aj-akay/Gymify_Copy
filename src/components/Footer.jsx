import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { gyms } from "../data/gyms";
import Brand from './Brand.jsx';
import Compare from '../pages/Compare.jsx';

export default function Footer() {
  return <footer><div className="container footer-main"><div><Brand /><p>Find your place.<br />Keep showing up.</p></div><div className="footer-links"><Link to="/gyms">Explore gyms</Link><Link to="/compare">Compare gyms</Link><Link to="/partners">Partner with us</Link></div><div className="footer-local"><MapPin size={16} /> Made for Naga City, Philippines.<small>A local vision. A stronger community.</small></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} GYMIFY. Built for your next chapter.</span><span>Demo MVP · All gym listings are samples</span></div></footer>;
}
