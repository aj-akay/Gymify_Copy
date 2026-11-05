import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';
import { gyms } from './data/gyms';
import { CompareContext } from './contexts/CompareContext';
import ScrollTop from './components/ScrollTop.jsx';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Directory from './pages/Directory.jsx';
import Detail from './pages/Detail.jsx';
import Compare from './pages/Compare.jsx';
import Partners from './pages/Partners.jsx';
import Footer from './components/Footer.jsx';

export default function App() {
  const [selected, setSelected] = useState(() => {
    try {
      return [].concat(JSON.parse(localStorage.getItem('gymify-compare') || '[]')).filter(id => gyms.some(g => g.id === id)).slice(0, 3);
    } catch {
      return [];
    }
  });
  const [notice, setNotice] = useState('');
  useEffect(() => {
    try {
      localStorage.setItem('gymify-compare', JSON.stringify(selected));
    } catch {}
  }, [selected]);
  function toggle(id) {
    if (selected.includes(id)) setSelected(s => s.filter(x => x !== id));else if (selected.length < 3) setSelected(s => [...s, id]);else setNotice('You can compare up to 3 gyms. Remove one to add another.');
  }
  return <CompareContext.Provider value={{
    selected,
    toggle
  }}><BrowserRouter><ScrollTop /><Navbar /><main id="main"><Routes><Route path="/" element={<Home />} /><Route path="/gyms" element={<Directory />} /><Route path="/gyms/:id" element={<Detail />} /><Route path="/compare" element={<Compare />} /><Route path="/partners" element={<Partners />} /><Route path="*" element={<div className="container empty"><h1>Page not found.</h1><Link className="button" to="/">Back home <ArrowRight /></Link></div>} /></Routes></main><Footer />{notice && <div className="toast" role="alert">{notice}<button aria-label="Dismiss" onClick={() => setNotice('')}><X size={18} /></button></div>}</BrowserRouter></CompareContext.Provider>;
}
