import { Storage } from '@google-cloud/storage';
import { OAuth2Client } from 'google-auth-library';
import { execSync } from 'child_process';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let storageClient: Storage | null = null;

function getActiveGcloudToken(): string | null {
  try {
    const token = execSync('gcloud auth print-access-token', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim();
    return token || null;
  } catch (e) {
    return null;
  }
}

export function getGcsClient(): Storage {
  if (!storageClient) {
    try {
      // First try standard ADC / environment
      storageClient = new Storage({
        projectId: env.GCS_PROJECT_ID,
      });
    } catch (e) {
      storageClient = null;
    }
  }

  // Check if we need token-assisted client
  const activeToken = getActiveGcloudToken();
  if (activeToken) {
    const authClient = new OAuth2Client();
    authClient.setCredentials({ access_token: activeToken });
    return new Storage({
      projectId: env.GCS_PROJECT_ID,
      authClient,
    });
  }

  return storageClient || new Storage({ projectId: env.GCS_PROJECT_ID });
}

export function getGcsBucket() {
  const client = getGcsClient();
  return client.bucket(env.GCS_BUCKET_NAME);
}

/**
 * Upload a memory buffer directly to Google Cloud Storage
 */
export async function uploadBufferToGcs(
  buffer: Buffer,
  gcsKey: string,
  mimeType: string = 'application/octet-stream',
  metadata: Record<string, any> = {}
): Promise<{ gcsKey: string; publicUrl: string; signedUrl?: string }> {
  try {
    const bucket = getGcsBucket();
    const file = bucket.file(gcsKey);

    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
        metadata: {
          ...metadata,
          uploadedAt: new Date().toISOString(),
        },
      },
      resumable: false,
      validation: false,
    });

    const publicUrl = `https://storage.googleapis.com/${env.GCS_BUCKET_NAME}/${encodeURI(gcsKey)}`;

    // Attempt to generate a V4 signed URL for immediate fast client loading
    let signedUrl: string | undefined;
    try {
      signedUrl = await getSignedDownloadUrl(gcsKey, undefined, env.GCS_SIGNED_URL_EXPIRY_MINUTES);
    } catch (signErr) {
      logger.warn(`Could not generate signed URL immediately for ${gcsKey}: ${signErr}`);
      signedUrl = publicUrl;
    }

    return {
      gcsKey,
      publicUrl,
      signedUrl,
    };
  } catch (err: any) {
    logger.error(`Error uploading buffer to GCS (${gcsKey}):`, err);
    throw err;
  }
}

/**
 * Generate a V4 signed download/view URL with configurable expiration
 */
export async function getSignedDownloadUrl(
  gcsKey: string,
  downloadAsFilename?: string,
  expiresInMinutes: number = env.GCS_SIGNED_URL_EXPIRY_MINUTES
): Promise<string> {
  try {
    const bucket = getGcsBucket();
    const file = bucket.file(gcsKey);

    const expires = Date.now() + expiresInMinutes * 60 * 1000;

    const options: any = {
      version: 'v4',
      action: 'read',
      expires,
    };

    if (downloadAsFilename) {
      options.responseDisposition = `attachment; filename="${encodeURIComponent(downloadAsFilename)}"`;
    }

    const [signedUrl] = await file.getSignedUrl(options);
    return signedUrl;
  } catch (err: any) {
    // If V4 signing fails (e.g. credentials environment without direct service account key), fallback to GCS storage URL
    logger.warn(`getSignedUrl fallback for ${gcsKey}: ${err?.message || err}`);
    return `https://storage.googleapis.com/${env.GCS_BUCKET_NAME}/${encodeURI(gcsKey)}`;
  }
}

/**
 * Generate a V4 signed upload PUT URL for client-side direct upload
 */
export async function getSignedUploadUrl(
  gcsKey: string,
  mimeType: string = 'application/octet-stream',
  expiresInMinutes: number = 30
): Promise<string> {
  const bucket = getGcsBucket();
  const file = bucket.file(gcsKey);

  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + expiresInMinutes * 60 * 1000,
    contentType: mimeType,
  });

  return signedUrl;
}

/**
 * Delete a file from GCS
 */
export async function deleteFromGcs(gcsKey: string): Promise<boolean> {
  try {
    const bucket = getGcsBucket();
    const file = bucket.file(gcsKey);
    await file.delete({ ignoreNotFound: true });
    return true;
  } catch (err: any) {
    logger.error(`Error deleting ${gcsKey} from GCS:`, err);
    return false;
  }
}

/**
 * Get readable stream for direct GCS streaming to client
 */
export function getGcsReadStream(gcsKey: string) {
  const bucket = getGcsBucket();
  const file = bucket.file(gcsKey);
  return file.createReadStream();
}

/**
 * Get file metadata from GCS
 */
export async function getGcsFileMetadata(gcsKey: string) {
  const bucket = getGcsBucket();
  const file = bucket.file(gcsKey);
  const [metadata] = await file.getMetadata();
  return metadata;
}

/**
 * Health check on GCS connectivity
 */
export async function checkGcsHealth(): Promise<{ ok: boolean; bucket: string; error?: string }> {
  try {
    const bucket = getGcsBucket();
    const [exists] = await bucket.exists();
    return { ok: exists, bucket: env.GCS_BUCKET_NAME };
  } catch (err: any) {
    return { ok: false, bucket: env.GCS_BUCKET_NAME, error: err?.message || String(err) };
  }
}

