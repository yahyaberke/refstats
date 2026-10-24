import { Router } from 'express';
import { matchSchema, OFFICIAL_ROLE_SHORT } from '@refstats/shared';
import { prisma } from '../db';
import { logActivity } from '../lib/activity';
import { asyncHandler, parseBody } from '../lib/errors';
import { isoDay } from '../lib/serializers';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { matchesToCsv } from '../services/csv';
import {
  buildWhere,
  createMatch,
  deleteMatch,
  getOwnedMatch,
  listMatches,
  matchInclude,
  parseListQuery,
  serializeMatch,
  updateMatch,
} from '../services/matches';

export const matchesRouter = Router();
matchesRouter.use(requireAuth);

const label = (m: { homeTeam: { name: string }; awayTeam: { name: string } }) => `${m.homeTeam.name} – ${m.awayTeam.name}`;

matchesRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await listMatches(req.user.id, parseListQuery(req.query as Record<string, unknown>)));
  }),
);

/** Filtrelenmiş maçları CSV olarak indirir (sayfalama uygulanmaz). */
matchesRouter.get(
  '/export.csv',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const f = parseListQuery(req.query as Record<string, unknown>);
    const items = await prisma.match.findMany({
      where: buildWhere(req.user.id, f),
      orderBy: [{ date: 'desc' }],
      include: matchInclude,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="refstats-maclar-${stamp}.csv"`);
    res.send(matchesToCsv(items.map(serializeMatch)));
  }),
);

/** Akıllı form için öneriler: takımlar, sahalar, organizasyonlar ve en sık kullanılan seçimler. */
matchesRouter.get(
  '/suggestions',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const userId = req.user.id;
    const [teams, venues, competitions, topCategories, topRoles, seasons] = await Promise.all([
      prisma.team.findMany({
        where: { userId },
        select: { id: true, name: true, isFavorite: true },
        orderBy: [{ isFavorite: 'desc' }, { name: 'asc' }],
      }),
      prisma.venue.findMany({
        where: { userId },
        select: { id: true, name: true, city: true, district: true, isFavorite: true },
        orderBy: [{ isFavorite: 'desc' }, { name: 'asc' }],
      }),
      prisma.match.groupBy({
        by: ['competition'],
        where: { userId, competition: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { competition: 'desc' } },
        take: 30,
      }),
      prisma.match.groupBy({
        by: ['categoryId'],
        where: { userId },
        _count: { _all: true },
        orderBy: { _count: { categoryId: 'desc' } },
        take: 4,
      }),
      prisma.match.groupBy({
        by: ['role'],
        where: { userId },
        _count: { _all: true },
        orderBy: { _count: { role: 'desc' } },
        take: 3,
      }),
      prisma.season.findMany({ where: { userId }, select: { name: true }, orderBy: { name: 'desc' } }),
    ]);
    res.json({
      teams,
      venues,
      competitions: competitions.map((c) => c.competition).filter(Boolean),
      topCategoryIds: topCategories.map((c) => c.categoryId),
      topRoles: topRoles.map((r) => r.role),
      seasons: seasons.map((s) => s.name),
    });
  }),
);

/** "Önceki maçtan kopyala" için son kaydedilen maç. */
matchesRouter.get(
  '/latest',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const match = await prisma.match.findFirst({
      where: { userId: req.user.id },
      orderBy: [{ createdAt: 'desc' }],
      include: matchInclude,
    });
    res.json({ match: match ? serializeMatch(match) : null });
  }),
);

/** Takvim için tarih aralığındaki maçlar (hafif veri). */
matchesRouter.get(
  '/calendar',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : '';
    const to = typeof req.query.to === 'string' ? req.query.to : '';
    const valid = /^\d{4}-\d{2}-\d{2}$/;
    if (!valid.test(from) || !valid.test(to)) return res.json({ items: [] });
    const items = await prisma.match.findMany({
      where: {
        userId: req.user.id,
        date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) },
      },
      orderBy: [{ date: 'asc' }, { kickoffTime: 'asc' }],
      select: {
        id: true,
        date: true,
        kickoffTime: true,
        status: true,
        role: true,
        homeScore: true,
        awayScore: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        category: { select: { name: true } },
        venue: { select: { name: true } },
      },
    });
    res.json({
      items: items.map((m) => ({
        id: m.id,
        date: isoDay(m.date),
        kickoffTime: m.kickoffTime,
        status: m.status,
        role: m.role,
        roleShort: OFFICIAL_ROLE_SHORT[m.role],
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        category: m.category.name,
        venue: m.venue?.name ?? null,
      })),
    });
  }),
);

matchesRouter.post(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const input = parseBody(matchSchema, req.body);
    const match = await createMatch(req.user.id, input);
    await logActivity(req.user.id, 'match.created', `Maç eklendi: ${label(match)}`, match.id);
    res.status(201).json({ match: serializeMatch(match) });
  }),
);

matchesRouter.get(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json({ match: serializeMatch(await getOwnedMatch(req.user.id, req.params.id)) });
  }),
);

matchesRouter.put(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const input = parseBody(matchSchema, req.body);
    const match = await updateMatch(req.user.id, req.params.id, input);
    await logActivity(req.user.id, 'match.updated', `Maç güncellendi: ${label(match)}`, match.id);
    res.json({ match: serializeMatch(match) });
  }),
);

matchesRouter.delete(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const match = await deleteMatch(req.user.id, req.params.id);
    await logActivity(req.user.id, 'match.deleted', `Maç silindi: ${label(match)}`);
    res.json({ ok: true });
  }),
);
