import { Router } from 'express';
import { categoryCreateSchema } from '@refstats/shared';
import { prisma } from '../db';
import { asyncHandler, HttpError, notFound, parseBody } from '../lib/errors';
import { requireAuth, type AuthedRequest } from '../middleware/auth';

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

/** Sistem kategorileri (aktif olanlar) + kullanıcının kendi özel kategorileri. */
categoriesRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const categories = await prisma.category.findMany({
      where: { OR: [{ ownerId: null, isActive: true }, { ownerId: req.user.id }] },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, ownerId: true, sortOrder: true },
    });
    res.json({
      categories: categories.map((c) => ({ id: c.id, name: c.name, custom: c.ownerId !== null })),
    });
  }),
);

categoriesRouter.post(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { name } = parseBody(categoryCreateSchema, req.body);
    const clash = await prisma.category.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        OR: [{ ownerId: null }, { ownerId: req.user.id }],
      },
    });
    if (clash) throw new HttpError(409, 'Bu isimde bir kategori zaten var', 'CONFLICT', { name: 'Bu kategori zaten var' });
    const count = await prisma.category.count({ where: { ownerId: req.user.id } });
    if (count >= 30) throw new HttpError(400, 'En fazla 30 özel kategori oluşturabilirsiniz');
    const category = await prisma.category.create({ data: { name, ownerId: req.user.id, sortOrder: 900 } });
    res.status(201).json({ category: { id: category.id, name: category.name, custom: true } });
  }),
);

categoriesRouter.delete(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const category = await prisma.category.findFirst({ where: { id: req.params.id, ownerId: req.user.id } });
    if (!category) throw notFound('Kategori');
    const used = await prisma.match.count({ where: { categoryId: category.id } });
    if (used) throw new HttpError(409, `Bu kategori ${used} maçta kullanılıyor; önce o maçların kategorisini değiştirin.`);
    await prisma.category.delete({ where: { id: category.id } });
    res.json({ ok: true });
  }),
);
