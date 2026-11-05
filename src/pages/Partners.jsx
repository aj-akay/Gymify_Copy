import { ArrowUpRight, MapPin, Dumbbell, Users, Building2 } from 'lucide-react';
import { gyms } from "../data/gyms";

export default function Partners() {
  const hosted = import.meta.env.VITE_PARTNER_FORM_URL;
  let safeUrl;
  try {
    const u = new URL(hosted);
    if (u.protocol === 'https:') safeUrl = u.href;
  } catch {}
  return <div className="container page partners"><span className="eyebrow">STRONGER SPACES. STRONGER COMMUNITIES.</span><h1>Your next member<br />is looking for <em>you.</em></h1><p className="page-intro">Be part of a simpler way to discover fitness in Naga City. Help people find the place where they’ll keep showing up.</p><div className="benefit-grid">{[[MapPin, 'Be discovered locally', 'Introduce your space to people looking for a gym in their neighborhood.'], [Dumbbell, 'Show what makes you, you', 'Bring your equipment, facilities, rates, and training environment into focus.'], [Users, 'Help people find their fit', 'Give future members the information they need to take their first step.']].map(([Icon, title, body]) => <article key={title}><Icon size={28} /><h2>{title}</h2><p>{body}</p></article>)}</div><div className="inquiry"><Building2 size={34} /><h2>Let’s build Naga’s fitness map.</h2><p>Interested in listing your gym? Share your business details through our inquiry channel when it becomes available.</p>{safeUrl ? <a className="button" href={safeUrl} target="_blank" rel="noreferrer">Send a partnership inquiry <ArrowUpRight size={18} /></a> : <div className="demo-label">Demo preview · Partnership inquiries are not connected yet.</div>}<small>GYMIFY is an MVP. No gyms or partnerships on this site are verified.</small></div></div>;
}
