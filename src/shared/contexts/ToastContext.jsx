import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setToast(null);
  }, []);

  const notify = useCallback((message, type = 'success') => {
    if (!message) return;
    window.clearTimeout(timer.current);
    const id = Date.now();
    setToast({ id, message, type });
    timer.current = window.setTimeout(() => {
      setToast((current) => current?.id === id ? null : current);
    }, type === 'error' ? 8000 : 5500);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const Icon = toast?.type === 'error' ? AlertCircle : toast?.type === 'info' ? Info : CheckCircle2;
  return <ToastContext.Provider value={notify}>
    {children}
    {toast && <div className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'} aria-live={toast.type === 'error' ? 'assertive' : 'polite'} aria-atomic="true">
      <Icon size={20} aria-hidden="true" />
      <p>{toast.message}</p>
      <button type="button" aria-label="Dismiss notification" onClick={dismiss}><X size={18} /></button>
    </div>}
  </ToastContext.Provider>;
}
