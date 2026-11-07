import { MapPin, Dumbbell, Users } from 'lucide-react';
import InquiryForm from '../components/InquiryForm';

const benefits = [
  [MapPin, 'Be discovered locally', 'Introduce your space to people looking for a gym in their neighborhood.'],
  [Dumbbell, 'Show what makes you, you', 'Bring your equipment, facilities, rates, and training environment into focus.'],
  [Users, 'Help people find their fit', 'Give future members the information they need to take their first step.'],
];

export default function Partners() {
  return <div className="container page partners">
    <span className="eyebrow">STRONGER SPACES. STRONGER COMMUNITIES.</span>
    <h1>Your next member<br />is looking for <em>you.</em></h1>
    <p className="page-intro">Be part of a simpler way to discover fitness in Naga City. Help people find the place where they'll keep showing up.</p>
    <a className="button" href="#partner-inquiry">Inquire about a listing</a>
    <div className="benefit-grid">{benefits.map(([Icon, title, body]) => <article key={title}><Icon size={28} /><h2>{title}</h2><p>{body}</p></article>)}</div>
    <InquiryForm />
  </div>;
}
