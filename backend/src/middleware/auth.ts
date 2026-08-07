import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import prisma from '../db/prisma';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        systemRole?: string;
      };
      currentOrgId?: string;
      currentMembership?: any;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    let token = '';
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      token = auth.slice(7);
    } else if (req.query?.token) {
      token = String(req.query.token);
    }

    if (!token) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const decoded = verifyAccessToken(token);
    req.user = { id: decoded.sub, email: decoded.email, systemRole: decoded.systemRole };
    return next();
  } catch (e: any) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      const decoded = verifyAccessToken(auth.slice(7));
      req.user = { id: decoded.sub, email: decoded.email, systemRole: decoded.systemRole };
    }
  } catch {
    // ignore
  }
  next();
}

export async function attachOrg(req: Request, res: Response, next: NextFunction) {
  const orgId = (req.headers['x-org-id'] as string) || (req.query.orgId as string);
  if (!orgId) return next();
  if (!req.user) return next();
  const membership = await prisma.membership.findFirst({
    where: { userId: req.user.id, orgId, isActive: true },
  });
  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this organization' });
  }
  req.currentOrgId = orgId;
  req.currentMembership = membership;
  next();
}
