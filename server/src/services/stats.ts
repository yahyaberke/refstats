import type { OfficialRole, PersonalGoal, Prisma, Season } from '@prisma/client';
import {
  ASSISTANT_ROLES,
  GOAL_METRIC_LABELS,
  OFFICIAL_ROLE_LABELS,
  OFFICIAL_ROLES,
  seasonRange,
} from '@refstats/shared';
import { prisma } from '../db';
import { isoDay } from '../lib/serializers';

/**
 * İstatistik kuralları:
 *  - Yalnızca durumu "Tamamlandı" (COMPLETED) olan maçlar istatistiklere dahil edilir.
 *  - Planlanan (gelecek), ertelenen ve iptal edilen maçlar ayrıca sayılır ama toplamları etkilemez.
 *  - Sarı kart toplamı ikinci sarıları içerir; kırmızı toplamı = ikinci sarıdan + doğrudan kırmızı.
 *  - Veri yoksa sıfır döner; tahmini/hayali değer üretilmez.
 */

const statSelect = {
  id: true,
  date: true,
  status: true,
  role: true,
  competition: true,
  homeScore: true,
  awayScore: true,
  yellowCards: true,
  redCards: true,
  secondYellowReds: true,
  directReds: true,
  reportStatus: true,
  cardEntryMode: true,
  createdAt: true,
  category: { select: { id: true, name: true, sortOrder: true } },
  season: { select: { name: true } },
  homeTeam: { select: { name: true } },
  awayTeam: { select: { name: true } },
  notes: { select: { observerScore: true } },
} satisfies Prisma.MatchSelect;

type StatMatch = Prisma.MatchGetPayload<{ select: typeof statSelect }>;

export interface StatFilters {
  role?: string;
  categoryId?: string;
  season?: string;
  from?: string;
  to?: string;
}

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const WEEKDAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const round2 = (n: number) => Math.round(n * 100) / 100;
const avg = (sum: number, count: number) => (count ? round2(sum / count) : 0);
const isAssistant = (r: OfficialRole) => ASSISTANT_ROLES.includes(r);
const monthKey = (d: Date) => isoDay(d).slice(0, 7);
const monthLabel = (key: string) => `${MONTHS_TR[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`;

function lastMonthKeys(n: number, now = new Date()): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(isoDay(d).slice(0, 7));
  }
  return keys;
}

async function loadMatches(userId: string, f: StatFilters = {}) {
  const where: Prisma.MatchWhereInput = { userId };
  if (f.role === 'ASSISTANT') where.role = { in: ASSISTANT_ROLES };
  else if (f.role && (OFFICIAL_ROLES as readonly string[]).includes(f.role)) where.role = f.role as OfficialRole;
  if (f.categoryId) where.categoryId = f.categoryId;
  if (f.season) where.season = { name: f.season };
  if (f.from || f.to) {
    where.date = {
      ...(f.from ? { gte: new Date(`${f.from}T00:00:00Z`) } : {}),
      ...(f.to ? { lte: new Date(`${f.to}T00:00:00Z`) } : {}),
    };
  }
  return prisma.match.findMany({ where, select: statSelect, orderBy: { date: 'asc' } });
}

function countBy<T>(items: T[], key: (t: T) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    if (k) map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function roleBreakdown(matches: StatMatch[]) {
  return OFFICIAL_ROLES.map((role) => ({
    role,
    label: OFFICIAL_ROLE_LABELS[role],
    count: matches.filter((m) => m.role === role).length,
  }));
}

function summarize(played: StatMatch[]) {
  const yellow = played.reduce((s, m) => s + m.yellowCards, 0);
  const red = played.reduce((s, m) => s + m.redCards, 0);
  return {
    total: played.length,
    referee: played.filter((m) => m.role === 'REFEREE').length,
    assistant: played.filter((m) => isAssistant(m.role)).length,
    fourth: played.filter((m) => m.role === 'FOURTH').length,
    other: played.filter((m) => m.role === 'OTHER').length,
    yellowCards: yellow,
    redCards: red,
    secondYellowReds: played.reduce((s, m) => s + m.secondYellowReds, 0),
    directReds: played.reduce((s, m) => s + m.directReds, 0),
    avgCardsPerMatch: avg(yellow + red, played.length),
    avgYellowPerMatch: avg(yellow, played.length),
    avgRedPerMatch: avg(red, played.length),
    distinctCategories: new Set(played.map((m) => m.category.id)).size,
  };
}

function monthlySeries(played: StatMatch[], keys: string[]) {
  return keys.map((key) => {
    const ms = played.filter((m) => monthKey(m.date) === key);
    return {
      key,
      label: monthLabel(key),
      count: ms.length,
      referee: ms.filter((m) => m.role === 'REFEREE').length,
      assistant: ms.filter((m) => isAssistant(m.role)).length,
      fourth: ms.filter((m) => m.role === 'FOURTH').length,
      other: ms.filter((m) => m.role === 'OTHER').length,
      yellowCards: ms.reduce((s, m) => s + m.yellowCards, 0),
      redCards: ms.reduce((s, m) => s + m.redCards, 0),
    };
  });
}

// ---------------------------------------------------------------- Hedefler

type GoalWithSeason = PersonalGoal & { season: Season | null };

function goalPeriod(g: GoalWithSeason): { start: string; end: string; label: string } | null {
  if (g.season) {
    const r = seasonRange(g.season.name);
    if (r) return { ...r, label: `${g.season.name} sezonu` };
  }
  if (g.year) return { start: `${g.year}-01-01`, end: `${g.year}-12-31`, label: `${g.year} yılı` };
  return null;
}

function goalMatches(g: GoalWithSeason, played: StatMatch[]) {
  const period = goalPeriod(g);
  if (!period) return [];
  return played.filter((m) => {
    const d = isoDay(m.date);
    if (d < period.start || d > period.end) return false;
    if (g.metric === 'REFEREE_MATCHES') return m.role === 'REFEREE';
    if (g.metric === 'ASSISTANT_MATCHES') return isAssistant(m.role);
    if (g.metric === 'FOURTH_MATCHES') return m.role === 'FOURTH';
    return true;
  });
}

export function computeGoals(goals: GoalWithSeason[], played: StatMatch[]) {
  return goals.map((g) => {
    const period = goalPeriod(g);
    const ms = g.metric === 'CUSTOM' ? [] : goalMatches(g, played);
    const current = g.metric === 'CUSTOM' ? g.manualProgress : ms.length;
    // Dönem içindeki aylık kümülatif ilerleme (grafik için).
    let timeline: { key: string; label: string; cumulative: number; target: number }[] = [];
    if (period && g.metric !== 'CUSTOM') {
      const keys: string[] = [];
      const start = new Date(`${period.start}T00:00:00Z`);
      const end = new Date(`${period.end}T00:00:00Z`);
      for (let d = new Date(start); d <= end; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
        keys.push(isoDay(d).slice(0, 7));
      }
      let cum = 0;
      const nowKey = isoDay(new Date()).slice(0, 7);
      timeline = keys
        .filter((k) => k <= nowKey)
        .map((key, i, arr) => {
          cum += ms.filter((m) => monthKey(m.date) === key).length;
          return { key, label: monthLabel(key), cumulative: cum, target: Math.round((g.target * (i + 1)) / keys.length) };
        });
    }
    return {
      id: g.id,
      title: g.title,
      metric: g.metric,
      metricLabel: GOAL_METRIC_LABELS[g.metric],
      target: g.target,
      season: g.season?.name ?? null,
      year: g.year,
      periodLabel: period?.label ?? null,
      manualProgress: g.manualProgress,
      note: g.note,
      current,
      percent: Math.min(100, Math.round((current / g.target) * 100)),
      achieved: current >= g.target,
      timeline,
    };
  });
}

// ---------------------------------------------------------------- Rozetler

export function computeBadges(played: StatMatch[], goalsAchieved: number) {
  const byDate = [...played].sort((a, b) => a.date.getTime() - b.date.getTime());
  const nth = (list: StatMatch[], n: number) => (list.length >= n ? isoDay(list[n - 1].date) : null);
  const referee = byDate.filter((m) => m.role === 'REFEREE');
  const monthCounts = countBy(played, (m) => monthKey(m.date));
  const bestMonth = monthCounts[0]?.count ?? 0;
  const categories = new Set(played.map((m) => m.category.id)).size;
  const reports = played.filter((m) => m.reportStatus === 'DONE').length;
  const detailed = played.filter((m) => m.cardEntryMode === 'DETAILED').length;
  const sal = byDate.filter((m) => /SAL|Süper Amatör/i.test(m.category.name));

  const countBadge = (id: string, title: string, description: string, list: StatMatch[], target: number) => ({
    id,
    title,
    description,
    target,
    progress: Math.min(list.length, target),
    earned: list.length >= target,
    earnedAt: nth(list, target),
  });
  return [
    countBadge('first-whistle', 'İlk Düdük', 'İlk maçını kaydet', byDate, 1),
    countBadge('matches-10', '10 Maç', '10 tamamlanmış görev', byDate, 10),
    countBadge('matches-50', '50 Maç', '50 tamamlanmış görev', byDate, 50),
    countBadge('matches-100', 'Yüzlük Kulüp', '100 tamamlanmış görev', byDate, 100),
    countBadge('referee-10', 'Sahanın Ortası', '10 maçta orta hakemlik', referee, 10),
    countBadge('referee-50', 'Tecrübeli Orta Hakem', '50 maçta orta hakemlik', referee, 50),
    countBadge('sal-debut', 'SAL Sahnesi', 'Süper Amatör Lig\'de ilk görev', sal, 1),
    {
      id: 'categories-5',
      title: 'Çok Yönlü',
      description: '5 farklı kategoride görev al',
      target: 5,
      progress: Math.min(categories, 5),
      earned: categories >= 5,
      earnedAt: null,
    },
    {
      id: 'busy-month',
      title: 'Yoğun Ay',
      description: 'Bir ayda 8 maç',
      target: 8,
      progress: Math.min(bestMonth, 8),
      earned: bestMonth >= 8,
      earnedAt: null,
    },
    {
      id: 'reporter',
      title: 'Titiz Raporcu',
      description: '10 maçın raporunu tamamla',
      target: 10,
      progress: Math.min(reports, 10),
      earned: reports >= 10,
      earnedAt: null,
    },
    {
      id: 'detail-keeper',
      title: 'Detaycı',
      description: '20 maçta kartları olay bazlı kaydet',
      target: 20,
      progress: Math.min(detailed, 20),
      earned: detailed >= 20,
      earnedAt: null,
    },
    {
      id: 'goal-getter',
      title: 'Hedef Odaklı',
      description: 'Bir kişisel hedefe ulaş',
      target: 1,
      progress: Math.min(goalsAchieved, 1),
      earned: goalsAchieved >= 1,
      earnedAt: null,
    },
  ];
}

async function loadGoals(userId: string) {
  return prisma.personalGoal.findMany({
    where: { userId },
    include: { season: true },
    orderBy: { createdAt: 'desc' },
  });
}

// ---------------------------------------------------------------- Dashboard

export async function dashboardStats(userId: string) {
  const [all, goals, activity, recent] = await Promise.all([
    loadMatches(userId),
    loadGoals(userId),
    prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, action: true, summary: true, entityId: true, createdAt: true },
    }),
    prisma.match.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        date: true,
        status: true,
        role: true,
        homeScore: true,
        awayScore: true,
        yellowCards: true,
        redCards: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
  ]);
  const played = all.filter((m) => m.status === 'COMPLETED');
  const today = isoDay(new Date());
  const year = today.slice(0, 4);
  const upcoming = all.filter((m) => m.status === 'SCHEDULED' && isoDay(m.date) >= today);
  const lastPlayed = played.length ? played[played.length - 1] : null;

  const last30: { date: string; label: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    const key = isoDay(d);
    last30.push({
      date: key,
      label: `${d.getUTCDate()} ${MONTHS_TR[d.getUTCMonth()]}`,
      count: played.filter((m) => isoDay(m.date) === key).length,
    });
  }
  const computedGoals = computeGoals(goals, played);

  return {
    hasMatches: all.length > 0,
    summary: {
      ...summarize(played),
      thisYear: played.filter((m) => isoDay(m.date).startsWith(year)).length,
      lastMatchDate: lastPlayed ? isoDay(lastPlayed.date) : null,
      upcoming: upcoming.length,
      postponed: all.filter((m) => m.status === 'POSTPONED').length,
      cancelled: all.filter((m) => m.status === 'CANCELLED').length,
      pendingReports: played.filter((m) => m.reportStatus !== 'DONE').length,
    },
    nextMatch: upcoming[0]
      ? {
          id: upcoming[0].id,
          date: isoDay(upcoming[0].date),
          homeTeam: upcoming[0].homeTeam.name,
          awayTeam: upcoming[0].awayTeam.name,
          role: upcoming[0].role,
          category: upcoming[0].category.name,
        }
      : null,
    recentMatches: recent.map((m) => ({
      id: m.id,
      date: isoDay(m.date),
      status: m.status,
      role: m.role,
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      yellowCards: m.yellowCards,
      redCards: m.redCards,
      category: m.category.name,
    })),
    last30,
    monthly: monthlySeries(played, lastMonthKeys(12)),
    categories: countBy(played, (m) => m.category.name),
    roles: roleBreakdown(played),
    goals: computedGoals,
    activity,
  };
}

// ---------------------------------------------------------------- Analiz merkezi

export async function analyticsStats(userId: string, f: StatFilters) {
  const [all, goals] = await Promise.all([loadMatches(userId, f), loadGoals(userId)]);
  const played = all.filter((m) => m.status === 'COMPLETED');
  const summary = summarize(played);

  const byCategory = new Map<string, { name: string; sortOrder: number; count: number; yellow: number; red: number }>();
  for (const m of played) {
    const c = byCategory.get(m.category.id) ?? { name: m.category.name, sortOrder: m.category.sortOrder, count: 0, yellow: 0, red: 0 };
    c.count++;
    c.yellow += m.yellowCards;
    c.red += m.redCards;
    byCategory.set(m.category.id, c);
  }
  const categoryStats = [...byCategory.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({
      name: c.name,
      count: c.count,
      yellowCards: c.yellow,
      redCards: c.red,
      avgYellow: avg(c.yellow, c.count),
      avgRed: avg(c.red, c.count),
      avgCards: avg(c.yellow + c.red, c.count),
    }));

  const roleGroups = [
    { key: 'REFEREE', label: 'Orta hakem', match: (r: OfficialRole) => r === 'REFEREE' },
    { key: 'ASSISTANT', label: 'Yardımcı hakem', match: isAssistant },
    { key: 'FOURTH', label: 'Dördüncü hakem', match: (r: OfficialRole) => r === 'FOURTH' },
    { key: 'OTHER', label: 'Diğer', match: (r: OfficialRole) => r === 'OTHER' },
  ];
  const roleComparison = roleGroups.map((g) => {
    const ms = played.filter((m) => g.match(m.role));
    const y = ms.reduce((s, m) => s + m.yellowCards, 0);
    const r = ms.reduce((s, m) => s + m.redCards, 0);
    const goalsScored = ms.filter((m) => m.homeScore !== null).reduce((s, m) => s + (m.homeScore ?? 0) + (m.awayScore ?? 0), 0);
    const withScore = ms.filter((m) => m.homeScore !== null).length;
    return {
      key: g.key,
      label: g.label,
      count: ms.length,
      yellowCards: y,
      redCards: r,
      avgYellow: avg(y, ms.length),
      avgRed: avg(r, ms.length),
      avgGoals: avg(goalsScored, withScore),
    };
  });

  const seasons = new Map<string, StatMatch[]>();
  for (const m of played) {
    const k = m.season?.name ?? 'Sezonsuz';
    seasons.set(k, [...(seasons.get(k) ?? []), m]);
  }
  const seasonStats = [...seasons.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, ms]) => ({ name, ...summarize(ms) }));

  const years = new Map<string, StatMatch[]>();
  for (const m of played) {
    const y = isoDay(m.date).slice(0, 4);
    years.set(y, [...(years.get(y) ?? []), m]);
  }
  const yearStats = [...years.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([year, ms]) => ({ year, ...summarize(ms) }));

  // Aylık seri: filtrelenen aralığa göre; aralık yoksa ilk maçtan bugüne (en fazla 36 ay), veri yoksa son 12 ay.
  let monthKeys = lastMonthKeys(12);
  if (played.length) {
    const first = monthKey(played[0].date);
    const last = monthKey(played[played.length - 1].date);
    const keys: string[] = [];
    for (let d = new Date(`${first}-01T00:00:00Z`); monthKey(d) <= last; d.setUTCMonth(d.getUTCMonth() + 1)) keys.push(monthKey(d));
    monthKeys = keys.slice(-36);
  }
  const monthly = monthlySeries(played, monthKeys).map((m) => ({
    ...m,
    avgCards: avg(m.yellowCards + m.redCards, m.count),
  }));

  const weekday = WEEKDAYS_TR.map((label, i) => ({
    label,
    count: played.filter((m) => (m.date.getUTCDay() + 6) % 7 === i).length,
  }));

  const withScore = played.filter((m) => m.homeScore !== null && m.awayScore !== null);
  const results = {
    withScore: withScore.length,
    homeWins: withScore.filter((m) => m.homeScore! > m.awayScore!).length,
    draws: withScore.filter((m) => m.homeScore === m.awayScore).length,
    awayWins: withScore.filter((m) => m.homeScore! < m.awayScore!).length,
    avgGoals: avg(
      withScore.reduce((s, m) => s + m.homeScore! + m.awayScore!, 0),
      withScore.length,
    ),
  };

  const teamCounts = new Map<string, { name: string; count: number; home: number; away: number }>();
  for (const m of played) {
    for (const [name, side] of [
      [m.homeTeam.name, 'home'],
      [m.awayTeam.name, 'away'],
    ] as const) {
      const t = teamCounts.get(name) ?? { name, count: 0, home: 0, away: 0 };
      t.count++;
      t[side]++;
      teamCounts.set(name, t);
    }
  }
  const topTeams = [...teamCounts.values()].sort((a, b) => b.count - a.count).slice(0, 10);

  const observerTrend = played
    .filter((m) => m.notes?.observerScore !== null && m.notes?.observerScore !== undefined)
    .map((m) => ({
      date: isoDay(m.date),
      label: `${isoDay(m.date).slice(8, 10)}.${isoDay(m.date).slice(5, 7)}.${isoDay(m.date).slice(2, 4)}`,
      score: Number(m.notes!.observerScore),
      match: `${m.homeTeam.name} – ${m.awayTeam.name}`,
    }));

  const allPlayed = f.role || f.categoryId || f.season || f.from || f.to
    ? (await loadMatches(userId)).filter((m) => m.status === 'COMPLETED')
    : played;

  return {
    summary,
    statusCounts: {
      completed: played.length,
      scheduled: all.filter((m) => m.status === 'SCHEDULED').length,
      postponed: all.filter((m) => m.status === 'POSTPONED').length,
      cancelled: all.filter((m) => m.status === 'CANCELLED').length,
    },
    roles: roleBreakdown(played),
    roleComparison,
    categories: categoryStats,
    topCategories: countBy(played, (m) => m.category.name).slice(0, 5),
    topCompetitions: countBy(played, (m) => m.competition).slice(0, 8),
    seasons: seasonStats,
    years: yearStats,
    monthly,
    weekday,
    results,
    topTeams,
    observerTrend,
    // Hedefler filtreden bağımsız olarak tüm tamamlanmış maçlarla hesaplanır.
    goals: computeGoals(goals, allPlayed),
  };
}

// ---------------------------------------------------------------- Kariyer

export async function careerStats(userId: string) {
  const [all, goals] = await Promise.all([loadMatches(userId), loadGoals(userId)]);
  const played = all.filter((m) => m.status === 'COMPLETED');
  const years = new Map<string, StatMatch[]>();
  for (const m of played) {
    const y = isoDay(m.date).slice(0, 4);
    years.set(y, [...(years.get(y) ?? []), m]);
  }
  const yearHistory = [...years.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, ms]) => ({
      year,
      total: ms.length,
      referee: ms.filter((m) => m.role === 'REFEREE').length,
      assistant: ms.filter((m) => isAssistant(m.role)).length,
      fourth: ms.filter((m) => m.role === 'FOURTH').length,
      other: ms.filter((m) => m.role === 'OTHER').length,
      categories: [...new Set(ms.map((m) => m.category.name))],
    }));
  const seasons = new Map<string, StatMatch[]>();
  for (const m of played) {
    const k = m.season?.name ?? 'Sezonsuz';
    seasons.set(k, [...(seasons.get(k) ?? []), m]);
  }
  const computedGoals = computeGoals(goals, played);
  return {
    summary: summarize(played),
    firstMatchDate: played[0] ? isoDay(played[0].date) : null,
    lastMatchDate: played.length ? isoDay(played[played.length - 1].date) : null,
    yearHistory,
    roles: roleBreakdown(played),
    categories: countBy(played, (m) => m.category.name),
    seasons: [...seasons.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([name, ms]) => ({ name, ...summarize(ms) })),
    goals: computedGoals,
    badges: computeBadges(played, computedGoals.filter((g) => g.achieved).length),
  };
}
