/**
 * POC Test Script - End to end validation of core flows
 * - Auth: register + login + refresh
 * - Chat: create channel + Socket.IO realtime
 * - AI: mention @AI and get response
 * - Task: CRUD + assignee flow
 */
import axios, { AxiosInstance } from 'axios';
import { io as ioClient, Socket } from 'socket.io-client';

const BASE = 'http://localhost:8001/api/v1';
const SOCK_URL = 'http://localhost:8001';

function rand() { return Math.random().toString(36).substring(2, 10); }

async function main() {
  console.log('\n===== POC TEST START =====\n');
  const suffix = rand();
  const alice = { email: `alice-${suffix}@test.com`, password: 'password123', fullName: 'Alice Test', orgName: `TestOrg-${suffix}` };
  const bob = { email: `bob-${suffix}@test.com`, password: 'password123', fullName: 'Bob Test' };

  // Register Alice + Bob
  console.log('[1] Register Alice + Bob');
  const aReg = (await axios.post(`${BASE}/auth/register`, alice)).data;
  console.log('  Alice registered, orgId=', aReg.org.id);
  const bReg = (await axios.post(`${BASE}/auth/register`, bob)).data;
  console.log('  Bob registered, orgId=', bReg.org.id);

  const aliceClient: AxiosInstance = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${aReg.accessToken}` } });
  const bobClient: AxiosInstance = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${bReg.accessToken}` } });

  // Login test
  console.log('[2] Login test');
  const loginResp = (await axios.post(`${BASE}/auth/login`, { email: alice.email, password: alice.password })).data;
  console.log('  Login ok, has accessToken=', !!loginResp.accessToken);

  // Refresh test
  console.log('[3] Refresh test');
  const refreshResp = (await axios.post(`${BASE}/auth/refresh`, { refreshToken: aReg.refreshToken })).data;
  console.log('  Refresh ok, has new accessToken=', !!refreshResp.accessToken);

  // Me
  console.log('[4] Me endpoint');
  const me = (await aliceClient.get('/auth/me')).data;
  console.log('  Me OK, memberships:', me.memberships.length);

  // Invite Bob to Alice's org
  console.log('[5] Invite Bob to Alice org');
  const inv = (await aliceClient.post(`/orgs/${aReg.org.id}/invite`, { email: bob.email, role: 'MANAGER' })).data;
  console.log('  Invited, membership id=', inv.membership.id);

  // Create department + team + project
  console.log('[6] Create dept + team + project');
  const dept = (await aliceClient.post(`/orgs/${aReg.org.id}/departments`, { name: 'Engineering' })).data;
  const team = (await aliceClient.post(`/orgs/${aReg.org.id}/departments/${dept.id}/teams`, { name: 'Backend Team' })).data;
  const project = (await aliceClient.post(`/orgs/${aReg.org.id}/teams/${team.id}/projects`, { name: 'Chat App', description: 'MVP build' })).data;
  console.log('  dept.id=', dept.id, 'team.id=', team.id, 'project.id=', project.id);

  // Channels list
  console.log('[7] List channels');
  const channels = (await aliceClient.get(`/channels?orgId=${aReg.org.id}`)).data;
  console.log('  channels count:', channels.length);
  const general = channels.find((c: any) => c.name === 'general');

  // Create a new channel with Bob (as Bob's original org... but Bob is now in Alice's org)
  console.log('[8] Create private channel with Alice + Bob');
  const newCh = (await aliceClient.post(`/channels`, { orgId: aReg.org.id, name: 'design-crit', type: 'PRIVATE', memberIds: [bReg.user.id] })).data;
  console.log('  new channel:', newCh.id, newCh.name);

  // Socket.IO realtime
  console.log('[9] Socket.IO connect (Bob) + subscribe channel');
  const bobSock: Socket = ioClient(SOCK_URL, { auth: { token: bReg.accessToken }, transports: ['websocket'] });
  await new Promise<void>((res, rej) => {
    bobSock.on('connect', () => { console.log('  Bob socket connected'); res(); });
    bobSock.on('connect_error', (err) => { rej(err); });
    setTimeout(() => rej(new Error('connect timeout')), 5000);
  });
  bobSock.emit('channel:join', newCh.id);

  const messagePromise = new Promise<any>((res) => bobSock.once('message:new', (m: any) => res(m)));

  // Alice sends message
  console.log('[10] Alice sends message in the new channel');
  const msg = (await aliceClient.post(`/channels/${newCh.id}/messages`, { content: 'Hello Bob! Welcome to design-crit.' })).data;
  console.log('  msg.id=', msg.id);

  // Bob receives
  const received = await Promise.race([
    messagePromise,
    new Promise((_r, rej) => setTimeout(() => rej(new Error('realtime message timeout')), 5000)),
  ]);
  console.log('  Bob received realtime msg:', (received as any).content);

  // AI mention
  console.log('[11] AI chat call');
  const aiResp = (await aliceClient.post('/ai/chat', { message: 'Say hello and confirm you are working. Keep it to one sentence.' })).data;
  console.log('  AI response:', aiResp.response?.slice(0, 200));

  // Summarize channel
  console.log('[12] AI summarize channel');
  const sum = (await aliceClient.post('/ai/summarize-channel', { channelId: newCh.id })).data;
  console.log('  Summary excerpt:', (sum.summary || '').slice(0, 200));

  // Task CRUD
  console.log('[13] Task create + list + update');
  const task = (await aliceClient.post('/tasks', {
    orgId: aReg.org.id,
    title: 'Design onboarding',
    description: 'Wireframe the onboarding flow',
    priority: 'HIGH',
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString(),
    projectId: project.id,
    assigneeIds: [bReg.user.id],
    checklist: ['research', 'wireframe', 'review'],
  })).data;
  console.log('  task.id=', task.id, 'assignees:', task.assignees.length);

  const tasks = (await aliceClient.get(`/tasks?orgId=${aReg.org.id}`)).data;
  console.log('  tasks count:', tasks.length);

  // Bob accepts task
  const acc = (await bobClient.post(`/tasks/${task.id}/assignees/${bReg.user.id}/respond`, { status: 'ACCEPTED' })).data;
  console.log('  Bob accepted:', acc.updated);

  // Update task status
  const upd = (await aliceClient.patch(`/tasks/${task.id}`, { status: 'IN_PROGRESS' })).data;
  console.log('  Task updated status:', upd.status);

  // AI generate tasks
  console.log('[14] AI generate tasks from channel');
  await aliceClient.post(`/channels/${newCh.id}/messages`, { content: 'We should add a login page and a signup flow with email verification. Also, deploy to staging by Friday.' });
  const gen = (await aliceClient.post('/ai/generate-tasks', { channelId: newCh.id, orgId: aReg.org.id })).data;
  console.log('  generated tasks:', gen.tasks?.length);

  // Dashboards
  console.log('[15] Employee dashboard');
  const empD = (await bobClient.get(`/dashboard/employee?orgId=${aReg.org.id}`)).data;
  console.log('  Bob dashboard myTasks:', empD.myTasks.length, 'unread:', empD.unreadNotifications);

  console.log('[16] Manager dashboard');
  const mgrD = (await aliceClient.get(`/dashboard/manager?orgId=${aReg.org.id}`)).data;
  console.log('  Manager metrics tasks:', mgrD.metrics.tasks);

  // Notifications
  console.log('[17] Bob notifications');
  const notif = (await bobClient.get('/notifications')).data;
  console.log('  Bob unread:', notif.unreadCount);

  bobSock.disconnect();

  console.log('\n===== POC TEST PASSED ✅ =====\n');
}

main().catch((e) => {
  console.error('\n===== POC TEST FAILED ❌ =====');
  console.error(e?.response?.data || e?.message || e);
  process.exit(1);
});
