import { Router } from 'express';
import { asyncHandler } from '../lib/errors';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { analyticsStats, careerStats, dashboardStats, type StatFilters } from '../services/stats';

export const statsRouter = Router();
statsRouter.use(requireAuth);

const pick = (v: unknown, re?: RegExp) =>
  typeof v === 'string' && v.trim() && (!re || re.test(v)) ? v.trim().slice(0, 60) : undefined;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

statsRouter.get(
  '/dashboard',
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await dashboardStats(req.user.id));
  }),
);

statsRouter.get(
  '/analytics',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const f: StatFilters = {
      role: pick(req.query.role),
      categoryId: pick(req.query.categoryId),
      season: pick(req.query.season, /^\d{4}-\d{4}$/),
      from: pick(req.query.from, DATE),
      to: pick(req.query.to, DATE),
    };
    res.json(await analyticsStats(req.user.id, f));
  }),
);

statsRouter.get(
  '/career',
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await careerStats(req.user.id));
  }),
);
