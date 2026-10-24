import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@refstats/shared';
import { config } from '../config';
import { prisma } from '../db';
import { logActivity } from '../lib/activity';
import { fakeVerify, hashPassword, randomToken, sha256, verifyPassword } from '../lib/crypto';
import { asyncHandler, HttpError, parseBody } from '../lib/errors';
import { sendMail } from '../lib/mailer';
import { serializeMe } from '../lib/serializers';
import { clearSessionCookie, createSession, currentTokenHash } from '../lib/session';
import { requireAuth, type AuthedRequest } from '../middleware/auth';

export const authRouter = Router();

const RESET_TTL_MS = 60 * 60 * 1000;

const limiterOptions = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { error: { message: 'Çok fazla deneme yaptınız. Lütfen birkaç dakika sonra tekrar deneyin.' } },
};
const loginLimiter = rateLimit({ ...limiterOptions, windowMs: 15 * 60 * 1000, limit: 10 });
const registerLimiter = rateLimit({ ...limiterOptions, windowMs: 60 * 60 * 1000, limit: 10 });
const resetLimiter = rateLimit({ ...limiterOptions, windowMs: 60 * 60 * 1000, limit: 5 });

authRouter.post(
  '/register',
  registerLimiter,
  asyncHandler(async (req, res) => {
    const input = parseBody(registerSchema, req.body);
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: input.email }, { username: input.username }] },
      select: { email: true, username: true },
    });
    if (existing) {
      // Kullanıcı adı herkese açık bir tanımlayıcı olduğu için çakışma bildirilebilir.
      // E-posta için genel bir mesaj kullanılır.
      const details: Record<string, string> = {};
      if (existing.username === input.username) details.username = 'Bu kullanıcı adı kullanılıyor';
      if (existing.email === input.email) details.email = 'Bu e-posta ile kayıt oluşturulamıyor';
      throw new HttpError(409, 'Kayıt oluşturulamadı', 'CONFLICT', details);
    }
    const user = await prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash: await hashPassword(input.password),
        lastLoginAt: new Date(),
        settings: { create: {} },
      },
      include: { settings: true },
    });
    await createSession(req, res, user.id);
    await logActivity(user.id, 'account.created', 'Hesap oluşturuldu');
    res.status(201).json({ user: serializeMe(user, user.settings) });
  }),
);

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const input = parseBody(loginSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email }, include: { settings: true } });
    if (!user) {
      await fakeVerify(input.password);
      throw new HttpError(401, 'E-posta veya parola hatalı', 'INVALID_CREDENTIALS');
    }
    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) throw new HttpError(401, 'E-posta veya parola hatalı', 'INVALID_CREDENTIALS');
    if (user.status === 'SUSPENDED') {
      throw new HttpError(403, 'Hesabınız askıya alınmıştır. Destek için yöneticiyle iletişime geçin.', 'SUSPENDED');
    }
    if (user.status === 'CLOSED') throw new HttpError(403, 'Bu hesap kapatılmıştır.', 'CLOSED');
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await createSession(req, res, user.id);
    res.json({ user: serializeMe(user, user.settings) });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const tokenHash = currentTokenHash(req);
    if (tokenHash) await prisma.session.deleteMany({ where: { tokenHash } });
    clearSessionCookie(res);
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.user) return res.json({ user: null });
    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      update: {},
      create: { userId: req.user.id },
    });
    res.json({ user: serializeMe(req.user, settings) });
  }),
);

/** Şifremi unuttum: kullanıcı var olsun olmasın aynı yanıt döner (hesap varlığı ifşa edilmez). */
authRouter.post(
  '/forgot-password',
  resetLimiter,
  asyncHandler(async (req, res) => {
    const { email } = parseBody(forgotPasswordSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.status !== 'CLOSED' && user.status !== 'SUSPENDED') {
      const token = randomToken(32);
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
      });
      const link = `${config.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
      await sendMail(
        user.email,
        'RefStats — Parola sıfırlama',
        `Merhaba ${user.firstName},\n\nParolanızı sıfırlamak için aşağıdaki bağlantıyı 1 saat içinde kullanın:\n${link}\n\nBu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.`,
      );
    }
    res.json({ ok: true, message: 'Bu e-posta kayıtlıysa sıfırlama bağlantısı gönderildi.' });
  }),
);

authRouter.post(
  '/reset-password',
  resetLimiter,
  asyncHandler(async (req, res) => {
    const input = parseBody(resetPasswordSchema, req.body);
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(input.token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new HttpError(400, 'Bağlantı geçersiz veya süresi dolmuş. Lütfen yeni bir bağlantı isteyin.', 'INVALID_TOKEN');
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(input.password), passwordChangedAt: new Date() },
      }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Parola sıfırlanınca tüm açık oturumlar kapatılır.
      prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);
    await logActivity(record.userId, 'security.password_reset', 'Parola sıfırlandı');
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const input = parseBody(changePasswordSchema, req.body);
    const ok = await verifyPassword(input.currentPassword, req.user.passwordHash);
    if (!ok) throw new HttpError(400, 'Mevcut parola hatalı', 'VALIDATION', { currentPassword: 'Mevcut parola hatalı' });
    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { passwordHash: await hashPassword(input.newPassword), passwordChangedAt: new Date() },
      }),
      // Diğer cihazlardaki oturumlar kapatılır, mevcut oturum korunur.
      prisma.session.deleteMany({ where: { userId: req.user.id, NOT: { id: req.sessionId } } }),
    ]);
    await logActivity(req.user.id, 'security.password_changed', 'Parola değiştirildi');
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/sessions',
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const sessions = await prisma.session.findMany({
      where: { userId: req.user.id, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true },
    });
    res.json({ sessions: sessions.map((s) => ({ ...s, current: s.id === req.sessionId })) });
  }),
);

authRouter.delete(
  '/sessions/:id',
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { count } = await prisma.session.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    if (!count) throw new HttpError(404, 'Oturum bulunamadı', 'NOT_FOUND');
    if (req.params.id === req.sessionId) clearSessionCookie(res);
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/sessions/revoke-others',
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { count } = await prisma.session.deleteMany({
      where: { userId: req.user.id, NOT: { id: req.sessionId } },
    });
    await logActivity(req.user.id, 'security.sessions_revoked', `${count} oturum kapatıldı`);
    res.json({ ok: true, count });
  }),
);
