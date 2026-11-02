// Canonical skills -> aliases, and which interest domain each belongs to.
// Matching is word-boundary based so "java" does not match "javascript".
const SKILLS = {
  // AI / ML
  'Python': { d: 'AI/ML', a: ['python'] },
  'Machine Learning': { d: 'AI/ML', a: ['machine learning', 'ml', 'ai', 'artificial intelligence', 'a.i.'] },
  'Deep Learning': { d: 'AI/ML', a: ['deep learning', 'neural network', 'neural networks'] },
  'NLP': { d: 'AI/ML', a: ['nlp', 'natural language processing'] },
  'Computer Vision': { d: 'AI/ML', a: ['computer vision', 'opencv'] },
  'LLM': { d: 'AI/ML', a: ['llm', 'llms', 'large language model', 'langchain', 'rag', 'generative ai', 'genai', 'openai'] },
  'PyTorch': { d: 'AI/ML', a: ['pytorch'] },
  'TensorFlow': { d: 'AI/ML', a: ['tensorflow', 'keras'] },
  'Scikit-learn': { d: 'AI/ML', a: ['scikit-learn', 'sklearn'] },
  // Data
  'SQL': { d: 'Data Science', a: ['sql', 'mysql', 'postgresql', 'postgres'] },
  'Pandas': { d: 'Data Science', a: ['pandas', 'numpy'] },
  'Data Analysis': { d: 'Data Science', a: ['data analysis', 'data analytics', 'data visualization', 'tableau', 'power bi'] },
  'Excel': { d: 'Business', a: ['excel', 'spreadsheet'] },
  // Web
  'JavaScript': { d: 'Web Development', a: ['javascript', 'js', 'es6'] },
  'TypeScript': { d: 'Web Development', a: ['typescript'] },
  'React': { d: 'Web Development', a: ['react', 'reactjs', 'react.js', 'next.js', 'nextjs'] },
  'Node.js': { d: 'Web Development', a: ['node.js', 'nodejs', 'node', 'express', 'express.js'] },
  'MongoDB': { d: 'Web Development', a: ['mongodb', 'mongoose'] },
  'HTML/CSS': { d: 'Web Development', a: ['html', 'css', 'tailwind', 'bootstrap'] },
  'REST APIs': { d: 'Web Development', a: ['rest api', 'rest apis', 'restful', 'graphql'] },
  'Vue': { d: 'Web Development', a: ['vue', 'vue.js', 'angular'] },
  'Django': { d: 'Web Development', a: ['django', 'flask', 'fastapi'] },
  // Mobile
  'Flutter': { d: 'Mobile Development', a: ['flutter', 'dart'] },
  'Android': { d: 'Mobile Development', a: ['android', 'kotlin'] },
  'iOS': { d: 'Mobile Development', a: ['ios', 'swift', 'swiftui'] },
  'React Native': { d: 'Mobile Development', a: ['react native'] },
  // Systems / cloud
  'Java': { d: 'Software Engineering', a: ['java', 'spring boot', 'spring'] },
  'C++': { d: 'Software Engineering', a: ['c++', 'cpp'] },
  'Go': { d: 'Software Engineering', a: ['golang'] },
  'Rust': { d: 'Software Engineering', a: ['rust'] },
  'DSA': { d: 'Competitive Programming', a: ['dsa', 'data structures', 'algorithms', 'competitive programming', 'leetcode', 'codeforces', 'codechef'] },
  'Docker': { d: 'Cloud & DevOps', a: ['docker', 'kubernetes', 'k8s'] },
  'AWS': { d: 'Cloud & DevOps', a: ['aws', 'azure', 'gcp', 'google cloud', 'cloud computing'] },
  'CI/CD': { d: 'Cloud & DevOps', a: ['ci/cd', 'github actions', 'jenkins', 'terraform', 'devops'] },
  'Linux': { d: 'Cloud & DevOps', a: ['linux', 'bash'] },
  // Security
  'Cybersecurity': { d: 'Cybersecurity', a: ['cybersecurity', 'cyber security', 'penetration testing', 'ctf', 'cryptography', 'infosec'] },
  // Web3
  'Blockchain': { d: 'Blockchain & Web3', a: ['blockchain', 'web3', 'solidity', 'ethereum', 'smart contract', 'smart contracts'] },
  // Design / product / business
  'UI/UX': { d: 'Design', a: ['ui/ux', 'ux', 'figma', 'user research', 'wireframe', 'wireframing'] },
  'Product Management': { d: 'Business', a: ['product management', 'product manager', 'roadmap'] },
  'Marketing': { d: 'Business', a: ['marketing', 'seo', 'branding', 'content writing'] },
  'Finance': { d: 'Business', a: ['finance', 'financial modelling', 'financial modeling', 'valuation', 'equity research'] },
  'Consulting': { d: 'Business', a: ['consulting', 'case study', 'case competition', 'strategy', 'market research'] },
  'Public Speaking': { d: 'Business', a: ['public speaking', 'presentation', 'presentations', 'debate'] },
  'IoT': { d: 'Hardware & IoT', a: ['iot', 'arduino', 'raspberry pi', 'embedded', 'robotics'] },
};

const DOMAINS = [...new Set(Object.values(SKILLS).map((s) => s.d))];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compiled = Object.entries(SKILLS).map(([name, { d, a }]) => ({
  name,
  domain: d,
  // lookarounds keep "c" from matching inside "c++" and "java" inside "javascript"
  res: [name.toLowerCase(), ...a].map((alias) => new RegExp(`(?<![\\w+#.])${esc(alias)}(?![\\w+#])`, 'gi')),
}));

// Returns [{ name, domain, hits }] for every skill mentioned in text.
function extractSkills(text) {
  const out = [];
  for (const s of compiled) {
    let hits = 0;
    for (const re of s.res) {
      re.lastIndex = 0;
      const m = text.match(re);
      if (m) hits += m.length;
    }
    if (hits) out.push({ name: s.name, domain: s.domain, hits });
  }
  return out;
}

const domainOf = (skill) => SKILLS[skill]?.d || null;

module.exports = { SKILLS, DOMAINS, extractSkills, domainOf };
