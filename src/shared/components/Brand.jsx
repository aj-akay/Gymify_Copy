import { Link } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';

export default function Brand() {
  return <Link to="/" className="brand" aria-label="Gymify home"><span className="brand-icon"><Dumbbell size={22} /></span>GYMIFY<span className="brand-dot">.</span></Link>;
}
