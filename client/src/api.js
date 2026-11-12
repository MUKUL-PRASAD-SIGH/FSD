const KEY = 'hackelite_token';
// Leave blank when the browser and API share an origin. Set VITE_API_ORIGIN when hosting
// the client separately; every computer must use the same API and shared database.
export const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || '').replace(/\/+$/, '');
const API_BASE = `${API_ORIGIN}/api`;
export const getToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* storage blocked */ } };

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(path, { method = 'GET', body, form, auth = true } = {}) {
  const headers = {};
  const token = getToken();
  if (token && auth) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // An expired/revoked session on an authenticated call signs the user out cleanly
    if (res.status === 401 && token && !path.startsWith('/auth/login') && !path.startsWith('/auth/google')) onUnauthorized();
    const err = new Error(data.error || `Request failed (${res.status})`);
    Object.assign(err, { status: res.status, code: data.code, problems: data.problems, fields: data.fields });
    throw err;
  }
  return data;
}

const j = (method, path, body) => request(path, { method, body });

export const api = {
  config: () => request('/auth/config', { auth: false }),
  register: (b) => j('POST', '/auth/register', b),
  login: (b) => j('POST', '/auth/login', b),
  sendVerification: () => j('POST', '/auth/verify/send'),
  verifyEmail: (token) => request('/auth/verify', { method: 'POST', body: { token }, auth: false }),
  google: (b) => j('POST', '/auth/google', b),
  forgot: (email) => j('POST', '/auth/forgot', { email }),
  reset: (b) => j('POST', '/auth/reset', b),
  changePassword: (b) => j('POST', '/auth/change-password', b),
  deleteAccount: (password) => request('/auth/me', { method: 'DELETE', body: { password } }),
  logoutAll: () => j('POST', '/auth/logout-all'),
  me: () => request('/auth/me'),

  stats: () => request('/listings/stats', { auth: false }),
  listing: (id) => request(`/listings/${id}`),
  listings: (params) => request(`/listings?${new URLSearchParams(params)}`, { auth: false }),
  ask: (question) => j('POST', '/ask', { question }),

  recommendations: () => request('/me/recommendations'),
  updateProfile: (b) => j('PUT', '/me/profile', b),
  uploadResume: (file) => { const f = new FormData(); f.append('resume', file); return request('/me/resume', { method: 'POST', form: f }); },
  deleteResume: () => j('DELETE', '/me/resume'),
  saved: () => request('/me/saved'),
  saveListing: (id, b = {}) => j('PUT', `/me/saved/${id}`, b),
  unsave: (id) => j('DELETE', `/me/saved/${id}`),
  notifications: () => request('/me/notifications'),
  readAll: () => j('POST', '/me/notifications/read-all'),
  readOne: (id) => j('POST', `/me/notifications/${id}/read`),

  plan: () => request('/plan'),
  activatePro: (key) => j('POST', '/plan/activate', { key }),
  downgrade: () => j('POST', '/plan/downgrade'),
  listingHistory: (id) => j('GET', `/listings/${id}/ask/history`),
  clearListingHistory: (id) => j('DELETE', `/listings/${id}/ask/history`),
  listingQuestions: (id) => j('GET', `/listings/${id}/questions`),
  listerQuestions: (id) => j('GET', `/lister/listings/${id}/questions`),
  calendarLinks: (id) => request(`/calendar/links/${id}`, { auth: false }),
  calendarSettings: () => j('GET', '/calendar/settings'),
  calendarUpdate: (b) => j('PUT', '/calendar/settings', b),
  calendarCreateToken: () => j('POST', '/calendar/token'),
  calendarRevoke: () => j('DELETE', '/calendar/token'),
  // personalised .ics for one listing: fetched with the session token, returned as a Blob to save
  eventIcs: async (id) => {
    const res = await fetch(`${API_BASE}/calendar/event/${id}.ics`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `Could not create the calendar file (${res.status})`); }
    const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || 'event.ics';
    return { blob: await res.blob(), filename: name };
  },
  // ---- network, teams, chat
  overview: () => request('/network/overview'),
  people: (q) => request(`/network/people?q=${encodeURIComponent(q)}`),
  connect: (b) => j('POST', '/network/requests', b),
  acceptRequest: (id) => j('POST', `/network/requests/${id}/accept`),
  declineRequest: (id) => j('POST', `/network/requests/${id}/decline`),
  cancelRequest: (id) => j('DELETE', `/network/requests/${id}`),
  removeConnection: (userId) => j('DELETE', `/network/connections/${userId}`),
  blockUser: (userId) => j('POST', '/network/block', { userId }),
  blocked: () => request('/network/blocked'),
  unblockUser: (userId) => j('DELETE', `/network/block/${userId}`),
  acceptInvite: (id) => j('POST', `/network/invites/${id}/accept`),
  declineInvite: (id) => j('POST', `/network/invites/${id}/decline`),
  cancelInvite: (id) => j('DELETE', `/network/invites/${id}`),
  recTeammates: () => request('/network/recommendations/teammates'),
  recTeams: () => request('/network/recommendations/teams'),
  teams: () => request('/teams'),
  createTeam: (b) => j('POST', '/teams', b),
  team: (id) => request(`/teams/${id}`),
  updateTeam: (id, b) => j('PUT', `/teams/${id}`, b),
  disbandTeam: (id) => j('DELETE', `/teams/${id}`),
  inviteToTeam: (id, b) => j('POST', `/teams/${id}/invite`, b),
  leaveTeam: (id) => j('POST', `/teams/${id}/leave`),
  removeMember: (id, userId) => j('DELETE', `/teams/${id}/members/${userId}`),
  transferTeam: (id, userId) => j('POST', `/teams/${id}/transfer`, { userId }),
  requestJoin: (id, message) => j('POST', `/teams/${id}/request`, { message }),
  shareListing: (b) => j('POST', '/teams/share', b),
  ideas: (id) => request(`/teams/${id}/ideas`),
  addIdea: (id, b) => j('POST', `/teams/${id}/ideas`, b),
  voteIdea: (id, ideaId, rank) => j('POST', `/teams/${id}/ideas/${ideaId}/vote`, { rank }),
  deleteIdea: (id, ideaId) => j('DELETE', `/teams/${id}/ideas/${ideaId}`),
  chatRooms: () => request('/chat/rooms'),
  openDm: (userId) => j('POST', '/chat/rooms/dm', { userId }),
  createRoom: (b) => j('POST', '/chat/rooms', b),
  room: (id) => request(`/chat/rooms/${id}`),
  roomMessages: (id, before) => request(`/chat/rooms/${id}/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`),
  sendMessage: (id, text) => j('POST', `/chat/rooms/${id}/messages`, { text }),
  markRead: (id) => j('POST', `/chat/rooms/${id}/read`),
  inviteToRoom: (id, userId) => j('POST', `/chat/rooms/${id}/invite`, { userId }),
  leaveRoom: (id) => j('POST', `/chat/rooms/${id}/leave`),
  deleteRoom: (id) => j('DELETE', `/chat/rooms/${id}`),
  registered: (id) => j('POST', `/me/saved/${id}/registered`),
  askListing: (id, question, history) => j('POST', `/listings/${id}/ask`, { question, history }),
  chat: (question, history) => j('POST', '/assistant/chat', { question, history }),

  template: () => request('/lister/template'),
  applyLister: (b) => j('POST', '/lister/apply', b),
  myListings: () => request('/lister/listings'),
  createListing: (b) => j('POST', '/lister/listings', b),
  updateListing: (id, b) => j('PUT', `/lister/listings/${id}`, b),
  deleteListing: (id) => j('DELETE', `/lister/listings/${id}`),

  adminStats: () => request('/admin/stats'),
  adminListers: (status) => request(`/admin/listers?status=${status}`),
  decideLister: (id, decision, note) => j('POST', `/admin/listers/${id}/decision`, { decision, note }),
  adminUsers: (q = '', role = '') => request(`/admin/users?${new URLSearchParams({ q, role })}`),
  patchUser: (id, b) => j('PATCH', `/admin/users/${id}`, b),
  adminListings: (status = '') => request(`/admin/listings?status=${status}`),
  patchListing: (id, status) => j('PATCH', `/admin/listings/${id}`, { status }),
  adminAudit: () => request('/admin/audit'),
  runNotifier: () => j('POST', '/admin/notifier/run'),
  adminSources: () => request('/admin/sources'),
  adminSourceHistory: (s) => request(`/admin/sources/${encodeURIComponent(s)}/history`),
  runIngest: (sources) => j('POST', '/admin/ingest/run', { sources }),
  adminIntegrations: () => request('/admin/integrations'),
};
