import { Router } from 'express';
import { prisma } from '../db';
import { asyncHandler, notFound } from '../lib/errors';
import { avatarUrl } from '../lib/serializers';
import { careerStats } from '../services/stats';

/**
 * Herkese açık profil. Yalnızca kullanıcının açıkça izin verdiği alanlar döner.
 * Sicil/lisans numarası, e-posta, maç notları ve maç ayrıntıları ASLA bu yanıtta yer almaz.
 */
export const publicRouter = Router();

publicRouter.get(
  '/profiles/:username',
  asyncHandler(async (req, res) => {
    const username = String(req.params.username).toLowerCase().slice(0, 30);
    const user = await prisma.user.findUnique({ where: { username }, include: { settings: true } });
    const s = user?.settings;
    // Gizli, askıdaki veya kapatılmış profiller için "bulunamadı" döner (varlığı ifşa edilmez).
    if (!user || !s || !s.profilePublic || user.status === 'SUSPENDED' || user.status === 'CLOSED') {
      throw notFound('Profil');
    }
    const career = s.showStats || s.showCategories || s.showSeasons || s.showBadges ? await careerStats(user.id) : null;
    res.json({
      profile: {
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: s.showPhoto ? avatarUrl(user.avatarFile) : null,
        bio: s.showBio ? user.bio : null,
        region: s.showRegion ? user.region : null,
        organization: s.showOrganization ? user.organization : null,
        classification: s.showOrganization ? user.classification : null,
        startYear: s.showStartYear ? user.startYear : null,
      },
      stats:
        career && s.showStats
          ? {
              total: career.summary.total,
              referee: career.summary.referee,
              assistant: career.summary.assistant,
              fourth: career.summary.fourth,
              other: career.summary.other,
              yellowCards: career.summary.yellowCards,
              redCards: career.summary.redCards,
              firstMatchDate: career.firstMatchDate,
              yearHistory: career.yearHistory.map(({ year, total, referee, assistant, fourth, other }) => ({
                year,
                total,
                referee,
                assistant,
                fourth,
                other,
              })),
            }
          : null,
      categories: career && s.showCategories ? career.categories : null,
      seasons: career && s.showSeasons ? career.seasons.map(({ name, total, referee, assistant, fourth }) => ({ name, total, referee, assistant, fourth })) : null,
      badges: career && s.showBadges ? career.badges.filter((b) => b.earned).map(({ id, title, description }) => ({ id, title, description })) : null,
    });
  }),
);
