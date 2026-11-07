import { ShieldCheck } from 'lucide-react';

export default function SampleNote({ gyms = [] }) {
  if (!gyms.some((gym) => gym.sample)) return null;
  return <div className="sample-note"><ShieldCheck size={16} /><span>Some listings, rates, and details are sample data. Photos are illustrative stock images.</span></div>;
}
