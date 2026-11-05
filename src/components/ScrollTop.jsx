import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { gyms } from "../data/gyms";

export default function ScrollTop() {
  const {
    pathname
  } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = pathname === '/' ? 'GYMIFY — Find your fit in Naga' : 'GYMIFY — ' + (pathname.startsWith('/gyms/') ? 'Sample gym details' : pathname.slice(1).replace(/^./, c => c.toUpperCase()));
  }, [pathname]);
  return null;
}
