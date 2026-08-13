import { Router } from 'express';
import prisma from '../db/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

export const HARDCODED_SYSTEM_ROLES = [
  'ADMIN',
  'PRINCIPAL',
  'DEAN',
  'HOD',
  'TEACHER',
  'STUDENT',
];

export const ALL_PERMISSIONS = [
  { key: 'post_announcements', label: 'Post in Announcement Channels', category: 'Communication' },
  { key: 'create_channels', label: 'Create Channels (Public/Private)', category: 'Communication' },
  { key: 'delete_channels', label: 'Delete Channels', category: 'Communication' },
  { key: 'manage_members', label: 'Manage Organization Members (Invite/Roles)', category: 'Organization' },
  { key: 'create_meetings', label: 'Schedule & Host Meetings', category: 'Collaboration' },
  { key: 'manage_tasks', label: 'Manage Tasks & Assignments', category: 'Collaboration' },
  { key: 'manage_departments', label: 'Manage Departments & Teams', category: 'Organization' },
  { key: 'manage_projects', label: 'Manage Projects', category: 'Collaboration' },
  { key: 'view_analytics', label: 'View Dashboard Analytics & Workload', category: 'Analytics' },
  { key: 'use_ai_features', label: 'Access AI Assistant & Draft Generation', category: 'AI Tools' },
];

function getDefaultPermissionsForRole(role: string): string[] {
  const r = role.toUpperCase();
  if (['DIRECTOR', 'ADMIN', 'PRINCIPAL'].includes(r)) {
    return ALL_PERMISSIONS.map((p) => p.key);
  }
  if (['DEAN', 'HOD'].includes(r)) {
    return [
      'post_announcements',
      'create_channels',
      'create_meetings',
      'manage_tasks',
      'manage_departments',
      'manage_projects',
      'view_analytics',
      'use_ai_features',
    ];
  }
  if (['TEACHER'].includes(r)) {
    return ['create_channels', 'create_meetings', 'manage_tasks', 'use_ai_features'];
  }
  if (['STUDENT'].includes(r)) {
    return ['create_meetings', 'manage_tasks', 'use_ai_features'];
  }
  return ['use_ai_features'];
}

async function verifyOwnerAccess(userId: string, orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return { allowed: false, error: 'Organization not found' };
  if (org.ownerId === userId) return { allowed: true, org };
  const membership = await prisma.membership.findFirst({ where: { userId, orgId, isActive: true } });
  if (membership && ['DIRECTOR', 'ADMIN'].includes(membership.role)) return { allowed: true, org };
  return { allowed: false, error: 'Only Directors and Admins can manage role permissions' };
}

// Get all roles & permissions for organization
router.get('/:orgId/role-permissions', async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const membership = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId, isActive: true } });
    if (!membership) return res.status(403).json({ error: 'Not a member of this organization' });

    const storedPermissions = await (prisma as any).rolePermission.findMany({ where: { orgId } });
    const storedMap = new Map<string, any>(storedPermissions.map((rp: any) => [rp.role.toUpperCase(), rp]));

    const resultRoles: Array<{
      role: string;
      description?: string | null;
      isSystem: boolean;
      permissions: string[];
    }> = [];

    // Process system roles
    for (const sysRole of HARDCODED_SYSTEM_ROLES) {
      const stored = storedMap.get(sysRole.toUpperCase());
      resultRoles.push({
        role: sysRole,
        description: stored?.description || `Default system role for ${sysRole.toLowerCase()}`,
        isSystem: true,
        permissions: stored ? (stored.permissions as string[]) : getDefaultPermissionsForRole(sysRole),
      });
    }

    // Process custom roles
    for (const rp of storedPermissions) {
      const isHardcoded = HARDCODED_SYSTEM_ROLES.some((r) => r.toUpperCase() === rp.role.toUpperCase());
      if (!isHardcoded) {
        resultRoles.push({
          role: rp.role,
          description: rp.description || 'Custom organization role',
          isSystem: false,
          permissions: (rp.permissions as string[]) || [],
        });
      }
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { ownerId: true } });
    const isOwner = org?.ownerId === req.user!.id || ['DIRECTOR', 'ADMIN'].includes(membership.role);

    const visibleRoles = resultRoles.filter((r) => r.role.toUpperCase() !== 'ACCOUNTANT');

    res.json({
      roles: visibleRoles,
      allPermissions: ALL_PERMISSIONS,
      isOwner,
    });
  } catch (e) {
    next(e);
  }
});

// Create new custom role (Owner only)
router.post('/:orgId/roles', async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const authCheck = await verifyOwnerAccess(req.user!.id, orgId);
    if (!authCheck.allowed) return res.status(403).json({ error: authCheck.error });

    const { role, description, permissions } = req.body;
    if (!role || !role.trim()) return res.status(400).json({ error: 'Role name is required' });

    const cleanRoleName = role.trim().toUpperCase().replace(/\s+/g, '_');

    const isSystemRole = HARDCODED_SYSTEM_ROLES.includes(cleanRoleName);
    if (isSystemRole) {
      return res.status(400).json({ error: `"${cleanRoleName}" is a built-in system role and already exists.` });
    }

    const existing = await (prisma as any).rolePermission.findFirst({
      where: { orgId, role: { equals: cleanRoleName, mode: 'insensitive' } },
    });

    if (existing) {
      return res.status(400).json({ error: `Role "${cleanRoleName}" already exists in this organization.` });
    }

    const newRole = await (prisma as any).rolePermission.create({
      data: {
        orgId,
        role: cleanRoleName,
        description: description?.trim() || 'Custom organization role',
        isSystem: false,
        permissions: Array.isArray(permissions) ? permissions : [],
      },
    });

    res.status(201).json({
      role: newRole.role,
      description: newRole.description,
      isSystem: false,
      permissions: newRole.permissions as string[],
    });
  } catch (e) {
    next(e);
  }
});

// Update permissions for a role (Owner only)
router.patch('/:orgId/roles/:roleName/permissions', async (req, res, next) => {
  try {
    const { orgId, roleName } = req.params;
    const authCheck = await verifyOwnerAccess(req.user!.id, orgId);
    if (!authCheck.allowed) return res.status(403).json({ error: authCheck.error });

    const { permissions, description } = req.body;
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions must be an array of string keys' });
    }

    const cleanRoleName = roleName.trim().toUpperCase();
    if (['DIRECTOR', 'OWNER'].includes(cleanRoleName)) {
      return res.status(400).json({ error: `Role "${cleanRoleName}" is the top executive role and always retains full system permissions.` });
    }
    const isSystem = HARDCODED_SYSTEM_ROLES.includes(cleanRoleName);

    const updated = await (prisma as any).rolePermission.upsert({
      where: { orgId_role: { orgId, role: cleanRoleName } },
      create: {
        orgId,
        role: cleanRoleName,
        description: description || (isSystem ? `System role (${cleanRoleName})` : 'Custom role'),
        isSystem,
        permissions,
      },
      update: {
        permissions,
        ...(description !== undefined ? { description } : {}),
      },
    });

    res.json({
      role: updated.role,
      description: updated.description,
      isSystem: updated.isSystem,
      permissions: updated.permissions as string[],
    });
  } catch (e) {
    next(e);
  }
});

// Delete custom role (Owner only - Hardcoded system roles CANNOT be deleted)
router.delete('/:orgId/roles/:roleName', async (req, res, next) => {
  try {
    const { orgId, roleName } = req.params;
    const authCheck = await verifyOwnerAccess(req.user!.id, orgId);
    if (!authCheck.allowed) return res.status(403).json({ error: authCheck.error });

    const cleanRoleName = roleName.trim().toUpperCase();

    // Check if role is hardcoded system role
    const isSystemRole = HARDCODED_SYSTEM_ROLES.includes(cleanRoleName);
    if (isSystemRole) {
      return res.status(400).json({ error: `Role "${cleanRoleName}" is a hardcoded system role and cannot be deleted.` });
    }

    const existing = await (prisma as any).rolePermission.findFirst({
      where: { orgId, role: { equals: cleanRoleName, mode: 'insensitive' } },
    });

    if (!existing) {
      return res.status(404).json({ error: `Custom role "${roleName}" not found.` });
    }

    if (existing.isSystem) {
      return res.status(400).json({ error: `System role "${existing.role}" cannot be deleted.` });
    }

    await (prisma as any).rolePermission.delete({ where: { id: existing.id } });

    res.json({ message: `Custom role "${existing.role}" successfully deleted.` });
  } catch (e) {
    next(e);
  }
});

export default router;
