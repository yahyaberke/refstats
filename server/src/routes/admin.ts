import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { categoryAdminSchema, feedbackAdminSchema } from '@refstats/shared';
import { config } from '../config';
import { prisma } from '../db';
import { asyncHandler, HttpError, notFound, parseBody } from '../lib/errors';
import { requireAdmin, type AuthedRequest } from '../middleware/auth';

/**
 * Yönetici API'si. Tüm uç noktalar sunucu tarafında ADMIN rolü kontrolünden geçer.
 * Gizlilik gereği yöneticiler kullanıcıların maç içeriklerini ve özel notlarını görmez; yalnızca sayısal özetleri görür.
 */
export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const [users, byStatus, demoUsers, newUsers, matches, matches30, openFeedback, categories] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.user.count({ where: { isDemo: true } }),
      prisma.user.count({ where: { createdAt: { gte: since30 } } }),
      prisma.match.count(),
      prisma.match.count({ where: { createdAt: { gte: since30 } } }),
      prisma.feedback.count({ where: { status: 'OPEN' } }),
      prisma.category.count({ where: { ownerId: null } }),
    ]);
    const statusCount = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));
    res.json({
      users,
      activeUsers: statusCount.ACTIVE ?? 0,
      suspendedUsers: statusCount.SUSPENDED ?? 0,
      closureRequests: statusCount.CLOSURE_REQUESTED ?? 0,
      closedUsers: statusCount.CLOSED ?? 0,
      demoUsers,
      newUsers30: newUsers,
      matches,
      matches30,
      openFeedback,
      systemCategories: categories,
    });
  }),
);

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = 25;
    const where = {
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' as const } },
              { username: { contains: q, mode: 'insensitive' as const } },
              { firstName: { contains: q, mode: 'insensitive' as const } },
              { lastName: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(['ACTIVE', 'SUSPENDED', 'CLOSURE_REQUESTED', 'CLOSED'].includes(status) ? { status: status as never } : {}),
    };
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          isDemo: true,
          createdAt: true,
          lastLoginAt: true,
          closureRequestedAt: true,
          closureReason: true,
          _count: { select: { matches: true } },
        },
      }),
    ]);
    res.json({
      total,
      page,
      pageSize,
      items: users.map(({ _count, ...u }) => ({ ...u, matchCount: _count.matches })),
    });
  }),
);

const statusSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']) });

adminRouter.patch(
  '/users/:id/status',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { status } = parseBody(statusSchema, req.body);
    if (req.params.id === req.user.id) throw new HttpError(400, 'Kendi hesabınızın durumunu değiştiremezsiniz');
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw notFound('Kullanıcı');
    await prisma.$transaction([
      prisma.user.update({
        where: { id: target.id },
        data: {
          status,
          ...(status === 'ACTIVE' ? { closureRequestedAt: null, closureReason: null } : {}),
        },
      }),
      // Askıya alma / kapatma: tüm oturumlar anında sonlandırılır.
      ...(status !== 'ACTIVE' ? [prisma.session.deleteMany({ where: { userId: target.id } })] : []),
    ]);
    res.json({ ok: true });
  }),
);

/** Kalıcı silme yalnızca kapatma talebi olan veya kapatılmış hesaplarda yapılabilir. Geri alınamaz. */
adminRouter.delete(
  '/users/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    if (req.params.id === req.user.id) throw new HttpError(400, 'Kendi hesabınızı buradan silemezsiniz');
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw notFound('Kullanıcı');
    if (target.status !== 'CLOSURE_REQUESTED' && target.status !== 'CLOSED') {
      throw new HttpError(409, 'Yalnızca kapatma talebi bulunan veya kapatılmış hesaplar kalıcı olarak silinebilir');
    }
    await prisma.$transaction(async (tx) => {
      await tx.match.deleteMany({ where: { userId: target.id } });
      await tx.user.delete({ where: { id: target.id } });
    });
    if (target.avatarFile) {
      await fs.unlink(path.join(config.uploadDir, 'avatars', path.basename(target.avatarFile))).catch(() => undefined);
    }
    res.json({ ok: true });
  }),
);

adminRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      where: { ownerId: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { matches: true } } },
    });
    res.json({
      categories: categories.map(({ _count, ...c }) => ({ ...c, matchCount: _count.matches })),
    });
  }),
);

adminRouter.post(
  '/categories',
  asyncHandler(async (req, res) => {
    const input = parseBody(categoryAdminSchema, req.body);
    const clash = await prisma.category.findFirst({ where: { ownerId: null, name: { equals: input.name, mode: 'insensitive' } } });
    if (clash) throw new HttpError(409, 'Bu isimde bir sistem kategorisi var', 'CONFLICT', { name: 'Bu kategori zaten var' });
    const category = await prisma.category.create({ data: { ...input, isSystem: true } });
    res.status(201).json({ category });
  }),
);

adminRouter.put(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const input = parseBody(categoryAdminSchema, req.body);
    const existing = await prisma.category.findFirst({ where: { id: req.params.id, ownerId: null } });
    if (!existing) throw notFound('Kategori');
    const clash = await prisma.category.findFirst({
      where: { ownerId: null, name: { equals: input.name, mode: 'insensitive' }, NOT: { id: existing.id } },
    });
    if (clash) throw new HttpError(409, 'Bu isimde bir sistem kategorisi var', 'CONFLICT', { name: 'Bu kategori zaten var' });
    const category = await prisma.category.update({ where: { id: existing.id }, data: input });
    res.json({ category });
  }),
);

adminRouter.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.category.findFirst({
      where: { id: req.params.id, ownerId: null },
      include: { _count: { select: { matches: true } } },
    });
    if (!existing) throw notFound('Kategori');
    if (existing._count.matches > 0) {
      throw new HttpError(409, 'Kullanımda olan kategori silinemez; bunun yerine pasif hâle getirin.');
    }
    await prisma.category.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);

adminRouter.get(
  '/feedback',
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const items = await prisma.feedback.findMany({
      where: ['OPEN', 'REVIEWED', 'RESOLVED'].includes(status) ? { status: status as never } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { username: true, firstName: true, lastName: true } } },
    });
    res.json({ items });
  }),
);

adminRouter.patch(
  '/feedback/:id',
  asyncHandler(async (req, res) => {
    const input = parseBody(feedbackAdminSchema, req.body);
    const { count } = await prisma.feedback.updateMany({ where: { id: req.params.id }, data: input });
    if (!count) throw notFound('Geri bildirim');
    res.json({ ok: true });
  }),
);
