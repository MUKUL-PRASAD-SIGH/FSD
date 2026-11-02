// Embedding providers behind one interface. MongoDB stores the vectors (no separate vector DB).
//   local  : deterministic feature-hashing model (words + bigrams + canonical skill tokens). No network, no key.
//   gemini : Google text-embedding-004 (768-d). Needs GEMINI_API_KEY. Falls back to local if the call fails.
// Every stored vector remembers the model that made it; vectors from different models are never compared.
const { config } = require('../config/env');
const { extractSkills } = require('./skills');

const LOCAL_DIM = 384;
const LOCAL_MODEL = 'local-hash-v1';
const STOP = new Set('the a an and or of to in for on with at by from is are be as this that it we you your our will can all any new more open join build team event'.split(' '));

function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

function localEmbed(text) {
  const base = String(text || '').toLowerCase().replace(/[^a-z0-9+#./\s]/g, ' ').split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t));
  // Canonical skill tokens let "ML", "machine learning" and "deep learning" land near each other
  const canon = extractSkills(text || '').flatMap((s) => [`skill:${s.name.toLowerCase()}`, `domain:${s.domain.toLowerCase()}`]);
  const feats = [...base, ...base.slice(1).map((t, i) => `${base[i]}_${t}`), ...canon, ...canon];
  const v = new Float32Array(LOCAL_DIM);
  const tf = new Map();
  for (const f of feats) tf.set(f, (tf.get(f) || 0) + 1);
  for (const [f, c] of tf) {
    const h = fnv(f);
    v[h % LOCAL_DIM] += (h & 0x80000000 ? -1 : 1) * (1 + Math.log(c));
  }
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return Array.from(v, (x) => +(x / n).toFixed(5));
}

async function geminiEmbed(texts) {
  const model = 'text-embedding-004';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.geminiKey },
    body: JSON.stringify({ requests: texts.map((t) => ({ model: `models/${model}`, content: { parts: [{ text: t.slice(0, 8000) }] } })) }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Gemini embeddings ${res.status}`);
  const j = await res.json();
  return j.embeddings.map((e) => e.values);
}

const activeModel = () => (config.embeddingsProvider === 'gemini' && config.geminiKey ? 'gemini-text-embedding-004' : LOCAL_MODEL);

// Returns { model, vectors }
async function embed(texts) {
  if (activeModel() !== LOCAL_MODEL) {
    try {
      const out = [];
      for (let i = 0; i < texts.length; i += 50) out.push(...(await geminiEmbed(texts.slice(i, i + 50))));
      return { model: 'gemini-text-embedding-004', vectors: out };
    } catch (e) {
      console.warn(`embeddings: Gemini failed (${e.message}); using local model`);
    }
  }
  return { model: LOCAL_MODEL, vectors: texts.map(localEmbed) };
}

const cosine = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na) * Math.sqrt(nb) || 1);
};

module.exports = { embed, cosine, localEmbed, activeModel, LOCAL_MODEL };
