import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { logger } from '../utils/logger';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          issues: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
        });
      }
      next(err);
    }
  };
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  logger.error('Unhandled error:', err?.message || err);
  if (err?.stack) logger.error(err.stack);

  // Handle JSON parse errors
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON payload in request body' });
  }

  // Handle Prisma Database Exceptions
  if (err?.code === 'P2002') {
    const fields = Array.isArray(err?.meta?.target) ? err.meta.target.join(', ') : 'field';
    return res.status(409).json({ error: `A record with this ${fields} already exists.` });
  }
  if (err?.code === 'P2025') {
    return res.status(404).json({ error: err?.meta?.cause || 'Requested record was not found.' });
  }
  if (err?.code === 'P2003') {
    return res.status(400).json({ error: 'Invalid reference or foreign key constraint failed.' });
  }
  if (err?.code === 'P2014') {
    return res.status(400).json({ error: 'Required relation constraint violation.' });
  }

  // Handle custom status codes or fallback to 500
  const status = typeof err?.status === 'number' ? err.status : (typeof err?.statusCode === 'number' ? err.statusCode : 500);
  res.status(status).json({
    error: err?.message || 'Internal server error',
  });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Endpoint not found' });
}

