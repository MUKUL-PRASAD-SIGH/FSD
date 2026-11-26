import { Link } from 'react-router-dom';

// Plain-language Privacy and Terms, kept in sync with what the code does (docs/SECURITY.md).
// The operator is currently an individual (no registered company). When that changes, edit OPERATOR below.
// This is a sensible starting text, not legal advice: have it reviewed before you scale (India: IT Act 2000, IT Rules 2021,
// Digital Personal Data Protection Act 2023).
const OPERATOR = {
  name: 'Mukul Prasad',
  kind: 'an individual developer (not a registered company)',
  email: 'mukulprasad958@gmail.com',
  city: 'Bengaluru, Karnataka, India',
  courts: 'Bengaluru, Karnataka',
  hosting: 'Render (application servers, Singapore region) and MongoDB Atlas (cloud database)',
  emailProvider: 'Google (Gmail)',
};
const UPDATED = '20 November 2026';
const Mail = () => <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>;

export function Privacy() {
  return (
    <article className="legal">
      <h1>Privacy</h1>
      <p className="muted small">Last updated {UPDATED}. HackElite is run by {OPERATOR.name}, {OPERATOR.kind}, based in {OPERATOR.city}. Contact: <Mail />.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account:</strong> name, email, a hashed password (or your Google sign-in), and your role.</li>
        <li><strong>Profile you choose to add:</strong> city, college, education, graduation year, skills, interests and preferences. These power your recommendations.</li>
        <li><strong>Resume (optional):</strong> we extract text to read your skills. The file itself is never stored. You can delete the extracted data at any time from your profile.</li>
        <li><strong>Activity on the site:</strong> pages and listings you open, Register clicks, searches, and time spent while the tab is visible. You can turn off personal tracking in <Link to="/profile">Profile → Privacy</Link>; your visits then count only in anonymous totals and no time is recorded.</li>
        <li><strong>Phone number (optional):</strong> only if you turn on text reminders, after you confirm it with a one-time code. It is used only for deadline reminders, never shown to anyone, and you can remove it any time. Reply STOP to any text to stop them.</li>
        <li><strong>Social features:</strong> connections, teams and chat messages you send. Messages are visible only to the people in that conversation.</li>
      </ul>

      <h2>Why we use it</h2>
      <p>To run your account, recommend events that fit you, send the reminders and alerts you switch on, keep the platform safe (for example, stopping spam and abuse), and understand which features help so we can improve them. We rely on your consent, which you can withdraw at any time by changing your settings or deleting your account.</p>

      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell your data or show third-party ads.</li>
        <li>Admins see aggregate analytics and per-person engagement counts. They never see your password, resume text, chat messages or your private questions to the AI assistant.</li>
        <li>The AI assistant only uses public listings and your own profile; it cannot see other people’s data.</li>
      </ul>

      <h2>Who else processes data</h2>
      <ul>
        <li>Hosting and database: {OPERATOR.hosting}. Your data may be stored on servers outside India.</li>
        <li>Email delivery: {OPERATOR.emailProvider}.</li>
        <li>Text messages: Twilio (your number and the reminder text), only if you turn text reminders on.</li>
        <li>Google, if you use Google sign-in.</li>
        <li>Google Gemini, when AI answers are switched on: to answer a question we send it your question, the relevant listing or event-page text, your last few messages in that conversation, and, for the personal assistant, the parts of your resume that match the question. It is not sent your email, password, phone number or other people’s data.</li>
      </ul>
      <p>These providers only process data to provide their service to us.</p>

      <h2>Keeping and deleting</h2>
      <p>Activity events are kept for 180 days and daily time totals for 365 days. Deleting your account (Profile → Delete account) removes your profile, tracker, notifications, connections, messages you sent, AI history and analytics. Security logs are kept for as long as needed to protect the service.</p>

      <h2>Children</h2>
      <p>If you are under 18, please use HackElite only with the consent of a parent or guardian.</p>

      <h2>Your rights</h2>
      <p>You can view and edit your data in your profile, export your tracker as a calendar, turn off tracking, withdraw consent and delete your account. To ask what data we hold about you, correct it, or erase it, email <Mail />.</p>

      <h2>Grievances</h2>
      <p>Grievance officer: {OPERATOR.name}, <Mail />. We acknowledge complaints within 24 hours and aim to resolve them within 15 days.</p>
    </article>
  );
}

export function Terms() {
  return (
    <article className="legal">
      <h1>Terms of use</h1>
      <p className="muted small">Last updated {UPDATED}. These terms are between you and {OPERATOR.name}, {OPERATOR.kind}, who runs HackElite.</p>
      <ol>
        <li><strong>The service.</strong> We collect hackathons, contests and similar opportunities from organisers and public sources and link you to the organiser to register. We are not the organiser of listed events unless stated.</li>
        <li><strong>Accuracy.</strong> Listing details can change or be wrong. Always confirm dates, prizes, eligibility and fees on the organiser’s page. Use “Report a problem” on a listing if something looks off.</li>
        <li><strong>Your account.</strong> Keep your password safe, use your real name, and keep one account per person. If you are under 18, you need a parent or guardian’s consent to use HackElite.</li>
        <li><strong>Be decent.</strong> No spam, harassment, impersonation, scraping, attempts to break security, or sharing other people’s personal data. We may suspend or remove accounts that do.</li>
        <li><strong>Your content.</strong> You keep ownership of what you post (profile, messages, team ideas). You let us store and show it to the people you share it with, only to run the service.</li>
        <li><strong>Organisers.</strong> Listers must have the right to publish an event and keep it accurate. Admins review organisers before they can publish.</li>
        <li><strong>Free for now.</strong> All features are currently free. If paid plans are introduced we will tell you first; nothing you already use will start charging without your consent.</li>
        <li><strong>No guarantee.</strong> The service is provided as is. To the extent the law allows, we are not liable for losses from relying on listing information or from events run by third parties.</li>
        <li><strong>Changes.</strong> We may update these terms and will note the date above. Continuing to use the service means you accept the update.</li>
        <li><strong>Law and disputes.</strong> These terms are governed by the laws of India. Courts in {OPERATOR.courts} have jurisdiction.</li>
        <li><strong>Contact and grievances.</strong> <Mail />. Grievance officer: {OPERATOR.name}; complaints are acknowledged within 24 hours.</li>
      </ol>
    </article>
  );
}
