import type { Request, Response } from 'express';
import { config, SESSION_COOKIE } from '../config';
import { prisma } from '../db';
import { randomToken, sha256 } from './crypto';

const ttlMs = () => config.sessionTtlDays * 24 * 3600 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax' as const,
    path: '/',
  };
}

/** Yeni oturum oluşturur; ham token yalnızca httpOnly çerezde tutulur, veritabanında özeti saklanır. */
export async function createSession(req: Request, res: Response, userId: string) {
  const token = randomToken(32);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
      ipAddress: req.ip ?? null,
      expiresAt: new Date(Date.now() + ttlMs()),
    },
  });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: ttlMs() });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export function currentTokenHash(req: Request): string | null {
  const token = req.cookies?.[SESSION_COOKIE];
  return typeof token === 'string' && token.length > 20 ? sha256(token) : null;
}
