import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import prisma from '../db/prisma';
import { validate } from '../middleware/validate';
import { hashPassword, verifyPassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { authenticate } from '../middleware/auth';
import { env, isGoogleOAuthConfigured } from '../config/env';
import { OAuth2Client } from 'google-auth-library';
import { sendVerificationEmail, sendPasswordResetEmail, isEmailConfigured } from '../utils/email';

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
  orgName: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  portalMode: z.enum(['faculty', 'student']).optional(),
});

const RefreshSchema = z.object({ refreshToken: z.string() });

const ForgotPasswordSchema = z.object({ email: z.string().email() });

const ResetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(6),
});

async function issueTokens(user: { id: string; email: string; systemRole: string }) {
  const payload = { sub: user.id, email: user.email, systemRole: user.systemRole };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId: user.id, token: refreshToken, expiresAt },
  });
  return { accessToken, refreshToken };
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// -------- Register --------
router.post('/register', validate(RegisterSchema), async (req, res, next) => {
  try {
    const { email, password, fullName, orgName } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const passwordHash = await hashPassword(password);

    // If email is configured, user starts unverified; otherwise auto-verify
    const isVerified = !isEmailConfigured();

    const user = await prisma.user.create({
      data: { email, passwordHash, fullName, isVerified },
    });

    // Auto-create org
    const orgSlug = (orgName || `${fullName.toLowerCase().replace(/\s+/g, '-')}-workspace`)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-') + '-' + Math.random().toString(36).substring(2, 7);
    const org = await prisma.organization.create({
      data: {
        name: orgName || `${fullName}'s Workspace`,
        slug: orgSlug,
        ownerId: user.id,
      },
    });
    await prisma.membership.create({
      data: { userId: user.id, orgId: org.id, role: 'DIRECTOR' },
    });
    const generalChannel = await prisma.channel.create({
      data: {
        orgId: org.id,
        name: 'general',
        description: 'Default general channel',
        type: 'PUBLIC',
        createdById: user.id,
      },
    });
    await prisma.channelMember.create({
      data: { channelId: generalChannel.id, userId: user.id, isAdmin: true },
    });

    // Send verification email if configured
    if (isEmailConfigured()) {
      const token = generateToken();
      await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });
      try {
        await sendVerificationEmail(user.email, user.fullName, token);
      } catch (emailErr) {
        console.error('Failed to send verification email:', emailErr);
      }
      return res.status(201).json({
        message: 'Registration successful! Please check your email to verify your account.',
        emailSent: true,
        user: { id: user.id, email: user.email, fullName: user.fullName },
      });
    }

    // Email not configured — issue tokens directly
    const tokens = await issueTokens({ id: user.id, email: user.email, systemRole: user.systemRole });
    res.status(201).json({
      user: { id: user.id, email: user.email, fullName: user.fullName, systemRole: user.systemRole },
      org: { id: org.id, name: org.name, slug: org.slug },
      ...tokens,
    });
  } catch (e) {
    next(e);
  }
});

// -------- Verify Email --------
router.get('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.query as { token: string };
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
    if (!record) return res.status(400).json({ error: 'Invalid or expired verification link' });
    if (record.usedAt) return res.status(400).json({ error: 'This link has already been used' });
    if (record.expiresAt < new Date()) return res.status(400).json({ error: 'Verification link has expired' });

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { isVerified: true } }),
      prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);

    res.json({ success: true, message: 'Email verified successfully! You can now log in.' });
  } catch (e) {
    next(e);
  }
});

// -------- Resend Verification Email --------
router.post('/resend-verification', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (!isEmailConfigured()) return res.status(503).json({ error: 'Email service not configured' });

    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user || user.isVerified) {
      return res.json({ message: 'If that email exists and is unverified, a new link has been sent.' });
    }

    // Invalidate old tokens
    await prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = generateToken();
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await sendVerificationEmail(user.email, user.fullName, token);
    res.json({ message: 'If that email exists and is unverified, a new link has been sent.' });
  } catch (e) {
    next(e);
  }
});

// -------- Forgot Password --------
router.post('/forgot-password', validate(ForgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!isEmailConfigured()) return res.status(503).json({ error: 'Email service not configured' });

    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user || !user.passwordHash) {
      return res.json({ message: 'If that email is registered, a password reset link has been sent.' });
    }

    // Reuse emailVerificationToken table with a prefix for reset tokens
    const token = 'reset_' + generateToken();
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    await sendPasswordResetEmail(user.email, user.fullName, token);
    res.json({ message: 'If that email is registered, a password reset link has been sent.' });
  } catch (e) {
    next(e);
  }
});

// -------- Reset Password --------
router.post('/reset-password', validate(ResetPasswordSchema), async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
    if (!record || !token.startsWith('reset_')) return res.status(400).json({ error: 'Invalid or expired reset link' });
    if (record.usedAt) return res.status(400).json({ error: 'This reset link has already been used' });
    if (record.expiresAt < new Date()) return res.status(400).json({ error: 'Reset link has expired' });

    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Revoke all existing refresh tokens for security
      prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (e) {
    next(e);
  }
});

// -------- Login --------
router.post('/login', validate(LoginSchema), async (req, res, next) => {
  try {
    const { email, password, portalMode } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // Block unverified users only if email service is configured
    if (!user.isVerified && isEmailConfigured()) {
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    // Enforce Portal Isolation (Student Portal vs Faculty & Staff Portal)
    if (portalMode) {
      const activeMemberships = await prisma.membership.findMany({
        where: { userId: user.id, isActive: true },
      });

      const isOnlyStudent = activeMemberships.length > 0 && activeMemberships.every((m) => m.role === 'STUDENT');
      const isFacultyOrStaff = activeMemberships.some((m) => m.role !== 'STUDENT');

      if (portalMode === 'student') {
        if (isFacultyOrStaff) {
          return res.status(403).json({
            error: 'Faculty & Staff accounts cannot log in through the Student Portal. Please switch to the Faculty & Staff portal.',
          });
        }
        if (activeMemberships.length > 0 && !isOnlyStudent) {
          return res.status(403).json({
            error: 'This account does not have student access rights.',
          });
        }
      } else if (portalMode === 'faculty') {
        if (isOnlyStudent) {
          return res.status(403).json({
            error: 'Student accounts cannot log in through the Faculty & Staff Portal. Please switch to the Student Portal.',
          });
        }
      }
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
    const tokens = await issueTokens({ id: user.id, email: user.email, systemRole: user.systemRole });
    res.json({
      user: { id: user.id, email: user.email, fullName: user.fullName, systemRole: user.systemRole, avatarUrl: user.avatarUrl },
      ...tokens,
    });
  } catch (e) {
    next(e);
  }
});

// -------- Refresh --------
router.post('/refresh', validate(RefreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    // rotate
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: 'User not found' });
    const tokens = await issueTokens({ id: user.id, email: user.email, systemRole: user.systemRole });
    res.json(tokens);
  } catch (e) {
    next(e);
  }
});

// -------- Logout --------
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken, userId: req.user!.id },
        data: { revokedAt: new Date() },
      });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// -------- Me --------
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        memberships: {
          include: { organization: true },
          where: { isActive: true },
        },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      systemRole: user.systemRole,
      bio: user.bio,
      timezone: user.timezone,
      status: user.status,
      isVerified: user.isVerified,
      memberships: user.memberships.map((m) => ({
        id: m.id,
        orgId: m.orgId,
        role: m.role,
        organization: { id: m.organization.id, name: m.organization.name, slug: m.organization.slug, logoUrl: m.organization.logoUrl, ownerId: m.organization.ownerId },
      })),
    });
  } catch (e) {
    next(e);
  }
});

// -------- Google OAuth --------
// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
router.get('/google/start', (req, res) => {
  if (!isGoogleOAuthConfigured()) {
    return res.status(503).json({ error: 'Google OAuth not configured. Ask admin to set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' });
  }
  const client = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account consent',
    state: (req.query.state as string) || 'login',
  });
  res.json({ url });
});

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
router.post('/google/callback', async (req, res, next) => {
  try {
    if (!isGoogleOAuthConfigured()) {
      return res.status(503).json({ error: 'Google OAuth not configured' });
    }
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Missing code' });
    const client = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) return res.status(400).json({ error: 'No id_token' });
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) return res.status(400).json({ error: 'Invalid Google account' });
    let user = await prisma.user.findFirst({ where: { OR: [{ googleId: payload.sub }, { email: payload.email }] } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email,
          fullName: payload.name || payload.email,
          googleId: payload.sub,
          avatarUrl: payload.picture,
          isVerified: true, // Google accounts are pre-verified
        },
      });
      const orgSlug = (user.fullName.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'user') + '-ws-' + Math.random().toString(36).substring(2, 7);
      const org = await prisma.organization.create({
        data: { name: `${user.fullName}'s Workspace`, slug: orgSlug, ownerId: user.id },
      });
      await prisma.membership.create({ data: { userId: user.id, orgId: org.id, role: 'DIRECTOR' } });
      const general = await prisma.channel.create({
        data: { orgId: org.id, name: 'general', type: 'PUBLIC', createdById: user.id },
      });
      await prisma.channelMember.create({ data: { channelId: general.id, userId: user.id, isAdmin: true } });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: payload.sub, avatarUrl: user.avatarUrl || payload.picture, isVerified: true },
      });
    }
    const jwtTokens = await issueTokens({ id: user.id, email: user.email, systemRole: user.systemRole });
    res.json({
      user: { id: user.id, email: user.email, fullName: user.fullName, avatarUrl: user.avatarUrl, systemRole: user.systemRole },
      ...jwtTokens,
    });
  } catch (e: any) {
    const errorMsg = e?.response?.data?.error_description || e?.response?.data?.error || e?.message || 'Google authentication failed';
    return res.status(400).json({ error: errorMsg });
  }
});

export default router;
