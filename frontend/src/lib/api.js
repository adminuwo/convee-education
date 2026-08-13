import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
export const API_BASE = `${BACKEND_URL}/api/v1`;
export const SOCKET_URL = BACKEND_URL;


const api = axios.create({ baseURL: API_BASE });

let accessToken = localStorage.getItem('accessToken');
let refreshToken = localStorage.getItem('refreshToken');
let currentOrgId = localStorage.getItem('currentOrgId');

export const setTokens = (access, refresh) => {
  accessToken = access;
  refreshToken = refresh;
  if (access) localStorage.setItem('accessToken', access);
  else localStorage.removeItem('accessToken');
  if (refresh) localStorage.setItem('refreshToken', refresh);
  else localStorage.removeItem('refreshToken');
};

export const getAccessToken = () => accessToken;
export const getRefreshToken = () => refreshToken;

export const setCurrentOrgId = (id) => {
  currentOrgId = id;
  if (id) localStorage.setItem('currentOrgId', id);
  else localStorage.removeItem('currentOrgId');
};
export const getCurrentOrgId = () => currentOrgId;

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  if (currentOrgId) config.headers['x-org-id'] = currentOrgId;
  return config;
});

let refreshingPromise = null;
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    if (err?.response?.status === 401 && !original._retry && refreshToken) {
      original._retry = true;
      try {
        if (!refreshingPromise) {
          refreshingPromise = axios.post(`${API_BASE}/auth/refresh`, { refreshToken }).then((r) => {
            setTokens(r.data.accessToken, r.data.refreshToken);
            return r.data.accessToken;
          }).finally(() => { refreshingPromise = null; });
        }
        const newAccess = await refreshingPromise;
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (e) {
        setTokens(null, null);
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

export const authApi = {
  register: (data) => api.post('/auth/register', data).then((r) => r.data),
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  googleStart: (state) => api.get('/auth/google/start', { params: { state } }).then((r) => r.data),
  googleCallback: (code) => api.post('/auth/google/callback', { code }).then((r) => r.data),
  verifyEmail: (token) => api.get('/auth/verify-email', { params: { token } }).then((r) => r.data),
  resendVerification: (email) => api.post('/auth/resend-verification', { email }).then((r) => r.data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }).then((r) => r.data),
};


export const orgApi = {
  list: () => api.get('/orgs').then((r) => r.data),
  create: (data) => api.post('/orgs', data).then((r) => r.data),
  get: (id) => api.get(`/orgs/${id}`).then((r) => r.data),
  update: (id, data) => api.patch(`/orgs/${id}`, data).then((r) => r.data),
  members: (id) => api.get(`/orgs/${id}/members`).then((r) => r.data),
  invite: (id, data) => api.post(`/orgs/${id}/invite`, data).then((r) => r.data),
  getPendingInvitations: (id) => api.get(`/orgs/${id}/pending-invitations`).then((r) => r.data),
  revokeInvitation: (id, membershipId) => api.delete(`/orgs/${id}/invitations/${membershipId}`).then((r) => r.data),
  respondInvite: (membershipId, action) => api.post(`/orgs/invitations/${membershipId}/respond`, { action }).then((r) => r.data),
  departments: (id) => api.get(`/orgs/${id}/departments`).then((r) => r.data),
  createDept: (id, data) => api.post(`/orgs/${id}/departments`, data).then((r) => r.data),
  updateDept: (id, deptId, data) => api.patch(`/orgs/${id}/departments/${deptId}`, data).then((r) => r.data),
  deleteDept: (id, deptId) => api.delete(`/orgs/${id}/departments/${deptId}`).then((r) => r.data),
  createTeam: (id, deptId, data) => api.post(`/orgs/${id}/departments/${deptId}/teams`, data).then((r) => r.data),
  deleteTeam: (id, teamId) => api.delete(`/orgs/${id}/teams/${teamId}`).then((r) => r.data),
  getTeam: (orgId, teamId) => api.get(`/orgs/${orgId}/teams/${teamId}`).then((r) => r.data),
  updateTeam: (orgId, teamId, data) => api.patch(`/orgs/${orgId}/teams/${teamId}`, data).then((r) => r.data),
  addTeamMember: (orgId, teamId, userIds) => api.post(`/orgs/${orgId}/teams/${teamId}/members`, { userIds: Array.isArray(userIds) ? userIds : [userIds] }).then((r) => r.data),
  removeTeamMember: (orgId, teamId, membershipId) => api.delete(`/orgs/${orgId}/teams/${teamId}/members/${membershipId}`).then((r) => r.data),
  projects: (id) => api.get(`/orgs/${id}/projects`).then((r) => r.data),
  getProject: (orgId, projectId) => api.get(`/orgs/${orgId}/projects/${projectId}`).then((r) => r.data),
  createProject: (id, teamId, data) => {
    if (typeof teamId === 'object') {
      return api.post(`/orgs/${id}/projects`, teamId).then((r) => r.data);
    }
    return api.post(`/orgs/${id}/teams/${teamId}/projects`, data).then((r) => r.data);
  },
  addProjectTeam: (orgId, projectId, teamId) => api.post(`/orgs/${orgId}/projects/${projectId}/teams`, { teamId }).then((r) => r.data),
  removeProjectTeam: (orgId, projectId, teamId) => api.delete(`/orgs/${orgId}/projects/${projectId}/teams/${teamId}`).then((r) => r.data),
  assignProjectMember: (orgId, projectId, userIds) => api.post(`/orgs/${orgId}/projects/${projectId}/assign`, { userIds: Array.isArray(userIds) ? userIds : [userIds] }).then((r) => r.data),
  removeProjectMember: (orgId, projectId, membershipId) => api.delete(`/orgs/${orgId}/projects/${projectId}/members/${membershipId}`).then((r) => r.data),
  updateMemberRole: (orgId, membershipId, role) => api.patch(`/orgs/${orgId}/members/${membershipId}`, { role }).then((r) => r.data),
  transferOwnership: (orgId, membershipId) => api.post(`/orgs/${orgId}/transfer-ownership`, { newOwnerMembershipId: membershipId }).then((r) => r.data),
  transferRequest: (orgId, data) => api.post(`/orgs/${orgId}/transfer-request`, data).then((r) => r.data),
  transferRespond: (orgId, data) => api.post(`/orgs/${orgId}/transfer-respond`, data).then((r) => r.data),
  removeMember: (orgId, membershipId) => api.delete(`/orgs/${orgId}/members/${membershipId}`).then((r) => r.data),
};


export const channelApi = {
  list: (orgId) => api.get('/channels', { params: { orgId } }).then((r) => r.data),
  create: (data) => api.post('/channels', data).then((r) => r.data),
  get: (id) => api.get(`/channels/${id}`).then((r) => r.data),
  join: (id) => api.post(`/channels/${id}/join`).then((r) => r.data),
  leave: (id) => api.post(`/channels/${id}/leave`).then((r) => r.data),
  messages: (id, cursor) => api.get(`/channels/${id}/messages`, { params: { cursor } }).then((r) => r.data),
  sendMessage: (id, data) => api.post(`/channels/${id}/messages`, data).then((r) => r.data),
  editMessage: (channelId, messageId, content) => api.patch(`/channels/${channelId}/messages/${messageId}`, { content }).then((r) => r.data),
  deleteMessage: (channelId, messageId) => api.delete(`/channels/${channelId}/messages/${messageId}`).then((r) => r.data),
  react: (channelId, messageId, emoji) => api.post(`/channels/${channelId}/messages/${messageId}/react`, { emoji }).then((r) => r.data),
  pin: (channelId, messageId) => api.post(`/channels/${channelId}/messages/${messageId}/pin`).then((r) => r.data),
  pinned: (id) => api.get(`/channels/${id}/pinned`).then((r) => r.data),
  search: (id, q) => api.get(`/channels/${id}/search`, { params: { q } }).then((r) => r.data),
  dm: (orgId, targetUserId) => api.post('/channels/dm', { orgId, targetUserId }).then((r) => r.data),
  markRead: (id) => api.post(`/channels/${id}/read`).then((r) => r.data),
  addMembers: (id, userIds) => api.post(`/channels/${id}/members`, { userIds }).then((r) => r.data),
  removeMember: (id, userId) => api.delete(`/channels/${id}/members/${userId}`).then((r) => r.data),
  deleteChannel: (id) => api.delete(`/channels/${id}`).then((r) => r.data),
};

export const taskApi = {
  list: (orgId, params = {}) => api.get('/tasks', { params: { orgId, ...params } }).then((r) => r.data),
  create: (data) => api.post('/tasks', data).then((r) => r.data),
  get: (id) => api.get(`/tasks/${id}`).then((r) => r.data),
  update: (id, data) => api.patch(`/tasks/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/tasks/${id}`).then((r) => r.data),
  respond: (taskId, userId, status, note, requestedDueDate) => api.post(`/tasks/${taskId}/assignees/${userId}/respond`, { status, note, requestedDueDate }).then((r) => r.data),
  approveExtension: (taskId, assigneeUserId, newDueDate) => api.post(`/tasks/${taskId}/approve-extension`, { assigneeUserId, newDueDate }).then((r) => r.data),
  rejectExtension: (taskId, assigneeUserId, note) => api.post(`/tasks/${taskId}/reject-extension`, { assigneeUserId, note }).then((r) => r.data),
  approveSubmission: (taskId, assigneeUserId) => api.post(`/tasks/${taskId}/approve-submission`, { assigneeUserId }).then((r) => r.data),
  requestChanges: (taskId, assigneeUserId, feedback) => api.post(`/tasks/${taskId}/request-changes`, { assigneeUserId, feedback }).then((r) => r.data),
  comment: (taskId, content) => api.post(`/tasks/${taskId}/comments`, { content }).then((r) => r.data),
  toggleChecklist: (taskId, itemId, isDone) => api.patch(`/tasks/${taskId}/checklist/${itemId}`, { isDone }).then((r) => r.data),
};

export const aiApi = {
  chat: (message, sessionKey) => api.post('/ai/chat', { message, sessionKey }).then((r) => r.data),
  summarizeChannel: (channelId) => api.post('/ai/summarize-channel', { channelId }).then((r) => r.data),
  generateTasks: (channelId, orgId, persist) => api.post('/ai/generate-tasks', { channelId, orgId, persist }).then((r) => r.data),
  draftReply: (channelId, userPrompt) => api.post('/ai/draft-reply', { channelId, userPrompt }).then((r) => r.data),
  sprintPlan: (orgId, goal, durationDays) => api.post('/ai/sprint-plan', { orgId, goal, durationDays }).then((r) => r.data),
  conversations: () => api.get('/ai/conversations').then((r) => r.data),
  createConversation: (title) => api.post('/ai/conversations', { title }).then((r) => r.data),
  deleteConversation: (sessionKey) => api.delete(`/ai/conversations/${sessionKey}`).then((r) => r.data),
  history: (sessionKey) => api.get(`/ai/conversations/${sessionKey}/messages`).then((r) => r.data),
};

export const userApi = {
  list: (params = {}) => api.get('/users', { params }).then((r) => r.data),
  get: (id) => api.get(`/users/${id}`).then((r) => r.data),
  updateMe: (data) => api.patch('/users/me', data).then((r) => r.data),
  setPassword: (data) => api.post('/users/me/password', data).then((r) => r.data),
};

export const notifApi = {
  list: (params = {}) => api.get('/notifications', { params }).then((r) => r.data),
  markRead: (id) => api.post(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.post('/notifications/read-all').then((r) => r.data),
};

export const dashboardApi = {
  employee: (orgId) => api.get('/dashboard/employee', { params: { orgId } }).then((r) => r.data),
  manager: (orgId) => api.get('/dashboard/manager', { params: { orgId } }).then((r) => r.data),
  orgAdmin: (orgId) => api.get('/dashboard/org-admin', { params: { orgId } }).then((r) => r.data),
  director: (orgId) => api.get('/dashboard/director', { params: { orgId } }).then((r) => r.data),
  superAdmin: () => api.get('/dashboard/super-admin').then((r) => r.data),
  analytics: (orgId) => api.get('/dashboard/analytics', { params: { orgId } }).then((r) => r.data),
};

export const meetingApi = {
  list: (orgId) => api.get('/meetings', { params: { orgId } }).then((r) => r.data),
  create: (data) => api.post('/meetings', data).then((r) => r.data),
  get: (id) => api.get(`/meetings/${id}`).then((r) => r.data),
  update: (id, data) => api.patch(`/meetings/${id}`, data).then((r) => r.data),
  summarize: (id) => api.post(`/meetings/${id}/summarize`).then((r) => r.data),
};

export const fileApi = {
  upload: (formData) => api.post('/files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  list: (orgId) => api.get('/files', { params: { orgId } }).then((r) => r.data),
  listByChannel: (orgId, channelId) => api.get('/files', { params: { orgId, channelId } }).then((r) => r.data),
  delete: (id) => api.delete(`/files/${id}`).then((r) => r.data),
  download: (id) => `${API_BASE}/files/${id}/download?token=${encodeURIComponent(getAccessToken() || '')}`,
};

export const searchApi = {
  global: (q, orgId) => api.get('/search', { params: { q, orgId } }).then((r) => r.data),
};

export const rolePermissionsApi = {
  get: (orgId) => api.get(`/orgs/${orgId}/role-permissions`).then((r) => r.data),
  createRole: (orgId, data) => api.post(`/orgs/${orgId}/roles`, data).then((r) => r.data),
  updatePermissions: (orgId, roleName, data) => api.patch(`/orgs/${orgId}/roles/${encodeURIComponent(roleName)}/permissions`, data).then((r) => r.data),
  deleteRole: (orgId, roleName) => api.delete(`/orgs/${orgId}/roles/${encodeURIComponent(roleName)}`).then((r) => r.data),
};

export const studentApi = {
  generateSingle: (orgId, data) => api.post(`/orgs/${orgId}/students/generate-single`, data).then((r) => r.data),
  generateMass: (orgId, data) => api.post(`/orgs/${orgId}/students/generate-mass`, data).then((r) => r.data),
};

export const attendanceApi = {
  batchLog: (data) => api.post('/attendance/batch', data).then((r) => r.data),
  getByTeam: (teamId, date) => api.get(`/attendance/team/${teamId}`, { params: { date } }).then((r) => r.data),
  getStats: (orgId) => api.get('/attendance/stats', { params: { orgId } }).then((r) => r.data),
};

export const homeworkApi = {
  submit: (taskId, data) => api.post(`/homework/${taskId}/submit`, data).then((r) => r.data),
  getSubmissions: (taskId) => api.get(`/homework/${taskId}/submissions`).then((r) => r.data),
  gradeSubmission: (taskId, submissionId, data) => api.post(`/homework/${taskId}/submissions/${submissionId}/grade`, data).then((r) => r.data),
  getDepartmentOverview: (orgId) => api.get('/homework/oversight/departments-overview', { params: { orgId } }).then((r) => r.data),
  getDepartmentTeachers: (orgId, departmentId) => api.get('/homework/oversight/department-teachers', { params: { orgId, departmentId } }).then((r) => r.data),
  getTeacherAssignments: (orgId, teacherId) => api.get('/homework/oversight/teacher-assignments', { params: { orgId, teacherId } }).then((r) => r.data),
};

export const parentApi = {
  getMyChildren: () => api.get('/parent/my-children').then((r) => r.data),
  getChildReport: (studentId, orgId) => api.get(`/parent/child/${studentId}/report`, { params: { orgId } }).then((r) => r.data),
  linkParentStudent: (data) => api.post('/parent/link', data).then((r) => r.data),
};

export const aiExtendedApi = {
  generateQuiz: (data) => api.post('/ai/generate-quiz', data).then((r) => r.data),
  dailyBriefing: (orgId) => api.post('/ai/daily-briefing', { orgId }).then((r) => r.data),
};

export const financeApi = {
  getOverview: () => api.get('/finance/overview').then((r) => r.data),
  getFees: (params) => api.get('/finance/fees', { params }).then((r) => r.data),
  createFee: (data) => api.post('/finance/fees', data).then((r) => r.data),
  updateFee: (id, data) => api.put(`/finance/fees/${id}`, data).then((r) => r.data),
  getParentFees: () => api.get('/finance/fees/parent').then((r) => r.data),
  getPayroll: () => api.get('/finance/payroll').then((r) => r.data),
  createPayroll: (data) => api.post('/finance/payroll', data).then((r) => r.data),
  getFacultySalary: () => api.get('/finance/salary/faculty').then((r) => r.data),
  getMyPayslips: () => api.get('/finance/my-payslips').then((r) => r.data),
  getTallyCompanies: () => api.get('/finance/tally/companies').then((r) => r.data),
  syncTally: (data) => api.post('/finance/sync/tally', data).then((r) => r.data),
};

export const timetableApi = {
  getSlots: (params) => api.get('/timetable/slots', { params }).then((r) => r.data),
  getFreeTeachers: (params) => api.get('/timetable/free-teachers', { params }).then((r) => r.data),
  getAbsences: (params) => api.get('/timetable/absences', { params }).then((r) => r.data),
  reportAbsence: (data) => api.post('/timetable/absences', data).then((r) => r.data),
  assignProxy: (data) => api.post('/timetable/proxy/assign', data).then((r) => r.data),
  createSlot: (data) => api.post('/timetable/slots', data).then((r) => r.data),
  deleteSlot: (id) => api.delete(`/timetable/slots/${id}`).then((r) => r.data),
};


