import { prisma } from '../db';
import { serializeMe } from '../lib/serializers';
import { matchInclude, serializeMatch } from './matches';

/** Kullanıcının kendi verilerinin tam dökümü (yalnızca kendi hesabı için). */
export async function buildBackup(userId: string) {
  const [user, matches, goals, teams, venues, categories] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { settings: true } }),
    prisma.match.findMany({ where: { userId }, include: matchInclude, orderBy: { date: 'asc' } }),
    prisma.personalGoal.findMany({ where: { userId }, include: { season: { select: { name: true } } } }),
    prisma.team.findMany({ where: { userId }, select: { name: true, isFavorite: true } }),
    prisma.venue.findMany({ where: { userId }, select: { name: true, city: true, district: true, isFavorite: true } }),
    prisma.category.findMany({ where: { ownerId: userId }, select: { name: true } }),
  ]);
  return {
    format: 'refstats-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: serializeMe(user, user.settings),
    customCategories: categories,
    teams,
    venues,
    goals: goals.map((g) => ({
      title: g.title,
      metric: g.metric,
      target: g.target,
      season: g.season?.name ?? null,
      year: g.year,
      manualProgress: g.manualProgress,
      note: g.note,
    })),
    matches: matches.map(serializeMatch),
  };
}
