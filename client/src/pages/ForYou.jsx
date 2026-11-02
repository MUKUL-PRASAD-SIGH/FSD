import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ListingCard, Empty } from '../components.jsx';

export default function ForYou() {
  const { user, openAuth } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    api.recommendations().then(setData).catch((e) => setError(e.message));
  }, [user]);

  if (!user) {
    return (
      <Empty>
        <h2>Picks based on your resume</h2>
        <p>Sign in, upload your resume once, and we rank every open listing against your skills, interests and preferences.</p>
        <button className="btn primary" onClick={openAuth}>Sign in to continue</button>
      </Empty>
    );
  }
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Ranking listings for you…</p>;

  return (
    <>
      <h1>For you</h1>
      {!data.hasSignal ? (
        <Empty>
          <p>We don’t know enough about you yet. <Link to="/profile">Upload your resume</Link> or add a few skills and interests, and this page fills in.</p>
        </Empty>
      ) : (
        <p className="muted">
          Ranked using {data.basedOn.resume ? 'your parsed resume' : 'your profile'}
          {data.basedOn.skills.length > 0 && <> · skills: {data.basedOn.skills.join(', ')}</>}
          {data.basedOn.interests.length > 0 && <> · interests: {data.basedOn.interests.join(', ')}</>}
          . <Link to="/profile">Edit</Link>
        </p>
      )}
      <div className="grid">
        {data.recommendations.map((r) => <ListingCard key={r.listing.id} item={r.listing} rec={r} />)}
      </div>
      {data.hasSignal && !data.recommendations.length && <Empty>No open listings left to recommend. Check back after the next refresh.</Empty>}
    </>
  );
}
