import { Link } from 'react-router-dom';

// Marketing sections carried over from the original (old/) landing page, restyled with this app's tokens.
const FEATURES = [
  ['🔎', 'Search and filter', 'Type, platform, mode, fee and deadline filters across every source in one feed.'],
  ['✨', 'Resume-aware matching', 'Upload your resume and get a 0–100 fit score with plain-English reasons.'],
  ['💬', 'AI assistant', 'Ask in plain English; answers cite the listings they came from.'],
  ['📌', 'Application tracker', 'Save listings and follow each one from interested to submitted, with deadline reminders.'],
  ['🤝', 'Teams and chat', 'Find teammates by complementary skills, invite them, and talk in live rooms.'],
  ['🛡️', 'Admin and sources', 'A coverage dashboard, audit log and review queue keep the feed trustworthy.'],
];
const BEFORE = ['Check a dozen platforms by hand', 'Duplicate listings everywhere', 'Deadlines slip past unnoticed', 'No idea which ones fit you'];
const AFTER = ['One de-duplicated feed from 16 sources', 'Ranked against your resume and location', 'Reminders before every deadline', 'Teams, chat and tracking in one place'];

export default function LandingSections({ user }) {
  return (
    <>
      <section className="lp-section" aria-labelledby="lp-problem">
        <div className="landing-section-heading"><p className="landing-kicker">THE PROBLEM</p><h2 id="lp-problem">Opportunities are scattered. Not anymore.</h2></div>
        <div className="lp-compare">
          <div className="lp-card lp-before"><h3>The usual way</h3><ul>{BEFORE.map((t) => <li key={t}><span aria-hidden="true">✕</span>{t}</li>)}</ul></div>
          <div className="lp-card lp-after"><h3>With HackElite</h3><ul>{AFTER.map((t) => <li key={t}><span aria-hidden="true">✓</span>{t}</li>)}</ul></div>
        </div>
      </section>

      <section className="lp-section" aria-labelledby="lp-features">
        <div className="landing-section-heading"><p className="landing-kicker">FEATURES</p><h2 id="lp-features">Everything you need in one platform.</h2></div>
        <div className="lp-grid">
          {FEATURES.map(([icon, title, text]) => <div className="lp-card" key={title}><span className="lp-icon" aria-hidden="true">{icon}</span><h3>{title}</h3><p>{text}</p></div>)}
        </div>
      </section>

      <section className="lp-section" aria-labelledby="lp-roles">
        <div className="landing-section-heading"><p className="landing-kicker">WHO IT'S FOR</p><h2 id="lp-roles">Built for builders and organisers.</h2></div>
        <div className="lp-compare">
          <div className="lp-card"><h3>For students</h3><p>Discover, get matched, track applications and form teams. Joining by invitation is always free.</p><Link className="landing-text-link" to="/for-you">See my matches →</Link></div>
          <div className="lp-card"><h3>For listers and admins</h3><p>Publish your event, review submissions and watch source coverage from the admin dashboard.</p><Link className="landing-text-link" to={user ? '/lister' : '/register'}>{user ? 'Open lister tools' : 'Create an account'} →</Link></div>
        </div>
      </section>

      {!user && (
        <section className="lp-cta" aria-labelledby="lp-cta">
          <h2 id="lp-cta">Ready to find your next big stage?</h2>
          <p>Create a free account and get matched in minutes.</p>
          <div><Link className="btn primary" to="/register">Get started free</Link> <Link className="btn" to="/login">Sign in</Link></div>
        </section>
      )}
    </>
  );
}
