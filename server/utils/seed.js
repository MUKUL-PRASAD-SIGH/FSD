// Sample listings so the app is usable offline. Marked source:"seed"; deadlines are relative to today.
// URLs point at the real platforms' landing pages, not at specific events.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Listing = require('../models/Listing');

const d = (days) => new Date(Date.now() + days * 86400000);
const L = (id, o) => ({ externalId: `seed-${id}`, source: 'seed', fee: 'Free', eligibility: ['College students'], ...o });

const data = [
  L(1, { title: 'Campus AI Build Sprint', organiser: 'Sample Org', type: 'HACKATHON', platform: 'Unstop', url: 'https://unstop.com/hackathons', deadline: d(5), mode: 'ONLINE', prizeLabel: '₹1,50,000', prizeInr: 150000, tags: ['Machine Learning/AI', 'Web'], skills: ['Python', 'Machine Learning', 'LLM'], description: 'Build an LLM-powered product for campus life in 36 hours.' }),
  L(2, { title: 'FinTech Case Challenge', organiser: 'Sample Bank', type: 'CASE STUDY', platform: 'Unstop', url: 'https://unstop.com/competitions', deadline: d(9), mode: 'ONLINE', prizeLabel: '₹3,00,000', prizeInr: 300000, tags: ['Finance', 'Strategy'], skills: ['Finance', 'Consulting', 'Excel'], description: 'Solve a real retail-banking growth problem and present to a jury.' }),
  L(3, { title: 'Full-Stack Web Jam', organiser: 'Sample Dev Club', type: 'HACKATHON', platform: 'Devfolio', url: 'https://devfolio.co/hackathons', deadline: d(12), mode: 'HYBRID', city: 'Bengaluru', prizeLabel: '₹75,000', prizeInr: 75000, tags: ['Web', 'Open Ended'], skills: ['React', 'Node.js', 'MongoDB', 'TypeScript'], description: 'Ship a full-stack app with React, Node and a database in a weekend.' }),
  L(4, { title: 'Weekly Algorithm Contest', organiser: 'Sample Judge', type: 'CONTEST', platform: 'CodeChef', url: 'https://www.codechef.com/contests', deadline: d(2), mode: 'ONLINE', prizeLabel: 'Certificates', prizeInr: null, tags: ['Algorithms'], skills: ['DSA', 'C++', 'Python'], description: 'Rated 3-hour algorithmic contest.' }),
  L(5, { title: 'Web3 Builders Summit Hack', organiser: 'Sample Chain', type: 'HACKATHON', platform: 'ETHGlobal', url: 'https://ethglobal.com/events', deadline: d(20), mode: 'OFFLINE', city: 'Hyderabad', prizeLabel: '$30,000', prizeInr: 2520000, tags: ['Blockchain', 'DeFi'], skills: ['Blockchain', 'JavaScript'], description: 'Smart contract and dapp track with mentor support.' }),
  L(6, { title: 'Secure-the-Flag CTF', organiser: 'Sample Sec', type: 'COMPETITION', platform: 'Direct', url: 'https://ctftime.org/', deadline: d(8), mode: 'ONLINE', prizeLabel: '₹40,000', prizeInr: 40000, tags: ['Security', 'CTF'], skills: ['Cybersecurity', 'Linux'], description: 'Jeopardy-style capture the flag: web, crypto, forensics.' }),
  L(7, { title: 'Product Design Sprint', organiser: 'Sample Design Co', type: 'DESIGN', platform: 'Unstop', url: 'https://unstop.com/competitions', deadline: d(15), mode: 'ONLINE', prizeLabel: '₹60,000', prizeInr: 60000, tags: ['Design', 'UX'], skills: ['UI/UX', 'Product Management'], description: 'Redesign a public-service app; judged on research and prototype.' }),
  L(8, { title: 'Data Storytelling Cup', organiser: 'Sample Analytics', type: 'COMPETITION', platform: 'Kaggle', url: 'https://www.kaggle.com/competitions', deadline: d(25), mode: 'ONLINE', prizeLabel: '₹1,00,000', prizeInr: 100000, tags: ['Data Science'], skills: ['Python', 'SQL', 'Pandas', 'Data Analysis'], description: 'Find and communicate insight in an open civic dataset.' }),
  L(9, { title: 'Cloud Native Challenge', organiser: 'Sample Cloud', type: 'HACKATHON', platform: 'Devpost', url: 'https://devpost.com/hackathons', deadline: d(30), mode: 'ONLINE', prizeLabel: '$10,000', prizeInr: 840000, tags: ['Cloud', 'DevOps'], skills: ['Docker', 'AWS', 'CI/CD'], description: 'Deploy a scalable service using containers and IaC.' }),
  L(10, { title: 'Mobile First Hackathon', organiser: 'Sample Apps', type: 'HACKATHON', platform: 'MLH', url: 'https://mlh.io/seasons/2026/events', deadline: d(18), mode: 'OFFLINE', city: 'Pune', prizeLabel: '₹50,000', prizeInr: 50000, tags: ['Mobile'], skills: ['Flutter', 'Android', 'React Native'], description: 'Build a mobile app in 24 hours.' }),
  L(11, { title: 'Marketing Strategy Case Cup', organiser: 'Sample FMCG', type: 'CASE STUDY', platform: 'Unstop', url: 'https://unstop.com/competitions', deadline: d(6), mode: 'ONLINE', prizeLabel: '₹2,00,000', prizeInr: 200000, tags: ['Marketing', 'Brand'], skills: ['Marketing', 'Consulting', 'Public Speaking'], description: 'Launch strategy for a new consumer product.' }),
  L(12, { title: 'IoT Smart Campus Challenge', organiser: 'Sample Hardware', type: 'INNOVATION', platform: 'Direct', url: 'https://hackerearth.com/challenges', deadline: d(22), mode: 'OFFLINE', city: 'Delhi NCR', prizeLabel: '₹80,000', prizeInr: 80000, tags: ['IoT', 'Hardware'], skills: ['IoT', 'Python', 'C++'], description: 'Sensors + dashboard for a smarter campus.' }),
];

async function main() {
  await connectDB();
  for (const row of data) await Listing.updateOne({ source: row.source, externalId: row.externalId }, { $set: row }, { upsert: true });
  console.log(`Seeded ${data.length} sample listings.`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
