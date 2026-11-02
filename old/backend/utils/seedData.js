const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('../config/db');
const User = require('../models/User');
const Opportunity = require('../models/Opportunity');
const Application = require('../models/Application');
const SavedItem = require('../models/SavedItem');
const Team = require('../models/Team');

const seedData = async () => {
  try {
    await connectDB();

    console.log('🔄 Cleaning existing collections...');
    await User.deleteMany({});
    await Opportunity.deleteMany({});
    await Application.deleteMany({});
    await SavedItem.deleteMany({});
    await Team.deleteMany({});

    console.log('👤 Seeding default users (Admin & Students)...');
    const adminUser = await User.create({
      name: 'Dr. Katherine Vance (Admin)',
      email: 'admin@hackelite.ai',
      password: 'AdminPassword123',
      role: 'admin',
      college: 'Global Tech Institute',
      bio: 'Head of Technical Talent & Industry Liaison.',
      skills: ['System Design', 'Project Evaluation', 'AI Architecture'],
    });

    const studentAlex = await User.create({
      name: 'Alex Chen',
      email: 'alex@student.edu',
      password: 'StudentPassword123',
      role: 'student',
      college: 'Dept of Computer Science & Engineering',
      bio: 'Full-stack developer enthusiastic about MERN, Next.js, and cloud platforms.',
      skills: ['React', 'Node.js', 'MongoDB', 'JavaScript', 'Express.js', 'CSS'],
    });

    const studentPriya = await User.create({
      name: 'Priya Sharma',
      email: 'priya@student.edu',
      password: 'StudentPassword123',
      role: 'student',
      college: 'School of Artificial Intelligence',
      bio: 'ML researcher focusing on computer vision and generative models.',
      skills: ['Python', 'PyTorch', 'TensorFlow', 'AI/ML', 'FastAPI', 'Data Science'],
    });

    const studentMarcus = await User.create({
      name: 'Marcus Brody',
      email: 'marcus@student.edu',
      password: 'StudentPassword123',
      role: 'student',
      college: 'Faculty of Information Technology',
      bio: 'Cloud architecture enthusiast, Kubernetes certified, cybersecurity hobbyist.',
      skills: ['Docker', 'Kubernetes', 'AWS', 'Cybersecurity', 'Go', 'Linux'],
    });

    console.log('🚀 Seeding technical opportunities...');
    const now = new Date();
    const addDays = (d) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

    const opportunitiesData = [
      {
        title: 'Global Generative AI Hackathon 2026',
        company: 'Anthropic Labs & Google Cloud',
        description: 'Build cutting-edge multi-agent AI systems and multimodal applications solving sustainable development goals. Mentorship provided by leading frontier AI researchers.',
        type: 'Hackathon',
        domain: 'AI/ML',
        locationType: 'Remote',
        locationName: 'Worldwide Virtual',
        reward: '$50,000 Cash Pool + Cloud Credits',
        deadline: addDays(14),
        startDate: addDays(18),
        eligibility: 'Open to university students and early career developers worldwide.',
        skillsRequired: ['Python', 'LLMs', 'API Integration', 'Vector Databases', 'React'],
        tags: ['GenerativeAI', 'Hackathon', 'CashPrizes', 'Global'],
        status: 'Active',
        postedBy: adminUser._id,
        applicantCount: 2,
      },
      {
        title: 'Full-Stack Software Engineering Summer Internship',
        company: 'Stripe Engineering',
        description: 'Join our Core Infrastructure and Payments Experience engineering team. Work directly on large-scale distributed financial systems processing millions of events per second.',
        type: 'Internship',
        domain: 'Web Development',
        locationType: 'Hybrid',
        locationName: 'San Francisco, CA / Seattle, WA',
        reward: '$9,200 / Month + Housing Stipend',
        deadline: addDays(21),
        startDate: addDays(60),
        eligibility: 'Enrolled in Computer Science or related degree graduating in 2026 or 2027.',
        skillsRequired: ['JavaScript', 'React', 'Node.js', 'Distributed Systems', 'SQL'],
        tags: ['FinTech', 'HighStipend', 'Hybrid', 'Tier1'],
        status: 'Active',
        postedBy: adminUser._id,
        applicantCount: 1,
      },
      {
        title: 'Cloud Native & DevOps Apprenticeship',
        company: 'Red Hat / IBM Cloud',
        description: 'Gain practical experience building containerized microservices and automated CI/CD pipelines across hybrid cloud environments using OpenShift and Kubernetes.',
        type: 'Internship',
        domain: 'Cloud & DevOps',
        locationType: 'Remote',
        locationName: 'North America / EMEA Remote',
        reward: '$7,500 / Month + Certification Vouchers',
        deadline: addDays(10),
        startDate: addDays(40),
        eligibility: 'Passionate about Linux, networking, and cloud systems.',
        skillsRequired: ['Docker', 'Kubernetes', 'Linux', 'AWS', 'CI/CD'],
        tags: ['DevOps', 'Kubernetes', 'RemoteWork'],
        status: 'Active',
        postedBy: adminUser._id,
        applicantCount: 1,
      },
      {
        title: 'DefCon University Cyber Defense CTF Challenge',
        company: 'CrowdStrike Intelligence',
        description: 'Competitive 48-hour Capture-The-Flag contest testing skills in binary exploitation, reverse engineering, cryptographic forensics, and web vulnerability analysis.',
        type: 'Coding Contest',
        domain: 'Cybersecurity',
        locationType: 'Remote',
        locationName: 'Global CTF Platform',
        reward: '$20,000 in Hardware Prizes + Fast-Track Interviews',
        deadline: addDays(7),
        startDate: addDays(8),
        eligibility: 'Student teams of 1 to 4 members.',
        skillsRequired: ['Cybersecurity', 'Reverse Engineering', 'Cryptography', 'Linux', 'Python'],
        tags: ['CTF', 'Infosec', 'HighStakes', 'Hacking'],
        status: 'Active',
        postedBy: adminUser._id,
        applicantCount: 0,
      },
      {
        title: 'Decentralized Identity & Zero-Knowledge Grant Program',
        company: 'Ethereum Foundation Grants',
        description: 'Seed funding grant for undergraduate research projects engineering privacy-preserving zero-knowledge circuits and verifiable credentials.',
        type: 'Research Grant',
        domain: 'Blockchain & Web3',
        locationType: 'Remote',
        locationName: 'Global Foundation',
        reward: '$30,000 Equity-free Research Grant',
        deadline: addDays(30),
        startDate: addDays(45),
        eligibility: 'Student researchers and open-source project leads.',
        skillsRequired: ['Solidity', 'Cryptography', 'ZK-SNARKs', 'Rust', 'Web3'],
        tags: ['Grant', 'Web3', 'Research', 'ZeroKnowledge'],
        status: 'Active',
        postedBy: adminUser._id,
        applicantCount: 0,
      },
      {
        title: 'Mobile AI & Edge Intelligence Fellowship',
        company: 'Qualcomm Snapdragon Lab',
        description: 'Design real-time on-device neural processing models optimized for mobile smartphones, wearables, and IoT sensor networks.',
        type: 'Internship',
        domain: 'Mobile Development',
        locationType: 'On-site',
        locationName: 'San Diego, CA',
        reward: '$8,800 / Month + Relocation Package',
        deadline: addDays(25),
        startDate: addDays(55),
        eligibility: 'Junior, Senior, or Graduate students in ECE / CSE.',
        skillsRequired: ['C++', 'Android', 'Mobile Dev', 'PyTorch', 'Embedded Systems'],
        tags: ['Hardware', 'MobileAI', 'OnSite'],
        status: 'Active',
        postedBy: adminUser._id,
        applicantCount: 0,
      },
      {
        title: 'Smart Cities Data Analytics Challenge',
        company: 'Bloomberg Data Solutions',
        description: 'Leverage geospatial and urban IoT time-series datasets to predict transit anomalies and optimize public transit scheduling algorithms.',
        type: 'Hackathon',
        domain: 'Data Science',
        locationType: 'Hybrid',
        locationName: 'New York, NY',
        reward: '$15,000 Prize Pool',
        deadline: addDays(18),
        startDate: addDays(22),
        eligibility: 'All currently matriculated students.',
        skillsRequired: ['Python', 'Data Science', 'Pandas', 'SQL', 'Visualization'],
        tags: ['BigData', 'SmartCities', 'Hybrid'],
        status: 'Active',
        postedBy: adminUser._id,
        applicantCount: 0,
      },
    ];

    const insertedOpps = await Opportunity.insertMany(opportunitiesData);
    console.log(`✔ Created ${insertedOpps.length} opportunities.`);

    console.log('📝 Seeding student applications and timelines...');
    // Alex applies to Generative AI Hackathon and Stripe Internship
    await Application.create({
      opportunityId: insertedOpps[0]._id, // Gen AI Hackathon
      studentId: studentAlex._id,
      status: 'Shortlisted',
      coverNote: 'Excited to build an automated agentic research tool using React and Node.js backend. Led 2 previous university hackathon winning teams.',
      portfolioLinks: ['https://github.com/alexchen-dev', 'https://alexchen.dev'],
      timeline: [
        { status: 'Applied', timestamp: addDays(-3), note: 'Submitted application and project proposal.' },
        { status: 'Under Review', timestamp: addDays(-2), note: 'Portfolio and GitHub verified by committee.' },
        { status: 'Shortlisted', timestamp: addDays(-1), note: 'Selected for Final Round Hackathon Pitch!' },
      ],
      feedback: 'Outstanding previous project history and clean GitHub portfolio.',
    });

    await Application.create({
      opportunityId: insertedOpps[1]._id, // Stripe Internship
      studentId: studentAlex._id,
      status: 'Under Review',
      coverNote: 'Passionate about high-throughput payments and robust distributed backend APIs.',
      portfolioLinks: ['https://github.com/alexchen-dev'],
      timeline: [
        { status: 'Applied', timestamp: addDays(-2), note: 'Application and resume submitted.' },
        { status: 'Under Review', timestamp: addDays(-1), note: 'Initial recruiter screening in progress.' },
      ],
      feedback: 'Technical screening pending with hiring manager.',
    });

    // Priya applies to Gen AI Hackathon
    await Application.create({
      opportunityId: insertedOpps[0]._id,
      studentId: studentPriya._id,
      status: 'Accepted',
      coverNote: 'Published author in NeurIPS workshop on lightweight attention models. Bringing deep PyTorch expertise.',
      portfolioLinks: ['https://github.com/priyasharma-ai'],
      timeline: [
        { status: 'Applied', timestamp: addDays(-5), note: 'Submitted research credentials and CV.' },
        { status: 'Under Review', timestamp: addDays(-4), note: 'Reviewed by technical jury.' },
        { status: 'Shortlisted', timestamp: addDays(-2), note: 'Invited to finalist cohort.' },
        { status: 'Accepted', timestamp: addDays(-1), note: 'Accepted with VIP Hackathon Pass & Cloud Credits!' },
      ],
      feedback: 'Superb machine learning qualifications.',
    });

    // Marcus applies to Cloud Apprenticeship
    await Application.create({
      opportunityId: insertedOpps[2]._id, // Red Hat Cloud
      studentId: studentMarcus._id,
      status: 'Applied',
      coverNote: 'CKA (Certified Kubernetes Administrator) certified student with hands-on homelab experience.',
      portfolioLinks: ['https://github.com/marcusbrody-infra'],
      timeline: [
        { status: 'Applied', timestamp: addDays(-1), note: 'Application and cloud resume submitted.' },
      ],
    });

    console.log('📌 Seeding bookmarked items...');
    await SavedItem.create({ studentId: studentAlex._id, opportunityId: insertedOpps[0]._id });
    await SavedItem.create({ studentId: studentAlex._id, opportunityId: insertedOpps[2]._id });
    await SavedItem.create({ studentId: studentPriya._id, opportunityId: insertedOpps[0]._id });

    console.log('🤝 Seeding teams for collaborative hackathons...');
    await Team.create({
      name: 'Agentic Architects',
      leaderId: studentAlex._id,
      opportunityId: insertedOpps[0]._id,
      description: 'Building an autonomous multi-modal agent for academic paper discovery and code generation.',
      skillsSeeking: ['PyTorch', 'UI/UX Design', 'DevOps'],
      maxMembers: 4,
      projectPitch: 'Solving technical research bottlenecks for graduate researchers using local models and vector indexing.',
      members: [
        { user: studentAlex._id, roleTitle: 'Full-Stack Lead', joinedAt: addDays(-3) },
        { user: studentPriya._id, roleTitle: 'AI/ML Research Lead', joinedAt: addDays(-2) },
      ],
      requests: [
        { user: studentMarcus._id, message: 'I can manage the Docker containers and cluster deployment!', status: 'pending', requestedAt: addDays(-1) },
      ],
      status: 'Recruiting',
    });

    console.log('\n\x1b[32m✔ HACKELITE AI DATABASE SEEDING COMPLETED SUCCESSFULLY!\x1b[0m');
    console.log('\nDefault Test Accounts:');
    console.log('----------------------------------------------------');
    console.log('👑 Admin:   email: admin@hackelite.ai   | password: AdminPassword123');
    console.log('🎓 Student: email: alex@student.edu     | password: StudentPassword123');
    console.log('🎓 Student: email: priya@student.edu    | password: StudentPassword123');
    console.log('🎓 Student: email: marcus@student.edu   | password: StudentPassword123');
    console.log('----------------------------------------------------\n');

    process.exit(0);
  } catch (error) {
    console.error('✖ Error seeding database:', error);
    process.exit(1);
  }
};

seedData();
