import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import prisma from '../db/prisma';
import { uploadBufferToGcs } from '../services/gcs.service';
import { env } from '../config/env';

async function migrateLocalFiles() {
  console.log('🚀 Starting Migration of Local Files to Google Cloud Storage (gs://education-tool-objects)...');

  const uploadDir = env.UPLOAD_DIR;
  if (!fs.existsSync(uploadDir)) {
    console.log('No uploads directory found.');
    return;
  }

  const files = fs.readdirSync(uploadDir);
  console.log(`Found ${files.length} files in local uploads directory.`);

  // Fetch admin user & demo organization
  const adminUser = await prisma.user.findFirst({ where: { email: 'admin@demo.edu' } });
  const defaultOrg = await prisma.organization.findFirst();

  let migratedCount = 0;

  for (const filename of files) {
    const filePath = path.join(uploadDir, filename);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;

    console.log(`\n📦 Migrating file: ${filename} (${stat.size} bytes)...`);
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    const mimeType = (mime as any).lookup(filename) || 'application/octet-stream';

    // Extract text preview if applicable
    let textContent = '';
    if (['.txt', '.md', '.json', '.csv', '.py', '.js', '.ts', '.html'].includes(ext)) {
      try {
        textContent = buffer.toString('utf-8').slice(0, 30000);
      } catch (e) {}
    }

    const gcsKey = `migrated-legacy-uploads/${filename}`;
    const uploadRes = await uploadBufferToGcs(buffer, gcsKey, mimeType, {
      migratedFrom: 'local-disk',
      originalFilename: filename,
    });

    console.log(`✅ Uploaded to GCS: ${uploadRes.gcsKey}`);

    // Check if a database asset exists with this filename
    let asset = await prisma.fileAsset.findFirst({
      where: { storedPath: filename },
    });

    const metadataObj: any = {
      ...(asset?.metadata ? (asset.metadata as any) : {}),
      ...(textContent ? { textContent } : {}),
      storageProvider: 'GCS',
      bucket: env.GCS_BUCKET_NAME,
      publicUrl: uploadRes.publicUrl,
      signedUrl: uploadRes.signedUrl,
      migratedAt: new Date().toISOString(),
    };

    if (asset) {
      await prisma.fileAsset.update({
        where: { id: asset.id },
        data: {
          storedPath: gcsKey,
          mimeType,
          size: stat.size,
          metadata: metadataObj,
        },
      });
      console.log(`Updated database record for asset: ${asset.id}`);
    } else if (adminUser && defaultOrg) {
      // Create new database asset record for orphaned local file
      const newAsset = await prisma.fileAsset.create({
        data: {
          uploaderId: adminUser.id,
          orgId: defaultOrg.id,
          originalName: filename,
          storedPath: gcsKey,
          mimeType,
          size: stat.size,
          metadata: metadataObj,
        },
      });
      console.log(`Created new database record for asset: ${newAsset.id}`);
    }

    migratedCount++;
  }

  console.log(`\n🎉 Migration Complete! Successfully migrated ${migratedCount} files to gs://education-tool-objects and updated database records.`);
}

migrateLocalFiles()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Migration Error:', err);
    process.exit(1);
  });
