import { Router } from 'express';
import { goalSchema, type GoalInput } from '@refstats/shared';
import { z } from 'zod';
import { prisma } from '../db';
import { logActivity } from '../lib/activity';
import { asyncHandler, notFound, parseBody } from '../lib/errors';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { findOrCreateSeason } from '../services/matches';

export const goalsRouter = Router();
goalsRouter.use(requireAuth);

type ParsedGoal = z.output<typeof goalSchema>;

async function goalData(userId: string, input: ParsedGoal) {
  const seasonId = input.season
    ? await prisma.$transaction((tx) => findOrCreateSeason(tx, userId, input.season!))
    : null;
  return {
    title: input.title,
    metric: input.metric,
    target: input.target,
    seasonId,
    year: input.season ? null : input.year,
    manualProgress: input.manualProgress,
    note: input.note,
  };
}

goalsRouter.post(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const input = parseBody(goalSchema, req.body as GoalInput);
    const goal = await prisma.personalGoal.create({ data: { ...(await goalData(req.user.id, input)), userId: req.user.id } });
    await logActivity(req.user.id, 'goal.created', `Hedef eklendi: ${goal.title}`, goal.id);
    res.status(201).json({ goal });
  }),
);

goalsRouter.put(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const input = parseBody(goalSchema, req.body);
    const owned = await prisma.personalGoal.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!owned) throw notFound('Hedef');
    const goal = await prisma.personalGoal.update({ where: { id: owned.id }, data: await goalData(req.user.id, input) });
    res.json({ goal });
  }),
);

goalsRouter.delete(
  '/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { count } = await prisma.personalGoal.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    if (!count) throw notFound('Hedef');
    res.json({ ok: true });
  }),
);
