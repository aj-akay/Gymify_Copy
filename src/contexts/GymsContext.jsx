import { createContext, useContext, useEffect, useState } from 'react';
import { fetchApi } from '../api';

const GymsContext = createContext(null);
export const useGyms = () => useContext(GymsContext);

export function GymsProvider({ children }) {
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetchApi('/gyms', { signal: controller.signal }).then(data => {
      if (!Array.isArray(data)) throw new Error('The gym API returned an unexpected result.');
      setGyms(data);
    }).catch(e => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  const equipmentOptions = [...new Set(gyms.flatMap(g => g.equipment))].sort();
  const amenityOptions = [...new Set(gyms.flatMap(g => g.amenities))].sort();
  return <GymsContext.Provider value={{ gyms, equipmentOptions, amenityOptions, loading, error, retry: () => setRevision(n => n + 1) }}>{children}</GymsContext.Provider>;
}
