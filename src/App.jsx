import GymDataState from './components/GymDataState';
import { GymsProvider } from './contexts/GymsContext';
import { useState } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';
import { CompareContext } from './contexts/CompareContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SavedProvider } from './contexts/SavedContext';
import ScrollTop from './components/ScrollTop';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import MemberGate from './components/MemberGate';
import Home from './pages/Home';
import Directory from './pages/Directory';
import Detail from './pages/Detail';
import Compare from './pages/Compare';
import Partners from './pages/Partners';
import AuthPage from './pages/AuthPage';
import Saved from './pages/Saved';

const AppRouter = import.meta.env.VITE_GITHUB_PAGES === 'true' ? HashRouter : BrowserRouter;

function AppRoutes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Comparison is session-local. The backend can add persistence later.
  const [comparison, setComparison] = useState({ owner: null, ids: [] });
  const selected = user && comparison.owner === user.id ? comparison.ids : [];
  const [notice, setNotice] = useState('');

  function toggle(id) {
    if (!user) { navigate('/login?next=%2Fcompare'); return; }
    if (selected.includes(id)) setComparison({ owner: user.id, ids: selected.filter(x => x !== id) });
    else if (selected.length < 3) setComparison({ owner: user.id, ids: [...selected, id] });
    else setNotice('You can compare up to 3 gyms. Remove one to add another.');
  }

  return <CompareContext.Provider value={{ selected, toggle }}>
    <ScrollTop />
    <Navbar />
    <main id="main">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/gyms" element={<GymDataState><Directory /></GymDataState>} />
        <Route path="/gyms/:id" element={<GymDataState><Detail /></GymDataState>} />
        <Route path="/compare" element={<MemberGate title="Compare your next chapter."><GymDataState><Compare /></GymDataState></MemberGate>} />
        <Route path="/saved" element={<MemberGate><GymDataState><Saved /></GymDataState></MemberGate>} />
        <Route path="/login" element={<AuthPage key="login" />} />
        <Route path="/signup" element={<AuthPage key="signup" mode="signup" />} />
        <Route path="/forgot-password" element={<AuthPage key="recovery" mode="recovery" />} />
        <Route path="/partners" element={<Partners />} />
        <Route path="*" element={<div className="container empty"><h1>Page not found.</h1><Link className="button" to="/">Back home <ArrowRight /></Link></div>} />
      </Routes>
    </main>
    <Footer />
    {notice && <div className="toast" role="alert">{notice}<button aria-label="Dismiss" onClick={() => setNotice('')}><X size={18} /></button></div>}
  </CompareContext.Provider>;
}

export default function App() {
  return <GymsProvider><AuthProvider><SavedProvider><AppRouter><AppRoutes /></AppRouter></SavedProvider></AuthProvider></GymsProvider>;
}
