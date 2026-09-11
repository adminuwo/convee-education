import axios from 'axios';
import { storage } from './storage';

export const LIVE_BACKEND_URL = 'https://convee-education-977864306871.asia-south1.run.app';
export const LOCAL_BACKEND_URL = 'http://10.0.2.2:8001';

let activeBaseUrl = `${LIVE_BACKEND_URL}/api/v1`;

export const getBaseUrl = () => activeBaseUrl;

export const setBaseUrl = async (url: string) => {
  activeBaseUrl = url.endsWith('/api/v1') ? url : `${url}/api/v1`;
  await storage.set('custom_server_url', activeBaseUrl);
  api.defaults.baseURL = activeBaseUrl;
};

export const api = axios.create({
  baseURL: activeBaseUrl,
  timeout: 15000,
});

// Initialize server URL from storage
storage.get('custom_server_url').then((saved) => {
  if (saved) {
    activeBaseUrl = saved;
    api.defaults.baseURL = saved;
  }
});

let accessToken: string | null = null;
let refreshToken: string | null = null;
let currentOrgId: string | null = null;

export const setTokens = async (access: string | null, refresh: string | null) => {
  accessToken = access;
  refreshToken = refresh;
  if (access) await storage.set('accessToken', access);
  else await storage.remove('accessToken');
  if (refresh) await storage.set('refreshToken', refresh);
  else await storage.remove('refreshToken');
};

export const setCurrentOrgId = async (id: string | null) => {
  currentOrgId = id;
  if (id) await storage.set('currentOrgId', id);
  else await storage.remove('currentOrgId');
};

export const getAccessToken = () => accessToken;
export const getCurrentOrgId = () => currentOrgId;

// Hydrate stored tokens
export const hydrateAuthTokens = async () => {
  accessToken = await storage.get('accessToken');
  refreshToken = await storage.get('refreshToken');
  currentOrgId = await storage.get('currentOrgId');
  const savedUrl = await storage.get('custom_server_url');
  if (savedUrl) {
    activeBaseUrl = savedUrl;
    api.defaults.baseURL = savedUrl;
  }
};

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  if (currentOrgId) config.headers['x-org-id'] = currentOrgId;
  return config;
});

let refreshingPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    if (err?.response?.status === 401 && !original?._retry && refreshToken) {
      original._retry = true;
      try {
        if (!refreshingPromise) {
          refreshingPromise = axios
            .post(`${activeBaseUrl}/auth/refresh`, { refreshToken })
            .then(async (res) => {
              await setTokens(res.data.accessToken, res.data.refreshToken);
              return res.data.accessToken;
            })
            .finally(() => {
              refreshingPromise = null;
            });
        }
        const newAccess = await refreshingPromise;
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (e) {
        await setTokens(null, null);
      }
    }
    return Promise.reject(err);
  }
);

// 1. Auth API
export const authApi = {
  login: (data: { email: string; password: string; portalMode?: string }) =>
    api.post('/auth/login', data).then((r) => r.data),
  register: (data: any) => api.post('/auth/register', data).then((r) => r.data),
  logout: () => api.post('/auth/logout', { refreshToken }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
};

// 2. Dashboard API
export const dashboardApi = {
  employee: (orgId: string) => api.get('/dashboard/employee', { params: { orgId } }).then((r) => r.data),
  manager: (orgId: string) => api.get('/dashboard/manager', { params: { orgId } }).then((r) => r.data),
  orgAdmin: (orgId: string) => api.get('/dashboard/org-admin', { params: { orgId } }).then((r) => r.data),
};

// 3. Homework API
export const homeworkApi = {
  tasks: (orgId: string) => api.get('/tasks', { params: { orgId } }).then((r) => r.data),
  submit: (taskId: string, data: { content?: string; attachmentUrl?: string }) =>
    api.post(`/homework/${taskId}/submit`, data).then((r) => r.data),
  getSubmissions: (taskId: string) => api.get(`/homework/${taskId}/submissions`).then((r) => r.data),
  gradeSubmission: (taskId: string, subId: string, data: any) =>
    api.post(`/homework/${taskId}/submissions/${subId}/grade`, data).then((r) => r.data),
  createTask: (data: any) => api.post('/tasks', data).then((r) => r.data),
};

// 4. Attendance API
export const attendanceApi = {
  batchLog: (data: { orgId: string; teamId: string; date?: string; records: any[] }) =>
    api.post('/attendance/batch', data).then((r) => r.data),
  getStats: (orgId: string) => api.get('/attendance/stats', { params: { orgId } }).then((r) => r.data),
  getByTeam: (teamId: string, date?: string) =>
    api.get(`/attendance/team/${teamId}`, { params: { date } }).then((r) => r.data),
};

// 5. Parent API
export const parentApi = {
  getMyChildren: () => api.get('/parent/my-children').then((r) => r.data),
  getChildReport: (studentId: string, orgId?: string) =>
    api.get(`/parent/child/${studentId}/report`, { params: { orgId } }).then((r) => r.data),
};

// 6. Channels & Chat API
export const channelApi = {
  list: (orgId: string) => api.get('/channels', { params: { orgId } }).then((r) => r.data),
  getMessages: (channelId: string) => api.get(`/channels/${channelId}/messages`).then((r) => r.data),
  sendMessage: (channelId: string, content: string) =>
    api.post(`/channels/${channelId}/messages`, { content }).then((r) => r.data),
  dm: (orgId: string, targetUserId: string) =>
    api.post('/channels/dm', { orgId, targetUserId }).then((r) => r.data),
};

// 7. AI Assistant API
export const aiApi = {
  chat: (message: string, sessionKey?: string, orgId?: string) =>
    api.post('/ai/chat', { message, sessionKey, orgId }).then((r) => r.data),
  generateQuiz: (notes: string, subject?: string, numQuestions?: number) =>
    api.post('/ai/generate-quiz', { notes, subject, numQuestions }).then((r) => r.data),
  dailyBriefing: (orgId: string) => api.post('/ai/daily-briefing', { orgId }).then((r) => r.data),
};

export default api;
