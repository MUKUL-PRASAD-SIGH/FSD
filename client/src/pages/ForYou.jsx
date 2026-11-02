import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { ListingCard, Empty } from '../components.jsx';

export default function ForYou() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.recommendations().then(setData).catch((e) => setError(e.message)); }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Ranking listings for you…</p>;
  const pro = data.tier === 'pro';

  return (
    <>
      <div className="row-between"><h1>For you</h1><span className={`pill ${pro ? '' : 'warm'}`}>{pro ? 'Pro rubric' : 'Basic picks'}</span></div>
      {!pro && (
        <div className="panel upsell">
          <strong>Want sharper picks?</strong> Pro reads your resume, ranks by your city and eligibility, and explains each score across 8 criteria. <Link to="/plan">Unlock Pro</Link>
        </div>
      )}
      {!data.hasSignal ? (
        <Empty>We don’t know enough about you yet. <Link to="/profile">Add skills and interests{pro ? ' or upload your resume' : ''}</Link> and this page fills in.</Empty>
      ) : (
        <p className="muted">
          Ranked using {data.basedOn.resume ? 'your parsed resume' : 'your profile'}
          {data.basedOn.location && <> · near {data.basedOn.location}</>}
          {data.basedOn.skills.length > 0 && <> · skills: {data.basedOn.skills.join(', ')}</>}
          . <Link to="/profile">Edit</Link>
        </p>
      )}
      {data.hasSignal && <div className="grid">{data.recommendations.map((r) => <ListingCard key={r.listing.id} item={r.listing} rec={r} />)}</div>}
      {data.hasSignal && !data.recommendations.length && <Empty>No open listings left to recommend. Check back after the next refresh.</Empty>}
    </>
  );
}
