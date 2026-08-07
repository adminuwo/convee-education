import { Request, Response, NextFunction } from 'express';
import { OrgRole } from '@prisma/client';
import prisma from '../db/prisma';

const ROLE_LEVEL: Record<string, number> = {
  STUDENT: 0,
  TEACHER: 1,
  HOD: 2,
  DEAN: 3,
  PRINCIPAL: 4,
  ADMIN: 4,
  DIRECTOR: 5,
  OWNER: 5,
};

export function requireRole(minRole: OrgRole) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (req.user.systemRole === 'SUPER_ADMIN') return next();
    const orgId = req.currentOrgId || (req.headers['x-org-id'] as string);
    if (!orgId) return res.status(400).json({ error: 'Missing org context (x-org-id header)' });
    const membership = await prisma.membership.findFirst({
      where: { userId: req.user.id, orgId, isActive: true },
    });
    if (!membership) return res.status(403).json({ error: 'Not a member of this organization' });
    if (ROLE_LEVEL[membership.role] < ROLE_LEVEL[minRole]) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    req.currentOrgId = orgId;
    req.currentMembership = membership;
    next();
  };
}

export function requireSystemRole(role: 'SUPER_ADMIN' | 'USER') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (req.user.systemRole !== role) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}
