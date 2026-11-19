import { Link } from 'react-router-dom';

// Plain-language summaries of what the platform actually does with data (kept in sync with docs/SECURITY.md).
// Before public launch: replace the [bracketed] placeholders and have the text reviewed for your jurisdiction (e.g. India's DPDP Act 2023).
const UPDATED = '19 November 2026';

export function Privacy() {
  return (
    <article className="legal">
      <h1>Privacy</h1>
      <p className="muted small">Last updated {UPDATED}. Operator: [your registered name / company], contact: [privacy contact email].</p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account:</strong> name, email, a hashed password (or your Google sign-in), and your role.</li>
        <li><strong>Profile you choose to add:</strong> city, college, education, graduation year, skills, interests and preferences. These power your recommendations.</li>
        <li><strong>Resume (optional):</strong> we extract text to read your skills. The file itself is never stored. You can delete the extracted data at any time from your profile.</li>
        <li><strong>Activity on the site:</strong> pages and listings you open, Register clicks, searches, and time spent while the tab is visible. You can turn off personal tracking in <Link to="/profile">Profile → Privacy</Link>; your visits then count only in anonymous totals and no time is recorded.</li>
        <li><strong>Social features:</strong> connections, teams and chat messages you send. Messages are visible only to the people in that conversation.</li>
      </ul>
      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell your data or show third-party ads.</li>
        <li>Admins see aggregate analytics and per-person engagement counts. They never see your password, resume text, chat messages or your private questions to the AI assistant.</li>
        <li>The AI assistant only uses public listings and your own profile; it cannot see other people’s data.</li>
      </ul>
      <h2>Who else processes data</h2>
      <ul>
        <li>Hosting and database: [hosting provider] and MongoDB Atlas ([region]).</li>
        <li>Email delivery: [email provider].</li>
        <li>Google, if you use Google sign-in, and Google Gemini if AI answers are switched on (the question and the relevant listing text are sent to generate an answer).</li>
      </ul>
      <h2>Keeping and deleting</h2>
      <p>Activity events are kept for 180 days and daily time totals for 365 days. Deleting your account (Profile → Delete account) removes your profile, tracker, notifications, connections, messages you sent, AI history and analytics.</p>
      <h2>Your rights</h2>
      <p>You can view and edit your data in your profile, export your tracker as a calendar, turn off tracking, and delete your account. For anything else, email [privacy contact email].</p>
    </article>
  );
}

export function Terms() {
  return (
    <article className="legal">
      <h1>Terms of use</h1>
      <p className="muted small">Last updated {UPDATED}. These terms are between you and [your registered name / company].</p>
      <ol>
        <li><strong>The service.</strong> We collect hackathons, contests and similar opportunities from organisers and public sources and link you to the organiser to register. We are not the organiser of listed events unless stated.</li>
        <li><strong>Accuracy.</strong> Listing details can change or be wrong. Always confirm dates, prizes, eligibility and fees on the organiser’s page. Use “Report a problem” on a listing if something looks off.</li>
        <li><strong>Your account.</strong> Keep your password safe, use your real name, and keep one account per person. You must be old enough to agree to these terms where you live, or have a parent or guardian’s permission.</li>
        <li><strong>Be decent.</strong> No spam, harassment, impersonation, scraping, attempts to break security, or sharing other people’s personal data. We may suspend accounts that do.</li>
        <li><strong>Organisers.</strong> Listers must have the right to publish an event and keep it accurate. Admins review organisers before they can publish.</li>
        <li><strong>Free for now.</strong> All features are currently free. If paid plans are introduced we will tell you first; nothing you already use will start charging without your consent.</li>
        <li><strong>No guarantee.</strong> The service is provided as is. To the extent the law allows, we are not liable for losses from relying on listing information or from events run by third parties.</li>
        <li><strong>Changes.</strong> We may update these terms and will note the date above. Continuing to use the service means you accept the update.</li>
        <li><strong>Contact.</strong> [support contact email]. Governing law: [jurisdiction].</li>
      </ol>
    </article>
  );
}
