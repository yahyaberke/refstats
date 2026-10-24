import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: int('PORT', 4000),
  appUrl: (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
  sessionTtlDays: int('SESSION_TTL_DAYS', 30),
  uploadDir: path.resolve(serverRoot, process.env.UPLOAD_DIR ?? 'uploads'),
  clientDist: path.resolve(serverRoot, '..', 'client', 'dist'),
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: int('SMTP_PORT', 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM ?? 'RefStats <no-reply@example.com>',
  },
  mailDevLog: process.env.MAIL_DEV_LOG === 'true' && process.env.NODE_ENV !== 'production',
} as const;

export const SESSION_COOKIE = 'rs_session';
