import type { NextFunction, Request, Response } from 'express';
import type { User } from '@prisma/client';
import { prisma } from '../db';
import { HttpError } from '../lib/errors';
import { clearSessionCookie, currentTokenHash } from '../lib/session';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
    }
  }
}

export type AuthedRequest = Request & { user: User; sessionId: string };

/** Oturum çerezini çözer; geçerliyse req.user'ı doldurur. Hiçbir zaman hata fırlatmaz. */
export async function loadUser(req: Request, res: Response, next: NextFunction) {
  try {
    const tokenHash = currentTokenHash(req);
    if (!tokenHash) return next();
    const session = await prisma.session.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!session || session.expiresAt < new Date()) {
      if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      clearSessionCookie(res);
      return next();
    }
    if (session.user.status === 'SUSPENDED' || session.user.status === 'CLOSED') {
      // Askıya alınan / kapatılan hesapların tüm oturumları geçersizdir.
      await prisma.session.deleteMany({ where: { userId: session.userId } });
      clearSessionCookie(res);
      return next();
    }
    req.user = session.user;
    req.sessionId = session.id;
    // lastUsedAt'i en fazla 5 dakikada bir güncelle.
    if (Date.now() - session.lastUsedAt.getTime() > 5 * 60 * 1000) {
      await prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, 'Bu işlem için giriş yapmalısınız', 'UNAUTHENTICATED'));
  next();
}

/** Rol kontrolü sunucu tarafında yapılır; arayüzde menünün gizlenmesi tek başına güvenlik sağlamaz. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, 'Bu işlem için giriş yapmalısınız', 'UNAUTHENTICATED'));
  if (req.user.role !== 'ADMIN') return next(new HttpError(403, 'Bu alana erişim yetkiniz yok', 'FORBIDDEN'));
  next();
}

/**
 * CSRF koruması: Durum değiştiren isteklerde özel bir başlık zorunludur.
 * Tarayıcılar farklı kökenden bu başlığı CORS ön kontrolü olmadan gönderemez; sunucu CORS'a izin vermez.
 * SameSite=Lax çerez ile birlikte çift katmanlı koruma sağlar.
 */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-requested-with') !== 'RefStats') {
    return next(new HttpError(403, 'Geçersiz istek kaynağı', 'CSRF'));
  }
  next();
}
