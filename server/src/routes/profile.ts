import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { closureRequestSchema, profileSchema, settingsSchema } from '@refstats/shared';
import { config } from '../config';
import { prisma } from '../db';
import { logActivity } from '../lib/activity';
import { randomToken, verifyPassword } from '../lib/crypto';
import { asyncHandler, HttpError, parseBody } from '../lib/errors';
import { serializeMe, serializeSettings } from '../lib/serializers';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { buildBackup } from '../services/backup';

export const profileRouter = Router();
profileRouter.use(requireAuth);

const avatarDir = path.join(config.uploadDir, 'avatars');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

/** Dosya uzantısına/MIME'a güvenmek yerine içerik imzasını (magic bytes) kontrol eder. */
function detectImage(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

async function removeAvatarFile(file: string | null) {
  if (!file) return;
  await fs.unlink(path.join(avatarDir, path.basename(file))).catch(() => undefined);
}

profileRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const settings = await prisma.userSettings.findUnique({ where: { userId: req.user.id } });
    res.json({ user: serializeMe(req.user, settings) });
  }),
);

profileRouter.patch(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const input = parseBody(profileSchema, req.body);
    if (input.username !== req.user.username) {
      const taken = await prisma.user.findUnique({ where: { username: input.username }, select: { id: true } });
      if (taken) throw new HttpError(409, 'Kayıt edilemedi', 'CONFLICT', { username: 'Bu kullanıcı adı kullanılıyor' });
    }
    const user = await prisma.user.update({ where: { id: req.user.id }, data: input, include: { settings: true } });
    await logActivity(user.id, 'profile.updated', 'Profil bilgileri güncellendi');
    res.json({ user: serializeMe(user, user.settings) });
  }),
);

profileRouter.post(
  '/avatar',
  upload.single('avatar'),
  asyncHandler<AuthedRequest>(async (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(400, 'Bir görsel dosyası seçin', 'VALIDATION');
    const ext = detectImage(file.buffer);
    if (!ext) throw new HttpError(400, 'Yalnızca JPG, PNG veya WEBP görseller yüklenebilir', 'VALIDATION');
    await fs.mkdir(avatarDir, { recursive: true });
    const name = `${randomToken(18)}.${ext}`;
    await fs.writeFile(path.join(avatarDir, name), file.buffer);
    const previous = req.user.avatarFile;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarFile: name },
      include: { settings: true },
    });
    await removeAvatarFile(previous);
    res.json({ user: serializeMe(user, user.settings) });
  }),
);

profileRouter.delete(
  '/avatar',
  asyncHandler<AuthedRequest>(async (req, res) => {
    await removeAvatarFile(req.user.avatarFile);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarFile: null },
      include: { settings: true },
    });
    res.json({ user: serializeMe(user, user.settings) });
  }),
);

profileRouter.get(
  '/settings',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      update: {},
      create: { userId: req.user.id },
    });
    res.json({ settings: serializeSettings(settings) });
  }),
);

profileRouter.put(
  '/settings',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const input = parseBody(settingsSchema, req.body);
    if (input.defaultCategoryId) {
      const cat = await prisma.category.findFirst({
        where: { id: input.defaultCategoryId, OR: [{ ownerId: null }, { ownerId: req.user.id }] },
        select: { id: true },
      });
      if (!cat) throw new HttpError(400, 'Geçersiz kategori', 'VALIDATION', { defaultCategoryId: 'Geçersiz kategori' });
    }
    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      update: input,
      create: { ...input, userId: req.user.id },
    });
    res.json({ settings: serializeSettings(settings) });
  }),
);

/** Hesap kapatma TALEBİ: veriler hemen silinmez, yönetici onayıyla kapatılır. Kullanıcı talebi geri çekebilir. */
profileRouter.post(
  '/closure-request',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const input = parseBody(closureRequestSchema, req.body);
    if (!(await verifyPassword(input.password, req.user.passwordHash))) {
      throw new HttpError(400, 'Parola hatalı', 'VALIDATION', { password: 'Parola hatalı' });
    }
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { status: 'CLOSURE_REQUESTED', closureRequestedAt: new Date(), closureReason: input.reason },
      include: { settings: true },
    });
    await logActivity(user.id, 'account.closure_requested', 'Hesap kapatma talebi oluşturuldu');
    res.json({ user: serializeMe(user, user.settings) });
  }),
);

profileRouter.delete(
  '/closure-request',
  asyncHandler<AuthedRequest>(async (req, res) => {
    if (req.user.status !== 'CLOSURE_REQUESTED') throw new HttpError(400, 'Aktif bir kapatma talebi yok');
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { status: 'ACTIVE', closureRequestedAt: null, closureReason: null },
      include: { settings: true },
    });
    await logActivity(user.id, 'account.closure_cancelled', 'Hesap kapatma talebi geri çekildi');
    res.json({ user: serializeMe(user, user.settings) });
  }),
);

/** Kullanıcının tüm verilerini JSON olarak indirir (yedekleme / veri taşınabilirliği). */
profileRouter.get(
  '/export',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const backup = await buildBackup(req.user.id);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="refstats-yedek-${stamp}.json"`);
    res.json(backup);
  }),
);
