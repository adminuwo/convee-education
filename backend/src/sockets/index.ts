import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import prisma from '../db/prisma';
import { logger } from '../utils/logger';

export function setupSocketIO(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: '/socket.io',
    transports: ['websocket', 'polling'],
  });

  // Track active socket connections per user ID
  const activeUserSockets = new Map<string, Set<string>>();

  // On server startup, reset all user statuses to 'offline' in database
  prisma.user.updateMany({ data: { status: 'offline' } }).catch((e) => {
    logger.error('Failed to reset user statuses on startup', e?.message);
  });

  io.use((socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Missing auth token'));
      const payload = verifyAccessToken(String(token));
      (socket as any).user = { id: payload.sub, email: payload.email, systemRole: payload.systemRole };
      next();
    } catch (e: any) {
      next(new Error('Invalid auth token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const user = (socket as any).user;
    logger.info(`Socket connected: ${socket.id} user=${user.email}`);
    socket.join(`user:${user.id}`);

    // Track user socket connection
    let userSockets = activeUserSockets.get(user.id);
    if (!userSockets) {
      userSockets = new Set();
      activeUserSockets.set(user.id, userSockets);
    }

    const wasOffline = userSockets.size === 0;
    userSockets.add(socket.id);

    if (wasOffline) {
      // Mark user online in database and broadcast presence
      await prisma.user.update({ where: { id: user.id }, data: { status: 'online', lastSeenAt: new Date() } }).catch(() => {});
      io.emit('user:presence', { userId: user.id, status: 'online' });
    }

    // Auto-join user's org rooms + channel rooms (including public channels)
    try {
      const memberships = await prisma.membership.findMany({ where: { userId: user.id, isActive: true } });
      const orgIds = memberships.map((m) => m.orgId);
      orgIds.forEach((orgId) => socket.join(`org:${orgId}`));

      const [channelMemberships, publicChannels] = await Promise.all([
        prisma.channelMember.findMany({ where: { userId: user.id }, select: { channelId: true } }),
        prisma.channel.findMany({ where: { orgId: { in: orgIds }, type: 'PUBLIC', isArchived: false }, select: { id: true } }),
      ]);

      const channelIdsToJoin = new Set<string>();
      channelMemberships.forEach((c) => channelIdsToJoin.add(c.channelId));
      publicChannels.forEach((pc) => channelIdsToJoin.add(pc.id));

      channelIdsToJoin.forEach((cid) => socket.join(`channel:${cid}`));
    } catch (e: any) { logger.error('presence init error', e?.message); }

    socket.on('channel:join', (channelId: string) => {
      socket.join(`channel:${channelId}`);
    });
    socket.on('channel:leave', (channelId: string) => {
      socket.leave(`channel:${channelId}`);
    });

    socket.on('typing:start', ({ channelId }: { channelId: string }) => {
      socket.to(`channel:${channelId}`).emit('typing:start', { channelId, userId: user.id });
    });
    socket.on('typing:stop', ({ channelId }: { channelId: string }) => {
      socket.to(`channel:${channelId}`).emit('typing:stop', { channelId, userId: user.id });
    });

    socket.on('disconnect', async () => {
      logger.info(`Socket disconnected: ${socket.id} user=${user.email}`);
      const sockets = activeUserSockets.get(user.id);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          activeUserSockets.delete(user.id);
          await prisma.user.update({ where: { id: user.id }, data: { status: 'offline', lastSeenAt: new Date() } }).catch(() => {});
          io.emit('user:presence', { userId: user.id, status: 'offline' });
        }
      }
    });
  });

  return io;
}
