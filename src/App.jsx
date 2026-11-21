import GymDataState from './features/gyms/components/GymDataState';
import { GymsProvider } from './features/gyms/context/GymsContext';
import { useState } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { CompareContext } from './features/gyms/context/CompareContext';
import { SavedProvider } from './features/gyms/context/SavedContext';
import { AuthProvider, useAuth } from './features/auth/context/AuthContext';
import ScrollTop from './shared/components/ScrollTop';
import Navbar from './shared/components/Navbar';
import Footer from './shared/components/Footer';
import MemberGate from './features/auth/components/MemberGate';
import Home from './features/gyms/pages/Home';
import Directory from './features/gyms/pages/Directory';
import Detail from './features/gyms/pages/Detail';
import Compare from './features/gyms/pages/Compare';
import Saved from './features/gyms/pages/Saved';
import Partners from './features/partners/pages/Partners';
import AuthPage from './features/auth/pages/AuthPage';
import Trainers from './features/trainers/pages/Trainers';
import TrainerDetail from './features/trainers/pages/TrainerDetail';
import TrainerDashboard from './features/trainers/pages/TrainerDashboard';
import AdminDashboard from './features/admin/pages/AdminDashboard';
import Plans from './features/membership/pages/Plans';
import { ToastProvider, useToast } from './shared/contexts/ToastContext';
import { useGyms } from './features/gyms/context/GymsContext';

const AppRouter = import.meta.env.VITE_GITHUB_PAGES === 'true' ? HashRouter : BrowserRouter;

function AppRoutes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { gyms } = useGyms();
  const notify = useToast();
  // Comparison is session-local. The backend can add persistence later.
  const [comparison, setComparison] = useState({ owner: null, ids: [] });
  const selected = user && comparison.owner === user.id ? comparison.ids : [];
  function toggle(id) {
    if (!user) {
      notify('Sign in to compare gyms.', 'info');
      navigate('/login?next=%2Fcompare');
      return;
    }
    const gymName = gyms.find((gym) => gym.id === id)?.name || 'Gym';
    if (selected.includes(id)) {
      setComparison({ owner: user.id, ids: selected.filter((item) => item !== id) });
      notify(`${gymName} removed from comparison.`, 'info');
    } else if (selected.length < 3) {
      setComparison({ owner: user.id, ids: [...selected, id] });
      notify(`${gymName} added to comparison.`);
    } else notify('You can compare up to 3 gyms. Remove one to add another.', 'error');
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
        <Route path="/trainers" element={<Trainers />} />
        <Route path="/trainers/:id" element={<TrainerDetail />} />
        <Route path="/trainer/dashboard" element={<MemberGate title="Your trainer space."><TrainerDashboard /></MemberGate>} />
        <Route path="/admin" element={<MemberGate title="Admin dashboard."><AdminDashboard /></MemberGate>} />
        <Route path="/admin/trainers" element={<MemberGate title="Admin dashboard."><AdminDashboard initialSection="trainers" /></MemberGate>} />
        <Route path="/admin/inquiries" element={<MemberGate title="Admin dashboard."><AdminDashboard initialSection="inquiries" /></MemberGate>} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/login" element={<AuthPage key="login" />} />
        <Route path="/signup" element={<AuthPage key="signup" mode="signup" />} />
        <Route path="/forgot-password" element={<AuthPage key="recovery" mode="recovery" />} />
        <Route path="/reset-password" element={<AuthPage key="new-password" mode="new-password" />} />
        <Route path="/partners" element={<Partners />} />
        <Route path="*" element={<div className="container empty"><h1>Page not found.</h1><Link className="button" to="/">Back home <ArrowRight /></Link></div>} />
      </Routes>
    </main>
    <Footer />
  </CompareContext.Provider>;
}

export default function App() {
  return <ToastProvider><GymsProvider><AuthProvider><SavedProvider><AppRouter><AppRoutes /></AppRouter></SavedProvider></AuthProvider></GymsProvider></ToastProvider>;
}
