import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { ListingCard, Empty, SkeletonGrid } from '../components.jsx';
import ResumeStudio from '../ResumeStudio.jsx';

export default function ForYou() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = () => { setError(''); api.recommendations().then(setData).catch((e) => setError(e.message)); };
  useEffect(load, []);

  if (error) return <div className="empty"><p className="error">{error}</p><button className="btn" onClick={load}>Try again</button></div>;
  if (!data) return <><h1>For you</h1><p className="muted" aria-live="polite">Ranking open listings against your profile…</p><SkeletonGrid /></>;
  const ex = data.excluded || {};
  const hidden = [ex.ineligible && `${ex.ineligible} you’re not eligible for`, ex.duplicate && `${ex.duplicate} duplicate${ex.duplicate === 1 ? '' : 's'}`, ex.saved && `${ex.saved} already in your tracker`].filter(Boolean);
  const pro = data.tier === 'pro';

  return (
    <>
      <div className="row-between"><h1>For you</h1><span className={`pill ${pro ? '' : 'warm'}`}>{pro ? 'Pro rubric' : 'Basic picks'}</span></div>
      <ResumeStudio onChange={load} />
      {!data.hasSignal ? (
        <Empty>We don’t know enough about you yet. <Link to="/profile">Add skills and interests{pro ? ' or upload your resume' : ''}</Link> and this page fills in.</Empty>
      ) : (
        <p className="muted">
          Ranked using {data.basedOn.resume ? 'your parsed resume' : 'your profile'}
          {data.basedOn.location && <> · near {data.basedOn.location}</>}
          {data.basedOn.skills.length > 0 && <> · skills: {data.basedOn.skills.join(', ')}</>}
          . <Link to="/profile">Edit</Link>
          {hidden.length > 0 && <><br /><span className="small">Hidden: {hidden.join(' · ')}.{!data.basedOn.education && ' Add your education level in your profile so we can filter by eligibility.'}</span></>}
        </p>
      )}
      {data.hasSignal && <div className="grid">{data.recommendations.map((r) => <ListingCard key={r.listing.id} item={r.listing} rec={r} />)}</div>}
      {data.hasSignal && !data.recommendations.length && <Empty>No open listings left to recommend. Check back after the next refresh.</Empty>}
    </>
  );
}
