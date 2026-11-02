const KEY = 'hackelite_token';
export const getToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* storage blocked */ } };

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(path, { method = 'GET', body, form, auth = true } = {}) {
  const headers = {};
  const token = getToken();
  if (token && auth) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
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
  google: (b) => j('POST', '/auth/google', b),
  forgot: (email) => j('POST', '/auth/forgot', { email }),
  reset: (b) => j('POST', '/auth/reset', b),
  changePassword: (b) => j('POST', '/auth/change-password', b),
  deleteAccount: (password) => request('/auth/me', { method: 'DELETE', body: { password } }),
  logoutAll: () => j('POST', '/auth/logout-all'),
  me: () => request('/auth/me'),

  stats: () => request('/listings/stats', { auth: false }),
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
};
