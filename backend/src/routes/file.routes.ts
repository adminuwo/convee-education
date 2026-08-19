import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../db/prisma';
import { authenticate } from '../middleware/auth';
import { env } from '../config/env';
import { canUserAccessChannel } from './channel.routes';
import {
  uploadBufferToGcs,
  getSignedDownloadUrl,
  deleteFromGcs,
  getGcsReadStream
} from '../services/gcs.service';
import { logger } from '../utils/logger';

// Use memory storage for direct streaming to Google Cloud Storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

const router = Router();
router.use(authenticate);

// 1. Upload File (Streamed to Google Cloud Storage)
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: 'No file provided' });
    const orgId = (req.body?.orgId as string) || undefined;
    const channelId = (req.body?.channelId as string) || undefined;
    const isStudyMaterial = Boolean(req.body?.isStudyMaterial || channelId);

    // Permission check
    if (orgId) {
      const membership = await prisma.membership.findFirst({
        where: { userId: req.user!.id, orgId, isActive: true },
      });
      if (membership?.role === 'STUDENT') {
        return res.status(403).json({ error: 'Students are not permitted to upload files. Only teachers and faculty can upload files.' });
      }
    }

    // Extract quick text excerpt if textual document
    let textContent = '';
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.txt', '.md', '.json', '.csv', '.html', '.js', '.py', '.ts'].includes(ext) || file.mimetype.includes('text')) {
      try {
        textContent = file.buffer.toString('utf-8').slice(0, 30000);
      } catch (e) {}
    }

    // Generate unique GCS Object Key
    const uid = Math.random().toString(36).substring(2, 12);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const gcsKey = `orgs/${orgId || 'global'}/files/${Date.now()}-${uid}-${sanitizedName}`;

    // Upload directly to Google Cloud Storage
    const { publicUrl, signedUrl } = await uploadBufferToGcs(
      file.buffer,
      gcsKey,
      file.mimetype || 'application/octet-stream',
      {
        originalName: file.originalname,
        uploaderId: req.user!.id,
        orgId: orgId || 'global',
        channelId: channelId || '',
      }
    );

    const metadataObj: any = {
      ...(channelId ? { channelId } : {}),
      ...(isStudyMaterial ? { isStudyMaterial: true } : {}),
      ...(textContent ? { textContent } : {}),
      storageProvider: 'GCS',
      bucket: env.GCS_BUCKET_NAME,
      publicUrl,
      signedUrl,
    };

    const asset = await prisma.fileAsset.create({
      data: {
        uploaderId: req.user!.id,
        orgId,
        originalName: file.originalname,
        storedPath: gcsKey,
        mimeType: file.mimetype,
        size: file.size,
        metadata: metadataObj,
      },
      include: { uploader: { select: { id: true, fullName: true, avatarUrl: true } } },
    });

    res.status(201).json({
      ...asset,
      downloadUrl: signedUrl || publicUrl,
    });
  } catch (e) {
    logger.error('Error in /files/upload:', e);
    next(e);
  }
});

// 2. Download / Stream File via GCS V4 Signed URL (High Speed Direct Edge Streaming)
router.get('/:id/download', async (req, res, next) => {
  try {
    const asset = await prisma.fileAsset.findUnique({ where: { id: req.params.id } });
    if (!asset) return res.status(404).json({ error: 'File not found' });

    // Authorization check
    if (asset.orgId) {
      const membership = await prisma.membership.findFirst({
        where: { userId: req.user!.id, orgId: asset.orgId, isActive: true },
      });
      if (!membership && req.user!.systemRole !== 'SUPER_ADMIN' && asset.uploaderId !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied to this file' });
      }
    } else if (asset.uploaderId !== req.user!.id && req.user!.systemRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Access denied to this file' });
    }

    const channelId = (asset.metadata as any)?.channelId;
    if (channelId) {
      const channel = await prisma.channel.findUnique({ where: { id: channelId } });
      if (channel) {
        const hasAccess = await canUserAccessChannel(req.user!.id, channel);
        if (!hasAccess && req.user!.systemRole !== 'SUPER_ADMIN' && asset.uploaderId !== req.user!.id) {
          return res.status(403).json({ error: 'Access denied to this channel file' });
        }
      }
    }

    // Check if stored in Google Cloud Storage
    const isGcs = asset.storedPath.startsWith('orgs/') || (asset.metadata as any)?.storageProvider === 'GCS';

    if (isGcs) {
      // If JSON format is requested explicitly, return URL object
      if (req.query.json === 'true') {
        const signedUrl = await getSignedDownloadUrl(asset.storedPath, asset.originalName, env.GCS_SIGNED_URL_EXPIRY_MINUTES);
        return res.json({ downloadUrl: signedUrl, originalName: asset.originalName, mimeType: asset.mimeType });
      }

      // Try signed URL redirect if valid signature exists
      try {
        const signedUrl = await getSignedDownloadUrl(asset.storedPath, asset.originalName, env.GCS_SIGNED_URL_EXPIRY_MINUTES);
        if (signedUrl.includes('X-Goog-Signature') || signedUrl.includes('GoogleAccessId')) {
          return res.redirect(signedUrl);
        }
      } catch (signErr) {}

      // High-performance streaming directly from Google Cloud Storage
      res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(asset.originalName)}"`);
      if (asset.size) res.setHeader('Content-Length', String(asset.size));
      res.setHeader('Cache-Control', 'public, max-age=86400');

      const stream = getGcsReadStream(asset.storedPath);
      stream.on('error', (err) => {
        logger.error(`GCS stream error for ${asset.storedPath}:`, err);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to stream file from cloud storage' });
      });
      return stream.pipe(res);
    }

    // Fallback for legacy local disk files
    const filepath = path.join(env.UPLOAD_DIR, asset.storedPath);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File missing' });
    res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(asset.originalName)}"`);
    res.download(filepath, asset.originalName);
  } catch (e) {
    logger.error('Error in /files/:id/download:', e);
    next(e);
  }
});

// 3. List Files with direct access URLs
router.get('/', async (req, res, next) => {
  try {
    const orgId = req.query.orgId as string | undefined;
    const channelId = req.query.channelId as string | undefined;

    if (orgId) {
      const membership = await prisma.membership.findFirst({
        where: { userId: req.user!.id, orgId, isActive: true },
      });
      if (!membership && req.user!.systemRole !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Not a member of this organization' });
      }
    }

    let files = await prisma.fileAsset.findMany({
      where: orgId ? { orgId } : { uploaderId: req.user!.id },
      include: { uploader: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (channelId) {
      files = files.filter((f) => (f.metadata as any)?.channelId === channelId);
    } else {
      files = files.filter((f) => !(f.metadata as any)?.channelId && !(f.metadata as any)?.isStudyMaterial);
    }

    // Map files with direct download / preview links
    const mappedFiles = files.map((f) => {
      const meta = (f.metadata as any) || {};
      const isGcs = f.storedPath.startsWith('orgs/') || meta.storageProvider === 'GCS';
      const directUrl = meta.signedUrl || meta.publicUrl || (isGcs ? `https://storage.googleapis.com/${env.GCS_BUCKET_NAME}/${encodeURI(f.storedPath)}` : null);
      return {
        ...f,
        downloadUrl: directUrl,
      };
    });

    res.json(mappedFiles);
  } catch (e) {
    next(e);
  }
});

// 4. Delete File (from Database & GCS)
router.delete('/:id', async (req, res, next) => {
  try {
    const asset = await prisma.fileAsset.findUnique({ where: { id: req.params.id } });
    if (!asset) return res.status(404).json({ error: 'File not found' });

    let isAuthorized = asset.uploaderId === req.user!.id || req.user!.systemRole === 'SUPER_ADMIN';
    if (!isAuthorized && asset.orgId) {
      const membership = await prisma.membership.findFirst({
        where: { userId: req.user!.id, orgId: asset.orgId, isActive: true },
      });
      if (membership && ['OWNER', 'DIRECTOR', 'PRINCIPAL', 'ADMIN'].includes(membership.role)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Unauthorized to delete this file' });
    }

    // Delete from Google Cloud Storage
    if (asset.storedPath.startsWith('orgs/') || (asset.metadata as any)?.storageProvider === 'GCS') {
      await deleteFromGcs(asset.storedPath);
    } else {
      // Legacy local file cleanup
      const filepath = path.join(env.UPLOAD_DIR, asset.storedPath);
      if (fs.existsSync(filepath)) {
        try { fs.unlinkSync(filepath); } catch (e) {}
      }
    }

    await prisma.fileAsset.delete({ where: { id: asset.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;

