import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { feedbackSchema } from '@refstats/shared';
import { config } from '../config';
import { prisma } from '../db';
import { asyncHandler, parseBody } from '../lib/errors';
import { requireAuth, type AuthedRequest } from '../middleware/auth';

export const feedbackRouter = Router();
feedbackRouter.use(requireAuth);

const limiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, skip: () => config.isTest, standardHeaders: 'draft-7', legacyHeaders: false });

feedbackRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const items = await prisma.feedback.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, type: true, message: true, status: true, adminNote: true, createdAt: true },
    });
    res.json({ items });
  }),
);

feedbackRouter.post(
  '/',
  limiter,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const input = parseBody(feedbackSchema, req.body);
    const item = await prisma.feedback.create({ data: { ...input, userId: req.user.id } });
    res.status(201).json({ item: { id: item.id } });
  }),
);
