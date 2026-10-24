import { Router } from 'express';
import { prisma } from '../db';
import { asyncHandler } from '../lib/errors';
import { requireAuth, type AuthedRequest } from '../middleware/auth';

export const activityRouter = Router();
activityRouter.use(requireAuth);

activityRouter.get(
  '/',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const items = await prisma.activityLog.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, action: true, summary: true, entityId: true, createdAt: true },
    });
    res.json({ items });
  }),
);
