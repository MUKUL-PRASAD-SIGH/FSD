// Lightweight Indian geography so "near me" works without a geocoding API.
// Cities map to a canonical name and a state; NCR satellites collapse into "delhi-ncr".
const ALIASES = {
  bangalore: 'bengaluru', bengaluru: 'bengaluru', blr: 'bengaluru',
  bombay: 'mumbai', mumbai: 'mumbai', 'navi mumbai': 'mumbai', thane: 'mumbai',
  madras: 'chennai', chennai: 'chennai', calcutta: 'kolkata', kolkata: 'kolkata',
  hyderabad: 'hyderabad', secunderabad: 'hyderabad', pune: 'pune', ahmedabad: 'ahmedabad', jaipur: 'jaipur', lucknow: 'lucknow',
  indore: 'indore', bhopal: 'bhopal', chandigarh: 'chandigarh', mohali: 'chandigarh', kochi: 'kochi', cochin: 'kochi',
  delhi: 'delhi-ncr', 'new delhi': 'delhi-ncr', 'delhi ncr': 'delhi-ncr', ncr: 'delhi-ncr', noida: 'delhi-ncr', 'greater noida': 'delhi-ncr',
  gurgaon: 'delhi-ncr', gurugram: 'delhi-ncr', faridabad: 'delhi-ncr', ghaziabad: 'delhi-ncr',
  nagpur: 'nagpur', coimbatore: 'coimbatore', vellore: 'vellore', bhubaneswar: 'bhubaneswar', patna: 'patna', guwahati: 'guwahati',
  vadodara: 'vadodara', surat: 'surat', visakhapatnam: 'visakhapatnam', mysuru: 'mysuru', mysore: 'mysuru', dehradun: 'dehradun',
};
const STATE = {
  bengaluru: 'karnataka', mysuru: 'karnataka', mumbai: 'maharashtra', pune: 'maharashtra', nagpur: 'maharashtra',
  chennai: 'tamil nadu', coimbatore: 'tamil nadu', vellore: 'tamil nadu', kolkata: 'west bengal', hyderabad: 'telangana',
  ahmedabad: 'gujarat', vadodara: 'gujarat', surat: 'gujarat', jaipur: 'rajasthan', lucknow: 'uttar pradesh',
  indore: 'madhya pradesh', bhopal: 'madhya pradesh', chandigarh: 'chandigarh', kochi: 'kerala', 'delhi-ncr': 'delhi',
  bhubaneswar: 'odisha', patna: 'bihar', guwahati: 'assam', visakhapatnam: 'andhra pradesh', dehradun: 'uttarakhand',
};

function canonicalCity(text) {
  const t = String(text || '').toLowerCase().replace(/[^a-z\s-]/g, ' ');
  if (!t.trim()) return '';
  // longest alias first so "navi mumbai" beats "mumbai"
  for (const a of Object.keys(ALIASES).sort((x, y) => y.length - x.length)) {
    if (new RegExp(`\\b${a.replace(/\s/g, '\\s+')}\\b`).test(t)) return ALIASES[a];
  }
  return '';
}
const stateOf = (cityOrState) => {
  const c = canonicalCity(cityOrState);
  if (c) return STATE[c] || '';
  return String(cityOrState || '').toLowerCase().trim();
};

// 1 = no travel needed ... 0 = far away and user does not want to travel
function locationFit(user, listing) {
  if (listing.mode === 'ONLINE') return { score: 1, note: 'online, no travel' };
  const uCity = canonicalCity(user.location?.city);
  const uState = stateOf(user.location?.state || user.location?.city);
  const lCity = canonicalCity(`${listing.city} ${listing.venue || ''}`);
  const lState = stateOf(listing.state || listing.city);
  const travel = user.preferences?.willingToTravel;
  const prefCities = (user.preferences?.cities || []).map(canonicalCity);
  if (uCity && lCity && uCity === lCity) return { score: 1, note: `in your city (${listing.city || lCity})` };
  if (lCity && prefCities.includes(lCity)) return { score: 0.9, note: `in a city you like (${listing.city || lCity})` };
  if (uState && lState && uState === lState) return { score: 0.7, note: 'in your state' };
  if (!uCity && !uState) return { score: 0.5, note: '' }; // unknown location: neutral
  if (travel) return { score: 0.45, note: 'you are open to travel' };
  return { score: 0.1, note: '' };
}

module.exports = { canonicalCity, stateOf, locationFit };
