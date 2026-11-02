const KEY = 'hackelite_token';
export const getToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* storage blocked */ } };

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  register: (b) => request('/auth/register', { method: 'POST', body: b }),
  login: (b) => request('/auth/login', { method: 'POST', body: b }),
  me: () => request('/auth/me'),
  stats: () => request('/listings/stats'),
  listings: (params) => request(`/listings?${new URLSearchParams(params)}`),
  listing: (id) => request(`/listings/${id}`),
  recommendations: () => request('/me/recommendations'),
  updateProfile: (b) => request('/me/profile', { method: 'PUT', body: b }),
  uploadResume: (file) => { const f = new FormData(); f.append('resume', file); return request('/me/resume', { method: 'POST', form: f }); },
  deleteResume: () => request('/me/resume', { method: 'DELETE' }),
  saved: () => request('/me/saved'),
  saveListing: (id, b = {}) => request(`/me/saved/${id}`, { method: 'PUT', body: b }),
  unsave: (id) => request(`/me/saved/${id}`, { method: 'DELETE' }),
  ask: (question) => request('/ask', { method: 'POST', body: { question } }),
};
