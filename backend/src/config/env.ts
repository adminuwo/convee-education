import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '8001', 10),
  DATABASE_URL: process.env.DATABASE_URL!,
  CORS_ORIGINS: process.env.CORS_ORIGINS || '*',
  JWT_SECRET: process.env.JWT_SECRET || 'change-me',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'change-me-refresh',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '',
  LLM_BRIDGE_URL: process.env.LLM_BRIDGE_URL || 'http://localhost:8002',
  EMERGENT_LLM_KEY: process.env.EMERGENT_LLM_KEY || '',
  DEFAULT_LLM_PROVIDER: process.env.DEFAULT_LLM_PROVIDER || 'openai',
  DEFAULT_LLM_MODEL: process.env.DEFAULT_LLM_MODEL || 'gpt-4o-mini',
  // Vertex AI Configuration (Students, Parents & Alumni)
  VERTEX_PROJECT_ID: process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'ai-mall-484810',
  VERTEX_LOCATION: process.env.VERTEX_LOCATION || 'asia-south1',
  VERTEX_GEMINI_MODEL: process.env.VERTEX_GEMINI_MODEL || 'gemini-2.5-flash',
  STUDENT_LLM_PROVIDER: process.env.STUDENT_LLM_PROVIDER || 'vertexai',
  STUDENT_LLM_MODEL: process.env.STUDENT_LLM_MODEL || 'gemini-2.5-flash',
  // Faculty & Staff LLM Configuration
  FACULTY_LLM_PROVIDER: process.env.FACULTY_LLM_PROVIDER || 'openai',
  FACULTY_LLM_MODEL: process.env.FACULTY_LLM_MODEL || 'gpt-4o-mini',
  APP_URL: process.env.APP_URL || 'http://localhost:3000',
  UPLOAD_DIR: path.resolve(__dirname, '../../uploads'),
  // Google Cloud Storage (GCS) Configuration
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME || 'education-tool-objects',
  GCS_PROJECT_ID: process.env.GCS_PROJECT_ID || process.env.VERTEX_PROJECT_ID || 'ai-mall-484810',
  GCS_SIGNED_URL_EXPIRY_MINUTES: parseInt(process.env.GCS_SIGNED_URL_EXPIRY_MINUTES || '1440', 10), // 24 hours default
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM || '',
};

export const isGoogleOAuthConfigured = () =>
  !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);
