import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler, HttpError, notFound, parseBody } from '../lib/errors';
import { requireAuth, type AuthedRequest } from '../middleware/auth';

/** Kullanıcının takım ve saha kütüphanesi (favoriler, yeniden adlandırma). */
export const libraryRouter = Router();
libraryRouter.use(requireAuth);

const teamSchema = z.object({ name: z.string().trim().min(1, 'Takım adı zorunludur').max(80), isFavorite: z.boolean().default(true) });
const venueSchema = z.object({
  name: z.string().trim().min(1, 'Saha adı zorunludur').max(120),
  city: z.string().trim().max(60).nullable().optional(),
  district: z.string().trim().max(60).nullable().optional(),
  isFavorite: z.boolean().default(true),
});
const favSchema = z.object({ isFavorite: z.boolean() });

libraryRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const [teams, venues] = await Promise.all([
      prisma.team.findMany({
        where: { userId: req.user.id },
        orderBy: [{ isFavorite: 'desc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          isFavorite: true,
          _count: { select: { homeMatches: true, awayMatches: true } },
        },
      }),
      prisma.venue.findMany({
        where: { userId: req.user.id },
        orderBy: [{ isFavorite: 'desc' }, { name: 'asc' }],
        select: { id: true, name: true, city: true, district: true, isFavorite: true, _count: { select: { matches: true } } },
      }),
    ]);
    res.json({
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        isFavorite: t.isFavorite,
        matches: t._count.homeMatches + t._count.awayMatches,
      })),
      venues: venues.map((v) => ({ ...v, matches: v._count.matches, _count: undefined })),
    });
  }),
);

libraryRouter.post(
  '/teams',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const input = parseBody(teamSchema, req.body);
    const team = await prisma.team.upsert({
      where: { userId_name: { userId: req.user.id, name: input.name } },
      update: { isFavorite: input.isFavorite },
      create: { ...input, userId: req.user.id },
    });
    res.status(201).json({ team });
  }),
);

libraryRouter.patch(
  '/teams/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { isFavorite } = parseBody(favSchema, req.body);
    const { count } = await prisma.team.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { isFavorite } });
    if (!count) throw notFound('Takım');
    res.json({ ok: true });
  }),
);

libraryRouter.delete(
  '/teams/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const team = await prisma.team.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { _count: { select: { homeMatches: true, awayMatches: true } } },
    });
    if (!team) throw notFound('Takım');
    if (team._count.homeMatches + team._count.awayMatches > 0) {
      throw new HttpError(409, 'Bu takım maç kayıtlarında kullanılıyor; yalnızca favorilerden çıkarılabilir.');
    }
    await prisma.team.delete({ where: { id: team.id } });
    res.json({ ok: true });
  }),
);

libraryRouter.post(
  '/venues',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const input = parseBody(venueSchema, req.body);
    const venue = await prisma.venue.upsert({
      where: { userId_name: { userId: req.user.id, name: input.name } },
      update: { isFavorite: input.isFavorite, city: input.city ?? undefined, district: input.district ?? undefined },
      create: { ...input, city: input.city ?? null, district: input.district ?? null, userId: req.user.id },
    });
    res.status(201).json({ venue });
  }),
);

libraryRouter.patch(
  '/venues/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { isFavorite } = parseBody(favSchema, req.body);
    const { count } = await prisma.venue.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { isFavorite } });
    if (!count) throw notFound('Saha');
    res.json({ ok: true });
  }),
);

libraryRouter.delete(
  '/venues/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    // Saha silinirse maçlardaki saha bağlantısı boşaltılır (onDelete: SetNull); maçlar etkilenmez.
    const { count } = await prisma.venue.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    if (!count) throw notFound('Saha');
    res.json({ ok: true });
  }),
);
