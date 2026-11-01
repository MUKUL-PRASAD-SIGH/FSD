import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach JWT token to outgoing requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('hackelite_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor to handle unauthorized / expired tokens gracefully
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expired or invalid
      const currentToken = localStorage.getItem('hackelite_token');
      if (currentToken) {
        localStorage.removeItem('hackelite_token');
        localStorage.removeItem('hackelite_user');
      }
    }
    return Promise.reject(error);
  }
);

// API Service Functions
export const authService = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  getStudents: () => api.get('/auth/students'),
};

export const opportunityService = {
  getAll: (params) => api.get('/opportunities', { params }),
  getById: (id) => api.get(`/opportunities/${id}`),
  create: (data) => api.post('/opportunities', data),
  update: (id, data) => api.put(`/opportunities/${id}`, data),
  delete: (id) => api.delete(`/opportunities/${id}`),
  toggleSave: (id) => api.post(`/opportunities/${id}/save`),
  getSaved: () => api.get('/opportunities/saved/all'),
};

export const applicationService = {
  apply: (opportunityId, formData) =>
    api.post(`/applications/${opportunityId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getMyApplications: () => api.get('/applications/my'),
  getAdminApplications: (params) => api.get('/applications/admin/all', { params }),
  updateStatus: (id, data) => api.put(`/applications/${id}/status`, data),
  withdraw: (id) => api.delete(`/applications/${id}`),
};

export const teamService = {
  getAll: (params) => api.get('/teams', { params }),
  getById: (id) => api.get(`/teams/${id}`),
  create: (formData) =>
    api.post('/teams', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  requestJoin: (id, data) => api.post(`/teams/${id}/request`, data),
  manageRequest: (teamId, requestId, data) =>
    api.put(`/teams/${teamId}/requests/${requestId}`, data),
};

export const analyticsService = {
  getOverview: (params) => api.get('/analytics/overview', { params }),
};

export const aiService = {
  chat: (message) => api.post('/ai/chat', { message }),
};

export const auditLogService = {
  getRecentLogs: () => api.get('/logs/view'),
};

export default api;
