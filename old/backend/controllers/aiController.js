const Opportunity = require('../models/Opportunity');
const User = require('../models/User');

// Helper to calculate keyword overlap score
const scoreOpportunity = (opp, queryLower, studentSkills = []) => {
  let score = 0;
  const oppSkills = Array.isArray(opp.skillsRequired) ? opp.skillsRequired.join(' ') : '';
  const oppTags = Array.isArray(opp.tags) ? opp.tags.join(' ') : '';
  const oppText = `${opp.title || ''} ${opp.company || ''} ${opp.description || ''} ${opp.domain || ''} ${oppSkills} ${oppTags}`.toLowerCase();

  // Match words from user query
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);
  queryWords.forEach((word) => {
    if (oppText.includes(word)) score += 2;
  });

  // Match student profile skills
  studentSkills.forEach((skill) => {
    if (oppText.includes(skill.toLowerCase())) score += 3;
  });

  // Boost active and upcoming
  if (opp.status === 'Active') score += 1;

  return score;
};

// @desc    Process contextual AI queries and return smart recommendations
// @route   POST /api/ai/chat
// @access  Public / Private
const chatWithAi = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a message or question',
      });
    }

    const queryLower = message.toLowerCase();

    // Fetch user profile if logged in
    let student = null;
    let studentSkills = [];
    if (req.user) {
      student = await User.findById(req.user._id);
      if (student && student.skills) studentSkills = student.skills;
    }

    // Fetch live opportunities for grounding
    const allOpportunities = await Opportunity.find({ status: 'Active' })
      .select('title company domain type locationType reward deadline skillsRequired description tags status')
      .lean();

    // Rank opportunities by relevance
    const ranked = allOpportunities
      .map((opp) => ({
        ...opp,
        matchScore: scoreOpportunity(opp, queryLower, studentSkills),
      }))
      .filter((opp) => opp.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 4);

    // If Gemini API key is configured, use Gemini SDK / REST endpoint
    if (process.env.GEMINI_API_KEY) {
      try {
        const fetch = global.fetch || require('node-fetch');
        const systemPrompt = `You are "HackElite AI", an expert technical career and hackathon advisor for university students.
Platform Context:
- Active Opportunities in Database: ${JSON.stringify(allOpportunities.slice(0, 10))}
- User Profile: ${student ? `${student.name}, Skills: [${studentSkills.join(', ')}]` : 'Guest Student'}

Respond concisely, accurately, and professionally. Highlight matching opportunities from the database when relevant.`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: systemPrompt },
                    { text: `User Question: ${message}` },
                  ],
                },
              ],
            }),
          }
        );

        const geminiData = await geminiRes.json();
        if (geminiData.candidates && geminiData.candidates[0]?.content?.parts[0]?.text) {
          return res.json({
            success: true,
            reply: geminiData.candidates[0].content.parts[0].text,
            recommendedOpportunities: ranked,
            source: 'Gemini-1.5-Flash',
          });
        }
      } catch (geminiError) {
        console.warn('Gemini API call fallback to intelligent engine:', geminiError.message);
      }
    }

    // High-quality deterministic conversational response grounded on live DB
    let botReply = '';
    let recommendations = ranked;

    if (queryLower.includes('hackathon') || queryLower.includes('hack')) {
      const hackathons = allOpportunities.filter((o) => o.type === 'Hackathon');
      botReply = `Here are the top active hackathons currently open on HackElite AI! Participating in these gives you hands-on experience, team networking, and cash prizes.`;
      recommendations = hackathons.slice(0, 3);
    } else if (queryLower.includes('internship') || queryLower.includes('job')) {
      const internships = allOpportunities.filter((o) => o.type === 'Internship' || o.type === 'Full-time');
      botReply = `I found these verified internship and employment listings tailored to current industry demands:`;
      recommendations = internships.slice(0, 3);
    } else if (queryLower.includes('deadline') || queryLower.includes('urgent') || queryLower.includes('soon')) {
      const sortedByDeadline = [...allOpportunities].sort(
        (a, b) => new Date(a.deadline) - new Date(b.deadline)
      );
      botReply = `These opportunities have deadlines approaching soonest. Make sure to polish your resume and apply early!`;
      recommendations = sortedByDeadline.slice(0, 3);
    } else if (queryLower.includes('ai') || queryLower.includes('machine learning') || queryLower.includes('ml')) {
      const aiOpps = allOpportunities.filter((o) => o.domain === 'AI/ML' || o.domain === 'Data Science');
      botReply = `Awesome focus! Artificial Intelligence and Machine Learning opportunities are in high demand. Check out these premier events:`;
      recommendations = aiOpps.slice(0, 3);
    } else if (queryLower.includes('web') || queryLower.includes('frontend') || queryLower.includes('backend') || queryLower.includes('react')) {
      const webOpps = allOpportunities.filter((o) => o.domain === 'Web Development');
      botReply = `Great skills! For Web Development and Full-Stack roles, here are top opportunities currently accepting student applications:`;
      recommendations = webOpps.slice(0, 3);
    } else if (queryLower.includes('recommend') || queryLower.includes('suggest') || queryLower.includes('match')) {
      if (studentSkills.length > 0) {
        botReply = `Based on your profile skills (${studentSkills.join(', ')}), I have analyzed our database and matched you with these high-compatibility opportunities:`;
      } else {
        botReply = `Here are the top trending opportunities across all domains right now on HackElite AI:`;
        recommendations = allOpportunities.slice(0, 3);
      }
    } else if (queryLower.includes('pitch') || queryLower.includes('resume') || queryLower.includes('tip') || queryLower.includes('advice')) {
      botReply = `💡 **Pro Tip for Technical Applications & Hackathons**:
1. **Highlight measurable impact**: Instead of "Built a React app", write "Engineered a React + Node.js portal serving 500+ student users with 99% uptime".
2. **Team Synergies**: Use our Team Formation hub to pair with teammates who complement your skillset (e.g., UI/UX + Backend + DevOps).
3. **Early Submissions**: Evaluators look closely at early submissions. Review the criteria below and submit your pitch before the deadline!`;
    } else {
      botReply = `Hello! I am your **HackElite AI Assistant**. I can help you discover matching hackathons, internships, grant opportunities, recommend teams, or advise on application strategies. Here are some featured opportunities you might like:`;
      if (recommendations.length === 0) {
        recommendations = allOpportunities.slice(0, 3);
      }
    }

    res.json({
      success: true,
      reply: botReply,
      recommendedOpportunities: recommendations,
      source: 'HackElite-Contextual-Engine',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { chatWithAi };
