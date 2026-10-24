import { Prisma } from '@prisma/client';
import {
  ASSISTANT_ROLES,
  computeCardTotals,
  OFFICIAL_ROLES,
  MATCH_STATUSES,
  REPORT_STATUSES,
  seasonForDate,
  seasonRange,
  summaryCardTotals,
  type MatchParsed,
} from '@refstats/shared';
import { prisma } from '../db';
import { HttpError, notFound } from '../lib/errors';
import { isoDay } from '../lib/serializers';

type Tx = Prisma.TransactionClient;

export const matchInclude = {
  homeTeam: { select: { id: true, name: true } },
  awayTeam: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  season: { select: { id: true, name: true } },
  venue: { select: { id: true, name: true } },
  cards: { orderBy: [{ sortIndex: 'asc' as const }] },
  notes: true,
} satisfies Prisma.MatchInclude;

export type MatchWithRelations = Prisma.MatchGetPayload<{ include: typeof matchInclude }>;

export function serializeMatch(m: MatchWithRelations) {
  return {
    id: m.id,
    date: isoDay(m.date),
    kickoffTime: m.kickoffTime,
    homeTeam: m.homeTeam.name,
    awayTeam: m.awayTeam.name,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    halfTimeHome: m.halfTimeHome,
    halfTimeAway: m.halfTimeAway,
    competition: m.competition,
    category: m.category,
    season: m.season?.name ?? null,
    round: m.round,
    venue: m.venue?.name ?? null,
    city: m.city,
    district: m.district,
    matchType: m.matchType,
    status: m.status,
    role: m.role,
    additionalDuties: m.additionalDuties,
    firstHalfAdded: m.firstHalfAdded,
    secondHalfAdded: m.secondHalfAdded,
    wentToExtraTime: m.wentToExtraTime,
    penaltiesHome: m.penaltiesHome,
    penaltiesAway: m.penaltiesAway,
    reportStatus: m.reportStatus,
    cardEntryMode: m.cardEntryMode,
    yellowCards: m.yellowCards,
    secondYellowReds: m.secondYellowReds,
    directReds: m.directReds,
    redCards: m.redCards,
    cards: m.cards.map((c) => ({
      id: c.id,
      type: c.type,
      personType: c.personType,
      personName: c.personName,
      shirtNumber: c.shirtNumber,
      team: c.team,
      minute: c.minute,
      addedMinute: c.addedMinute,
      description: c.description,
    })),
    notes: m.notes
      ? {
          generalAssessment: m.notes.generalAssessment,
          selfAssessment: m.notes.selfAssessment,
          difficultSituations: m.notes.difficultSituations,
          improvementAreas: m.notes.improvementAreas,
          observerEvaluation: m.notes.observerEvaluation,
          observerScore: m.notes.observerScore === null ? null : Number(m.notes.observerScore),
          reportNotes: m.notes.reportNotes,
          substitutionNotes: m.notes.substitutionNotes,
          injuryNotes: m.notes.injuryNotes,
          disciplineNotes: m.notes.disciplineNotes,
        }
      : null,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

const dateOnly = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

async function findOrCreateTeam(tx: Tx, userId: string, name: string) {
  const existing = await tx.team.findFirst({
    where: { userId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) return existing.id;
  return (await tx.team.create({ data: { userId, name }, select: { id: true } })).id;
}

async function findOrCreateVenue(tx: Tx, userId: string, name: string, city: string | null, district: string | null) {
  const existing = await tx.venue.findFirst({
    where: { userId, name: { equals: name, mode: 'insensitive' } },
  });
  if (existing) {
    // Sahanın il/ilçe bilgisi eksikse son girilenle tamamlanır.
    if ((!existing.city && city) || (!existing.district && district)) {
      await tx.venue.update({
        where: { id: existing.id },
        data: { city: existing.city ?? city, district: existing.district ?? district },
      });
    }
    return existing.id;
  }
  return (await tx.venue.create({ data: { userId, name, city, district }, select: { id: true } })).id;
}

export async function findOrCreateSeason(tx: Tx, userId: string, name: string) {
  const range = seasonRange(name);
  if (!range) throw new HttpError(400, 'Geçersiz sezon', 'VALIDATION', { season: 'Sezon 2025-2026 biçiminde olmalı' });
  const season = await tx.season.upsert({
    where: { userId_name: { userId, name } },
    update: {},
    create: { userId, name, startDate: dateOnly(range.start), endDate: dateOnly(range.end) },
    select: { id: true },
  });
  return season.id;
}

async function assertCategory(tx: Tx, userId: string, categoryId: string) {
  const cat = await tx.category.findFirst({
    where: { id: categoryId, OR: [{ ownerId: null }, { ownerId: userId }] },
    select: { id: true },
  });
  if (!cat) throw new HttpError(400, 'Geçersiz kategori', 'VALIDATION', { categoryId: 'Geçersiz kategori' });
}

/** Form verisini veritabanı alanlarına dönüştürür; kart toplamlarını SUNUCU hesaplar. */
async function buildMatchData(tx: Tx, userId: string, input: MatchParsed) {
  await assertCategory(tx, userId, input.categoryId);
  const homeTeamId = await findOrCreateTeam(tx, userId, input.homeTeam);
  const awayTeamId = await findOrCreateTeam(tx, userId, input.awayTeam);
  const venueId = input.venue ? await findOrCreateVenue(tx, userId, input.venue, input.city, input.district) : null;
  const seasonId = await findOrCreateSeason(tx, userId, input.season ?? seasonForDate(input.date));
  const totals =
    input.cardEntryMode === 'SUMMARY' && input.summaryCards
      ? summaryCardTotals(input.summaryCards)
      : computeCardTotals(input.cards);

  const data = {
    date: dateOnly(input.date),
    kickoffTime: input.kickoffTime,
    homeTeamId,
    awayTeamId,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    halfTimeHome: input.halfTimeHome,
    halfTimeAway: input.halfTimeAway,
    competition: input.competition,
    categoryId: input.categoryId,
    seasonId,
    round: input.round,
    venueId,
    city: input.city,
    district: input.district,
    matchType: input.matchType,
    status: input.status,
    role: input.role,
    additionalDuties: input.additionalDuties,
    firstHalfAdded: input.firstHalfAdded,
    secondHalfAdded: input.secondHalfAdded,
    wentToExtraTime: input.wentToExtraTime,
    penaltiesHome: input.penaltiesHome,
    penaltiesAway: input.penaltiesAway,
    reportStatus: input.reportStatus,
    cardEntryMode: input.cardEntryMode,
    ...totals,
  };
  const cards = input.cardEntryMode === 'DETAILED' ? input.cards : [];
  return { data, cards, homeTeamId, awayTeamId };
}

function notesData(notes: MatchParsed['notes']) {
  if (!notes) return null;
  const hasContent = Object.values(notes).some((v) => v !== null && v !== undefined && v !== '');
  return hasContent ? notes : null;
}

async function findDuplicates(tx: Tx, userId: string, date: string, homeTeamId: string, awayTeamId: string, excludeId?: string) {
  return tx.match.findMany({
    where: {
      userId,
      date: dateOnly(date),
      homeTeamId,
      awayTeamId,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
}

export async function createMatch(userId: string, input: MatchParsed) {
  return prisma.$transaction(async (tx) => {
    const { data, cards, homeTeamId, awayTeamId } = await buildMatchData(tx, userId, input);
    if (!input.allowDuplicate) {
      const dupes = await findDuplicates(tx, userId, input.date, homeTeamId, awayTeamId);
      if (dupes.length) {
        throw new HttpError(409, 'Aynı tarihte aynı takımlarla kayıtlı bir maçınız zaten var.', 'DUPLICATE', {
          matchIds: dupes.map((d) => d.id),
        });
      }
    }
    const notes = notesData(input.notes);
    const match = await tx.match.create({
      data: {
        ...data,
        userId,
        cards: { create: cards.map((c, i) => ({ ...c, sortIndex: i })) },
        ...(notes ? { notes: { create: notes } } : {}),
      },
      include: matchInclude,
    });
    return match;
  });
}

export async function getOwnedMatch(userId: string, id: string) {
  // userId filtresi sayesinde başka kullanıcının maç ID'si tahmin edilse bile kayıt bulunamaz (404).
  const match = await prisma.match.findFirst({ where: { id, userId }, include: matchInclude });
  if (!match) throw notFound('Maç');
  return match;
}

export async function updateMatch(userId: string, id: string, input: MatchParsed) {
  return prisma.$transaction(async (tx) => {
    const owned = await tx.match.findFirst({ where: { id, userId }, select: { id: true } });
    if (!owned) throw notFound('Maç');
    const { data, cards, homeTeamId, awayTeamId } = await buildMatchData(tx, userId, input);
    if (!input.allowDuplicate) {
      const dupes = await findDuplicates(tx, userId, input.date, homeTeamId, awayTeamId, id);
      if (dupes.length) {
        throw new HttpError(409, 'Aynı tarihte aynı takımlarla kayıtlı başka bir maçınız var.', 'DUPLICATE', {
          matchIds: dupes.map((d) => d.id),
        });
      }
    }
    // Kart olayları tek işlemde yenilenir; toplamlar aynı işlemde yeniden hesaplanmıştır (tutarlılık).
    await tx.cardIncident.deleteMany({ where: { matchId: id } });
    const notes = notesData(input.notes);
    if (notes) {
      await tx.matchNote.upsert({ where: { matchId: id }, update: notes, create: { ...notes, matchId: id } });
    } else {
      await tx.matchNote.deleteMany({ where: { matchId: id } });
    }
    const match = await tx.match.update({
      where: { id },
      data: { ...data, cards: { create: cards.map((c, i) => ({ ...c, sortIndex: i })) } },
      include: matchInclude,
    });
    await cleanupOrphans(tx, userId);
    return match;
  });
}

export async function deleteMatch(userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findFirst({
      where: { id, userId },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!match) throw notFound('Maç');
    await tx.match.delete({ where: { id } });
    await cleanupOrphans(tx, userId);
    return match;
  });
}

/** Hiçbir maçta kullanılmayan ve favori olmayan takımları temizler. */
async function cleanupOrphans(tx: Tx, userId: string) {
  await tx.team.deleteMany({
    where: { userId, isFavorite: false, homeMatches: { none: {} }, awayMatches: { none: {} } },
  });
}

export interface MatchListQuery {
  page: number;
  pageSize: number;
  q?: string;
  from?: string;
  to?: string;
  season?: string;
  categoryId?: string;
  role?: string;
  competition?: string;
  team?: string;
  city?: string;
  status?: string;
  reportStatus?: string;
  minCards?: number;
  maxCards?: number;
  sort: 'date' | 'createdAt' | 'cards' | 'category';
  dir: 'asc' | 'desc';
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 100) : undefined);
const num = (v: unknown) => {
  const n = typeof v === 'string' ? Number.parseInt(v, 10) : Number.NaN;
  return Number.isFinite(n) ? n : undefined;
};
const dateStr = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export function parseListQuery(q: Record<string, unknown>): MatchListQuery {
  const sort = ['date', 'createdAt', 'cards', 'category'].includes(String(q.sort)) ? (q.sort as MatchListQuery['sort']) : 'date';
  return {
    page: Math.max(1, num(q.page) ?? 1),
    pageSize: Math.min(100, Math.max(5, num(q.pageSize) ?? 20)),
    q: str(q.q),
    from: dateStr(q.from),
    to: dateStr(q.to),
    season: str(q.season),
    categoryId: str(q.categoryId),
    role: str(q.role),
    competition: str(q.competition),
    team: str(q.team),
    city: str(q.city),
    status: str(q.status),
    reportStatus: str(q.reportStatus),
    minCards: num(q.minCards),
    maxCards: num(q.maxCards),
    sort,
    dir: q.dir === 'asc' ? 'asc' : 'desc',
  };
}

export function buildWhere(userId: string, f: Partial<MatchListQuery>): Prisma.MatchWhereInput {
  const and: Prisma.MatchWhereInput[] = [{ userId }];
  const ci = (value: string) => ({ contains: value, mode: 'insensitive' as const });
  if (f.from || f.to) {
    and.push({ date: { ...(f.from ? { gte: dateOnly(f.from) } : {}), ...(f.to ? { lte: dateOnly(f.to) } : {}) } });
  }
  if (f.season) and.push({ season: { name: f.season } });
  if (f.categoryId) and.push({ categoryId: f.categoryId });
  if (f.role === 'ASSISTANT') and.push({ role: { in: ASSISTANT_ROLES } });
  else if (f.role && (OFFICIAL_ROLES as readonly string[]).includes(f.role)) and.push({ role: f.role as never });
  if (f.status && (MATCH_STATUSES as readonly string[]).includes(f.status)) and.push({ status: f.status as never });
  if (f.reportStatus && (REPORT_STATUSES as readonly string[]).includes(f.reportStatus)) {
    and.push({ reportStatus: f.reportStatus as never });
  }
  if (f.competition) and.push({ competition: ci(f.competition) });
  if (f.city) and.push({ OR: [{ city: ci(f.city) }, { district: ci(f.city) }] });
  if (f.team) and.push({ OR: [{ homeTeam: { name: ci(f.team) } }, { awayTeam: { name: ci(f.team) } }] });
  if (f.q) {
    and.push({
      OR: [
        { homeTeam: { name: ci(f.q) } },
        { awayTeam: { name: ci(f.q) } },
        { competition: ci(f.q) },
        { venue: { name: ci(f.q) } },
        { city: ci(f.q) },
        { round: ci(f.q) },
        { category: { name: ci(f.q) } },
      ],
    });
  }
  return { AND: and };
}

/** Toplam kart (sarı + kırmızı) filtresi: kolonlar arası toplam Prisma'da doğrudan filtrelenemediği için ID listesine indirgenir. */
async function cardFilterIds(userId: string, min?: number, max?: number): Promise<string[] | null> {
  if (min === undefined && max === undefined) return null;
  const rows = await prisma.match.findMany({ where: { userId }, select: { id: true, yellowCards: true, redCards: true } });
  return rows
    .filter((r) => {
      const total = r.yellowCards + r.redCards;
      return (min === undefined || total >= min) && (max === undefined || total <= max);
    })
    .map((r) => r.id);
}

export async function listMatches(userId: string, f: MatchListQuery) {
  const where = buildWhere(userId, f);
  const ids = await cardFilterIds(userId, f.minCards, f.maxCards);
  if (ids) (where.AND as Prisma.MatchWhereInput[]).push({ id: { in: ids } });
  const orderBy: Prisma.MatchOrderByWithRelationInput[] =
    f.sort === 'createdAt'
      ? [{ createdAt: f.dir }]
      : f.sort === 'cards'
        ? [{ yellowCards: f.dir }, { redCards: f.dir }, { date: 'desc' }]
        : f.sort === 'category'
          ? [{ category: { sortOrder: f.dir } }, { date: 'desc' }]
          : [{ date: f.dir }, { kickoffTime: f.dir }, { createdAt: f.dir }];
  const [total, items] = await Promise.all([
    prisma.match.count({ where }),
    prisma.match.findMany({
      where,
      orderBy,
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      include: matchInclude,
    }),
  ]);
  return { total, page: f.page, pageSize: f.pageSize, items: items.map(serializeMatch) };
}
