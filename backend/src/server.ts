// Reload server with clean Student ID format & empty email display fix
import express, { Application } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler, notFound } from './middleware/validate';
import { setupSocketIO } from './sockets';

import authRoutes from './routes/auth.routes';
import orgRoutes from './routes/org.routes';
import channelRoutes from './routes/channel.routes';
import taskRoutes from './routes/task.routes';
import aiRoutes from './routes/ai.routes';
import userRoutes from './routes/user.routes';
import notifRoutes from './routes/notification.routes';
import dashboardRoutes from './routes/dashboard.routes';
import fileRoutes from './routes/file.routes';
import meetingRoutes from './routes/meeting.routes';
import searchRoutes from './routes/search.routes';
import rolePermissionsRoutes from './routes/role-permissions.routes';
import attendanceRoutes from './routes/attendance.routes';
import homeworkRoutes from './routes/homework.routes';
import parentRoutes from './routes/parent.routes';
import financeRoutes from './routes/finance.routes';
import timetableRoutes from './routes/timetable.routes';
import promotionRoutes from './routes/promotion.routes';
import examRoutes from './routes/exam.routes';

const app: Application = express();
const server = http.createServer(app);

app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(','),
  credentials: true,
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('tiny'));

// Rate limit (5000 requests/min for local dev)
const limiter = rateLimit({ windowMs: 60 * 1000, max: 5000, standardHeaders: true, legacyHeaders: false });
app.use('/api', limiter);

// Health
app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));
app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));
app.get('/api/v1/llm_bridge/health', async (_req, res) => {
  try {
    const url = env.LLM_BRIDGE_URL.endsWith('/llm_bridge')
      ? `${env.LLM_BRIDGE_URL}/health`
      : `${env.LLM_BRIDGE_URL}/llm_bridge/health`;
    const bridgeResp = await axios.get(url, { timeout: 5000 });
    res.json({ status: 'ok', bridge: bridgeResp.data });
  } catch (err: any) {
    res.status(503).json({ status: 'unavailable', error: err?.message });
  }
});

// Swagger
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'Enterprise AI Collaboration Platform', version: '1.0.0' },
    servers: [{ url: '/api/v1' }],
  },
  apis: ['./src/routes/*.ts'],
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes (all under /api/v1)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/orgs', orgRoutes);
app.use('/api/v1/orgs', rolePermissionsRoutes);
app.use('/api/v1/channels', channelRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/notifications', notifRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/files', fileRoutes);
app.use('/api/v1/meetings', meetingRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/homework', homeworkRoutes);
app.use('/api/v1/parent', parentRoutes);
app.use('/api/v1/finance', financeRoutes);
app.use('/api/v1/timetable', timetableRoutes);
app.use('/api/v1/orgs/:orgId/promotion', promotionRoutes);
app.use('/api/v1/exams', examRoutes);

// Handle unmatched /api routes
app.use('/api', notFound);

// Error Handler
app.use(errorHandler);

// Serve Frontend Static Build (Full-stack single container / Cloud Run production)
const candidateStaticDirs = [
  path.resolve(__dirname, '../frontend-build'),
  path.resolve(__dirname, '../../frontend/build'),
  path.resolve(process.cwd(), 'frontend-build'),
  path.resolve(process.cwd(), 'frontend/build'),
];
const staticDir = candidateStaticDirs.find((dir) => fs.existsSync(dir));

if (staticDir) {
  logger.info(`📦 Serving frontend static assets from: ${staticDir}`);
  app.use(express.static(staticDir));

  // SPA fallback: any non-API GET request serves index.html for client-side routing (/login, /dashboard, etc.)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(staticDir, 'index.html'));
  });
} else {
  // If static files are not present (pure backend mode), provide clean root status
  app.get('/', (_req, res) => {
    res.json({
      service: 'Convee Education Platform API',
      status: 'online',
      docs: '/api/docs',
      health: '/api/health',
    });
  });
}

// Setup Socket.IO
const io = setupSocketIO(server);
app.locals.io = io;

server.listen(env.PORT, '0.0.0.0', () => {
  logger.info(`🚀 Backend listening on 0.0.0.0:${env.PORT}`);
  logger.info(`📖 API Docs at /api/docs`);
});

// Graceful shutdown — ensures port is released before nodemon restarts
// This prevents the recurring "EADDRINUSE: address already in use" error
const gracefulShutdown = (signal: string) => {
  logger.info(`[${signal}] Graceful shutdown initiated — closing HTTP server...`);
  server.close((err) => {
    if (err) {
      logger.error('Error during server close:', err);
      process.exit(1);
    }
    logger.info('HTTP server closed. Port released.');
    process.exit(0);
  });

  // Force exit after 3 seconds if connections don't drain
  setTimeout(() => {
    logger.warn('Forcing shutdown after timeout.');
    process.exit(0);
  }, 3000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
