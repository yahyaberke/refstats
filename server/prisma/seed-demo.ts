/**
 * Demo hesabı ve örnek maç verileri oluşturur. Gerçek kullanıcı verisiyle karışmaması için
 * hesap isDemo=true olarak işaretlenir ve ayrı bir e-posta kullanır. Her çalıştırmada demo hesabı sıfırlanır.
 *
 *   npm run db:demo
 *   Giriş: demo@refstats.local / Demo12345
 */
import { PrismaClient } from '@prisma/client';
import { matchSchema, seasonForDate, todayIso, type CardIncidentInput, type MatchInput } from '@refstats/shared';
import bcrypt from 'bcryptjs';
import { createMatch } from '../src/services/matches';

const prisma = new PrismaClient();
const DEMO_EMAIL = 'demo@refstats.local';
const DEMO_PASSWORD = 'Demo12345';

// Tekrarlanabilir sonuçlar için basit tohumlu rastgele sayı üreteci.
let seed = 20240901;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

const TEAMS = [
  'Bahçeşehir Gençlik SK',
  'Yeşilvadi FK',
  'Kuzeyspor',
  'Ataşehir Yıldızları',
  'Çınaraltı SK',
  'Liman Gücü FK',
  'Kartaltepe Spor',
  'Mavişehir SK',
  'Doğankent Belediyespor',
  'Sahilyolu FK',
  'Gölbaşı Gençlerbirliği',
  'Kayalar SK',
];
const VENUES = [
  { name: 'Yeşilvadi Sentetik Sahası', city: 'İstanbul', district: 'Ataşehir' },
  { name: 'Kuzey Spor Kompleksi', city: 'İstanbul', district: 'Sarıyer' },
  { name: 'Liman Stadı', city: 'İstanbul', district: 'Kartal' },
  { name: 'Çınaraltı Çim Saha', city: 'İstanbul', district: 'Ümraniye' },
];
const PEOPLE = ['A. Yılmaz', 'M. Kaya', 'E. Demir', 'B. Şahin', 'C. Öztürk', 'K. Aydın', 'S. Arslan', 'T. Çelik'];

function dateDaysAgo(days: number) {
  const d = new Date(`${todayIso()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function makeCards(role: string): CardIncidentInput[] {
  const cards: CardIncidentInput[] = [];
  const yellowCount = role === 'REFEREE' ? int(1, 7) : int(0, 5);
  for (let i = 0; i < yellowCount; i++) {
    cards.push({
      type: 'YELLOW',
      personType: rand() < 0.88 ? 'PLAYER' : pick(['HEAD_COACH', 'COACH', 'SUBSTITUTE', 'TEAM_OFFICIAL'] as const),
      personName: rand() < 0.5 ? pick(PEOPLE) : null,
      shirtNumber: int(2, 30),
      team: rand() < 0.5 ? 'HOME' : 'AWAY',
      minute: int(5, 90),
      addedMinute: null,
      description: null,
    });
  }
  if (rand() < 0.18 && cards.length > 0) {
    const first = cards[0];
    cards.push({ ...first, type: 'SECOND_YELLOW', minute: Math.min(90, (first.minute ?? 45) + int(5, 30)), description: 'İkinci ihtar' });
  }
  if (rand() < 0.12) {
    cards.push({
      type: 'DIRECT_RED',
      personType: 'PLAYER',
      personName: pick(PEOPLE),
      shirtNumber: int(2, 30),
      team: rand() < 0.5 ? 'HOME' : 'AWAY',
      minute: int(10, 90),
      addedMinute: rand() < 0.2 ? int(1, 4) : null,
      description: 'Ciddi faul oyunu',
    });
  }
  return cards.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
}

async function main() {
  const categories = await prisma.category.findMany({ where: { ownerId: null } });
  if (!categories.length) throw new Error('Önce kategorileri oluşturun: npm run db:seed');
  const cat = (name: string) => categories.find((c) => c.name === name)!.id;
  const categoryPool = [
    cat('U14'), cat('U15'), cat('U16'), cat('U17'), cat('U19'), cat('PAF'),
    cat('2. Amatör Lig'), cat('1. Amatör Lig'), cat('1. Amatör Lig'), cat('Süper Amatör Lig (SAL)'),
  ];

  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    await prisma.match.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      username: 'demo.hakem',
      firstName: 'Deniz',
      lastName: 'Örnek',
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      isDemo: true,
      region: 'İstanbul',
      organization: 'İstanbul Amatör Futbol (örnek)',
      classification: 'İl Hakemi',
      startYear: 2019,
      bio: 'Bu bir demo hesabıdır. Tüm maçlar ve isimler örnek amaçlı üretilmiştir.',
      settings: { create: { profilePublic: true } },
    },
  });

  let count = 0;
  // Son ~26 ayda tamamlanmış maçlar
  for (let daysAgo = 780; daysAgo >= 2; daysAgo -= int(5, 14)) {
    const date = dateDaysAgo(daysAgo);
    const month = Number(date.slice(5, 7));
    if (month === 7) continue; // Yaz arası
    const role = pick(['REFEREE', 'REFEREE', 'REFEREE', 'AR1', 'AR2', 'AR1', 'FOURTH', 'REFEREE'] as const);
    const [home, away] = (() => {
      const h = pick(TEAMS);
      let a = pick(TEAMS);
      while (a === h) a = pick(TEAMS);
      return [h, a];
    })();
    const homeScore = int(0, 4);
    const awayScore = int(0, 3);
    const venue = pick(VENUES);
    const detailed = rand() < 0.75;
    const cards = makeCards(role);
    const yellows = cards.filter((c) => c.type !== 'DIRECT_RED').length;
    const input: MatchInput = {
      date,
      kickoffTime: pick(['11:00', '13:00', '14:30', '16:00', '18:00']),
      homeTeam: home,
      awayTeam: away,
      homeScore,
      awayScore,
      halfTimeHome: Math.min(homeScore, int(0, 2)),
      halfTimeAway: Math.min(awayScore, int(0, 1)),
      competition: 'İstanbul Amatör Ligleri (örnek)',
      categoryId: pick(categoryPool),
      season: seasonForDate(date),
      round: `${int(1, 26)}. Hafta`,
      venue: venue.name,
      city: venue.city,
      district: venue.district,
      matchType: rand() < 0.85 ? 'LEAGUE' : pick(['CUP', 'FRIENDLY', 'TOURNAMENT'] as const),
      status: rand() < 0.05 ? 'POSTPONED' : 'COMPLETED',
      role,
      firstHalfAdded: int(0, 3),
      secondHalfAdded: int(1, 6),
      reportStatus: daysAgo > 10 ? 'DONE' : pick(['NOT_STARTED', 'IN_PROGRESS'] as const),
      cardEntryMode: detailed ? 'DETAILED' : 'SUMMARY',
      cards: detailed ? cards : [],
      summaryCards: detailed
        ? null
        : {
            yellowCards: yellows,
            secondYellowReds: cards.filter((c) => c.type === 'SECOND_YELLOW').length,
            directReds: cards.filter((c) => c.type === 'DIRECT_RED').length,
          },
      notes:
        rand() < 0.4
          ? {
              selfAssessment: 'Pozisyon alma iyiydi, ikinci yarıda tempo düştü.',
              improvementAreas: rand() < 0.5 ? 'Duran top organizasyonlarında konumlanma' : 'Avantaj kuralını daha cesur uygulamak',
              observerScore: rand() < 0.6 ? Math.round((7.6 + rand() * 1.6) * 10) / 10 : null,
            }
          : null,
      allowDuplicate: true,
    };
    await createMatch(user.id, matchSchema.parse(input));
    count++;
  }
  // Gelecek (planlanmış) maçlar
  for (const [i, days] of [3, 9, 16].entries()) {
    const d = new Date(`${todayIso()}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    const date = d.toISOString().slice(0, 10);
    await createMatch(
      user.id,
      matchSchema.parse({
        date,
        kickoffTime: '14:00',
        homeTeam: TEAMS[i],
        awayTeam: TEAMS[i + 5],
        categoryId: categoryPool[i + 4],
        competition: 'İstanbul Amatör Ligleri (örnek)',
        status: 'SCHEDULED',
        role: i === 1 ? 'AR1' : 'REFEREE',
        venue: VENUES[i].name,
        city: VENUES[i].city,
        district: VENUES[i].district,
        cardEntryMode: 'DETAILED',
        cards: [],
      } satisfies MatchInput),
    );
    count++;
  }
  const season = seasonForDate(todayIso());
  const seasonRow = await prisma.season.findUnique({ where: { userId_name: { userId: user.id, name: season } } });
  await prisma.personalGoal.createMany({
    data: [
      { userId: user.id, title: `${season} sezonu 40 maç`, metric: 'TOTAL_MATCHES', target: 40, seasonId: seasonRow?.id },
      { userId: user.id, title: '25 orta hakemlik', metric: 'REFEREE_MATCHES', target: 25, seasonId: seasonRow?.id },
      { userId: user.id, title: 'Kondisyon testini geçmek', metric: 'CUSTOM', target: 1, manualProgress: 0, note: 'Mekik koşusu çalışması' },
    ],
  });
  await prisma.activityLog.create({ data: { userId: user.id, action: 'account.created', summary: 'Demo hesabı oluşturuldu' } });
  console.info(`Demo hesabı hazır: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (${count} maç)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
