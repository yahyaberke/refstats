import { afterAll, describe, expect, it } from 'vitest';
import { computeCardTotals } from '@refstats/shared';
import { prisma } from '../src/db';
import { baseMatch, categoryId, registerUser } from './helpers';

afterAll(() => prisma.$disconnect());

const yellow = (team = 'HOME', minute = 20) => ({ type: 'YELLOW', personType: 'PLAYER', team, minute });

describe('kart toplamları', () => {
  it('ikinci sarı hem sarı hem kırmızı toplamına bir kez girer', () => {
    const t = computeCardTotals([{ type: 'YELLOW' }, { type: 'SECOND_YELLOW' }, { type: 'DIRECT_RED' }, { type: 'YELLOW' }]);
    expect(t).toEqual({ yellowCards: 3, secondYellowReds: 1, directReds: 1, redCards: 2 });
  });
  it('boş listede sıfır döner', () => {
    expect(computeCardTotals([])).toEqual({ yellowCards: 0, secondYellowReds: 0, directReds: 0, redCards: 0 });
  });
});

describe('maç CRUD', () => {
  it('ayrıntılı kartlarla maç ekler; toplamları sunucu hesaplar', async () => {
    const { c } = await registerUser();
    const res = await c.post(
      '/api/matches',
      await baseMatch({
        // İstemcinin gönderdiği toplamlar yok sayılır.
        yellowCards: 99,
        cards: [
          yellow('HOME', 10),
          yellow('AWAY', 30),
          { type: 'SECOND_YELLOW', personType: 'PLAYER', team: 'HOME', minute: 70 },
          { type: 'DIRECT_RED', personType: 'HEAD_COACH', team: 'AWAY', minute: 80, addedMinute: null },
        ],
        notes: { selfAssessment: 'İyi maç', observerScore: 8.4 },
      }),
    );
    expect(res.status).toBe(201);
    const m = res.body.match;
    expect(m.yellowCards).toBe(3);
    expect(m.secondYellowReds).toBe(1);
    expect(m.directReds).toBe(1);
    expect(m.redCards).toBe(2);
    expect(m.cards).toHaveLength(4);
    expect(m.season).toBe('2025-2026');
    expect(m.notes.observerScore).toBe(8.4);
  });

  it('ikinci sarı için ilk sarı yoksa reddeder', async () => {
    const { c } = await registerUser();
    const res = await c.post(
      '/api/matches',
      await baseMatch({ cards: [{ type: 'SECOND_YELLOW', personType: 'PLAYER', team: 'HOME', minute: 70 }] }),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.details.cards).toBeDefined();
  });

  it('özet modunda manuel sayıları kaydeder ve tutarsızlığı reddeder', async () => {
    const { c } = await registerUser();
    const bad = await c.post(
      '/api/matches',
      await baseMatch({ cardEntryMode: 'SUMMARY', summaryCards: { yellowCards: 1, secondYellowReds: 1, directReds: 0 } }),
    );
    expect(bad.status).toBe(400);
    const ok = await c.post(
      '/api/matches',
      await baseMatch({ cardEntryMode: 'SUMMARY', summaryCards: { yellowCards: 5, secondYellowReds: 1, directReds: 1 } }),
    );
    expect(ok.status).toBe(201);
    expect(ok.body.match.redCards).toBe(2);
    expect(ok.body.match.cards).toHaveLength(0);
  });

  it('gelecek tarihli maçı "tamamlandı" olarak kabul etmez', async () => {
    const { c } = await registerUser();
    const res = await c.post('/api/matches', await baseMatch({ date: '2099-01-01' }));
    expect(res.status).toBe(400);
    const scheduled = await c.post('/api/matches', await baseMatch({ date: '2099-01-01', status: 'SCHEDULED', homeScore: null, awayScore: null }));
    expect(scheduled.status).toBe(201);
  });

  it('yinelenen kaydı uyarır, onayla kaydeder', async () => {
    const { c } = await registerUser();
    expect((await c.post('/api/matches', await baseMatch())).status).toBe(201);
    const dup = await c.post('/api/matches', await baseMatch({ homeTeam: 'yeşilvadi fk' }));
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DUPLICATE');
    expect((await c.post('/api/matches', await baseMatch({ allowDuplicate: true }))).status).toBe(201);
  });

  it('günceller, kartları yeniden hesaplar ve siler', async () => {
    const { c } = await registerUser();
    const created = await c.post('/api/matches', await baseMatch({ cards: [yellow(), yellow('AWAY')] }));
    const id = created.body.match.id;
    const updated = await c.put(`/api/matches/${id}`, await baseMatch({ cards: [yellow()], role: 'AR1' }));
    expect(updated.status).toBe(200);
    expect(updated.body.match.yellowCards).toBe(1);
    expect(updated.body.match.role).toBe('AR1');
    expect(await prisma.cardIncident.count({ where: { matchId: id } })).toBe(1);

    expect((await c.del(`/api/matches/${id}`)).status).toBe(200);
    expect((await c.get(`/api/matches/${id}`)).status).toBe(404);
    expect(await prisma.cardIncident.count({ where: { matchId: id } })).toBe(0);
  });

  it('filtreler, arama ve CSV dışa aktarma çalışır', async () => {
    const { c } = await registerUser();
    await c.post('/api/matches', await baseMatch({ homeTeam: 'Alfa SK', awayTeam: 'Beta FK', role: 'REFEREE', cards: [yellow()] }));
    await c.post(
      '/api/matches',
      await baseMatch({ date: '2025-11-02', homeTeam: 'Gama SK', awayTeam: 'Delta FK', role: 'AR2', categoryId: await categoryId('PAF') }),
    );
    const all = await c.get('/api/matches');
    expect(all.body.total).toBe(2);
    expect((await c.get('/api/matches?role=ASSISTANT')).body.total).toBe(1);
    expect((await c.get('/api/matches?q=gama')).body.items[0].homeTeam).toBe('Gama SK');
    expect((await c.get('/api/matches?minCards=1')).body.total).toBe(1);
    expect((await c.get('/api/matches?from=2025-11-01')).body.total).toBe(1);
    const csv = await c.get('/api/matches/export.csv');
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('Alfa SK');
    expect(csv.text.split('\r\n').filter(Boolean)).toHaveLength(3);
  });
});

describe('kullanıcılar arası veri izolasyonu', () => {
  it('başka kullanıcının maçını okuyamaz, değiştiremez, silemez', async () => {
    const a = await registerUser();
    const b = await registerUser();
    const created = await a.c.post('/api/matches', await baseMatch());
    const id = created.body.match.id;

    expect((await b.c.get(`/api/matches/${id}`)).status).toBe(404);
    expect((await b.c.put(`/api/matches/${id}`, await baseMatch({ homeTeam: 'Hack FK' }))).status).toBe(404);
    expect((await b.c.del(`/api/matches/${id}`)).status).toBe(404);
    expect((await b.c.get('/api/matches')).body.total).toBe(0);
    expect((await b.c.get('/api/stats/dashboard')).body.summary.total).toBe(0);
    expect((await b.c.get('/api/matches/export.csv')).text).not.toContain('Yeşilvadi');

    const still = await a.c.get(`/api/matches/${id}`);
    expect(still.status).toBe(200);
    expect(still.body.match.homeTeam).toBe('Yeşilvadi FK');
  });

  it('başka kullanıcının özel kategorisini kullanamaz', async () => {
    const a = await registerUser();
    const b = await registerUser();
    const cat = await a.c.post('/api/categories', { name: 'Okul Ligi' });
    expect(cat.status).toBe(201);
    const res = await b.c.post('/api/matches', await baseMatch({ categoryId: cat.body.category.id }));
    expect(res.status).toBe(400);
  });

  it('herkese açık profil sicil numarası ve e-posta içermez; gizli profil 404 döner', async () => {
    const a = await registerUser();
    await a.c.patch('/api/profile', {
      firstName: 'Ali',
      lastName: 'Veli',
      username: a.user.username,
      licenseNumber: 'SICIL-12345',
      bio: 'Merhaba',
    });
    expect((await a.c.get(`/api/public/profiles/${a.user.username}`)).status).toBe(404);
    const settings = (await a.c.get('/api/profile/settings')).body.settings;
    await a.c.put('/api/profile/settings', { ...settings, profilePublic: true });
    const pub = await a.c.get(`/api/public/profiles/${a.user.username}`);
    expect(pub.status).toBe(200);
    expect(JSON.stringify(pub.body)).not.toContain('SICIL-12345');
    expect(JSON.stringify(pub.body)).not.toContain('@test.local');
  });
});
