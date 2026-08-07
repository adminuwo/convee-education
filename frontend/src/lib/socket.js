import { io } from 'socket.io-client';
import { SOCKET_URL, getAccessToken } from './api';

let socket = null;

export function connectSocket() {
  if (socket && socket.connected) return socket;
  if (socket) socket.disconnect();
  const token = getAccessToken();
  if (!token) return null;
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['polling', 'websocket'],
    path: '/socket.io',
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionAttempts: 10,
    upgrade: true,
  });
  return socket;
}

export function getSocket() { return socket; }

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
