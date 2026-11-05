import { useState, useEffect, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, X, Menu } from 'lucide-react';
import { gyms } from "../data/gyms";
import { CompareContext } from '../contexts/CompareContext';
import Brand from './Brand.jsx';
import Compare from '../pages/Compare.jsx';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const {
    selected
  } = useContext(CompareContext);
  const {
    pathname
  } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  return <><a href="#main" className="skip">Skip to content</a><header><div className="container nav"><Brand /><button className="menu-toggle icon-button" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button><nav className={open ? 'nav-links open' : 'nav-links'} aria-label="Main navigation"><Link className={pathname === '/gyms' ? 'active' : ''} to="/gyms">Explore gyms</Link><Link className={pathname === '/compare' ? 'active' : ''} to="/compare">Compare gyms {selected.length > 0 && <span className="count">{selected.length}</span>}</Link><Link className="nav-partner" to="/partners">For gym owners <ArrowUpRight size={16} /></Link></nav></div></header></>;
}
