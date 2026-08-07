import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../db/prisma';
import { authenticate } from '../middleware/auth';
import { env } from '../config/env';

if (!fs.existsSync(env.UPLOAD_DIR)) {
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uid = Math.random().toString(36).substring(2, 12);
    cb(null, `${Date.now()}-${uid}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

const router = Router();
router.use(authenticate);

router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: 'No file' });
    const orgId = (req.body?.orgId as string) || undefined;
    const channelId = (req.body?.channelId as string) || undefined;
    const isStudyMaterial = Boolean(req.body?.isStudyMaterial || channelId);

    if (orgId) {
      const membership = await prisma.membership.findFirst({
        where: { userId: req.user!.id, orgId, isActive: true },
      });
      if (membership?.role === 'STUDENT') {
        if (file && fs.existsSync(path.join(env.UPLOAD_DIR, file.filename))) {
          try { fs.unlinkSync(path.join(env.UPLOAD_DIR, file.filename)); } catch (e) {}
        }
        return res.status(403).json({ error: 'Students are not permitted to upload files. Only teachers and faculty can upload files.' });
      }
    }

    let textContent = '';
    const filepath = path.join(env.UPLOAD_DIR, file.filename);
    if (fs.existsSync(filepath)) {
      try {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.txt', '.md', '.json', '.csv', '.html', '.js', '.py', '.ts'].includes(ext) || file.mimetype.includes('text')) {
          textContent = fs.readFileSync(filepath, 'utf-8').slice(0, 30000);
        }
      } catch (e) {}
    }

    const metadataObj: any = {
      ...(channelId ? { channelId } : {}),
      ...(isStudyMaterial ? { isStudyMaterial: true } : {}),
      ...(textContent ? { textContent } : {}),
    };

    const asset = await prisma.fileAsset.create({
      data: {
        uploaderId: req.user!.id,
        orgId,
        originalName: file.originalname,
        storedPath: file.filename,
        mimeType: file.mimetype,
        size: file.size,
        metadata: metadataObj,
      },
      include: { uploader: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
    res.status(201).json(asset);
  } catch (e) { next(e); }
});

router.get('/:id/download', async (req, res, next) => {
  try {
    const asset = await prisma.fileAsset.findUnique({ where: { id: req.params.id } });
    if (!asset) return res.status(404).json({ error: 'Not found' });
    const filepath = path.join(env.UPLOAD_DIR, asset.storedPath);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File missing' });
    res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(asset.originalName)}"`);
    res.download(filepath, asset.originalName);
  } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try {
    const orgId = req.query.orgId as string | undefined;
    const channelId = req.query.channelId as string | undefined;

    let files = await prisma.fileAsset.findMany({
      where: orgId ? { orgId } : { uploaderId: req.user!.id },
      include: { uploader: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (channelId) {
      // Return ONLY files uploaded specifically to this class channel
      files = files.filter((f) => (f.metadata as any)?.channelId === channelId);
    } else {
      // Global Files page: Return ONLY global files, excluding per-class study files
      files = files.filter((f) => !(f.metadata as any)?.channelId && !(f.metadata as any)?.isStudyMaterial);
    }

    res.json(files);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const asset = await prisma.fileAsset.findUnique({ where: { id: req.params.id } });
    if (!asset) return res.status(404).json({ error: 'File not found' });
    const filepath = path.join(env.UPLOAD_DIR, asset.storedPath);
    if (fs.existsSync(filepath)) {
      try { fs.unlinkSync(filepath); } catch (e) {}
    }
    await prisma.fileAsset.delete({ where: { id: asset.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
