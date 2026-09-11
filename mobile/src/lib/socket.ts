import { io, Socket } from 'socket.io-client';
import { LIVE_BACKEND_URL, getAccessToken } from './api';

let socket: Socket | null = null;

export const connectSocket = () => {
  if (socket && socket.connected) return socket;

  const token = getAccessToken();
  socket = io(LIVE_BACKEND_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
