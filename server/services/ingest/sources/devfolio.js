// Devfolio public hackathon listing (applications currently open).
const { getJson, stripHtml } = require('../common');

async function fetchListings({ pages = 4 } = {}) {
  const out = [];
  for (let page = 1; page <= pages; page++) {
    const j = await getJson(`https://api.devfolio.co/api/hackathons?filter=application_open&page=${page}&count=24`);
    for (const h of j.result || []) {
      const s = h.hackathon_setting || {};
      const sub = s.subdomain || h.slug;
      out.push({
        externalId: h.uuid,
        title: h.name,
        organiser: (h.location || '').split(',')[0].trim(),
        type: 'HACKATHON',
        platform: 'Devfolio',
        url: s.site || `https://${sub}.devfolio.co/`,
        deadline: new Date(s.reg_ends_at || h.ends_at),
        mode: h.is_online ? 'ONLINE' : 'OFFLINE',
        city: h.is_online ? '' : h.city || '',
        eligibility: h.is_university_hackathon ? ['University students'] : [],
        tags: (h.themes || []).map((t) => (typeof t === 'string' ? t : t.name)).filter(Boolean),
        description: stripHtml((h.tagline || '') + ' ' + (h.desc || '')),
        registered: h.participants_count || null,
      });
    }
    if (page >= (j.pages || 1)) break;
  }
  return out;
}

module.exports = { name: 'devfolio', fetchListings };
