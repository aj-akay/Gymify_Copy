import { useEffect, useState } from 'react';
import { CalendarClock, MapPin, ShieldCheck } from 'lucide-react';

const STORAGE_KEY = 'gymify-demo-trainer-connection-v1';
const CONNECTION_DURATION = 5 * 60 * 60 * 1000;

const schedule = [
  { day: 'Monday', time: '6:00 AM – 10:00 AM' },
  { day: 'Tuesday', time: '4:00 PM – 8:00 PM' },
  { day: 'Wednesday', time: '6:00 AM – 10:00 AM' },
  { day: 'Thursday', time: '4:00 PM – 8:00 PM' },
  { day: 'Friday', time: '6:00 AM – 10:00 AM' },
];

function readConnection() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!stored || !Number.isFinite(stored.acceptedAt)) return null;
    return stored;
  } catch {
    return null;
  }
}

function remainingTime(milliseconds) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

export default function DemoTrainerCard() {
  const [connection, setConnection] = useState(readConnection);
  const [now, setNow] = useState(Date.now());
  const expiresAt = connection ? connection.acceptedAt + CONNECTION_DURATION : 0;
  const connected = Boolean(connection && now < expiresAt);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  function requestConnection() {
    const acceptedAt = Date.now();
    const next = { acceptedAt };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Keep this preview usable when browser storage is unavailable.
    }
    setConnection(next);
    setNow(acceptedAt);
  }

  return <article className="trainer-card demo-trainer-card">
    <div className="demo-trainer-topline"><span className="demo-trainer-avatar" aria-hidden="true">M</span><span className="demo-badge">Demo trainer</span></div>
    <div className="trainer-card-body">
      <h2>Mika Santos</h2>
      <p>Beginner-friendly strength coach focused on building confidence and a routine that lasts.</p>
      <p className="trainer-meta"><MapPin size={15} aria-hidden="true" /> Naga City · Forge Fitness Club</p>
      <div className="tags"><span>Strength training</span><span>Beginner fitness</span><span>Form coaching</span></div>
      <p className="demo-disclaimer"><ShieldCheck size={15} aria-hidden="true" /> Preview profile. This is not a real trainer.</p>

      {connected ? <section className="demo-schedule" aria-labelledby="demo-schedule-title">
        <div className="demo-connection-status" role="status"><span className="connection-dot" /> Demo connection accepted <span aria-live="off">Expires in {remainingTime(expiresAt - now)}</span></div>
        <h3 id="demo-schedule-title"><CalendarClock size={18} aria-hidden="true" /> Weekly availability</h3>
        <p className="demo-timezone">Times shown in Philippine time (Asia/Manila).</p>
        <ul>{schedule.map((slot) => <li key={slot.day}><span>{slot.day}</span><span>{slot.time}</span></li>)}</ul>
      </section> : connection ? <div className="demo-expired" role="status">Demo connection expired. Request a new one to view the sample schedule.</div> : <div className="demo-connection-prompt"><p>Request a demo connection to preview private availability. Schedule access lasts five hours after acceptance.</p></div>}

      <button className="button" type="button" onClick={requestConnection}>{connected ? 'Renew demo connection' : connection ? 'Request again' : 'Request connection'}</button>
    </div>
  </article>;
}
