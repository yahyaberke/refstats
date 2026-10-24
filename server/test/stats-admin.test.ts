import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { baseMatch, categoryId, registerUser } from './helpers';

afterAll(() => prisma.$disconnect());

describe('istatistikler', () => {
  it('boş hesapta sıfır değerler döner (hayali veri yok)', async () => {
    const { c } = await registerUser();
    const res = await c.get('/api/stats/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.hasMatches).toBe(false);
    expect(res.body.summary.total).toBe(0);
    expect(res.body.summary.avgCardsPerMatch).toBe(0);
    expect(res.body.last30).toHaveLength(30);
    expect(res.body.last30.every((d: { count: number }) => d.count === 0)).toBe(true);
  });

  it('dashboard ve analiz gerçek kayıtlardan hesaplanır; planlanan maçlar sayılmaz', async () => {
    const { c } = await registerUser();
    const y = { type: 'YELLOW', personType: 'PLAYER', team: 'HOME', minute: 10 };
    await c.post('/api/matches', await baseMatch({ role: 'REFEREE', cards: [y, y, { type: 'DIRECT_RED', personType: 'PLAYER' }] }));
    await c.post('/api/matches', await baseMatch({ date: '2025-10-19', role: 'AR1', categoryId: await categoryId('PAF'), cards: [y] }));
    await c.post('/api/matches', await baseMatch({ date: '2025-10-26', role: 'FOURTH', cardEntryMode: 'SUMMARY', summaryCards: { yellowCards: 2, secondYellowReds: 0, directReds: 0 } }));
    await c.post('/api/matches', await baseMatch({ date: '2099-05-01', status: 'SCHEDULED', homeScore: null, awayScore: null }));

    const d = (await c.get('/api/stats/dashboard')).body;
    expect(d.summary.total).toBe(3);
    expect(d.summary.referee).toBe(1);
    expect(d.summary.assistant).toBe(1);
    expect(d.summary.fourth).toBe(1);
    expect(d.summary.yellowCards).toBe(5);
    expect(d.summary.redCards).toBe(1);
    expect(d.summary.avgCardsPerMatch).toBe(2);
    expect(d.summary.distinctCategories).toBe(2);
    expect(d.summary.upcoming).toBe(1);
    expect(d.summary.lastMatchDate).toBe('2025-10-26');

    const ref = (await c.get('/api/stats/analytics?role=REFEREE')).body;
    expect(ref.summary.total).toBe(1);
    expect(ref.summary.yellowCards).toBe(2);
    const paf = (await c.get(`/api/stats/analytics?categoryId=${await categoryId('PAF')}`)).body;
    expect(paf.summary.total).toBe(1);
    expect(paf.categories[0]).toMatchObject({ name: 'PAF', count: 1, avgYellow: 1 });
  });

  it('sezon hedefi ilerlemesi hesaplanır', async () => {
    const { c } = await registerUser();
    await c.post('/api/matches', await baseMatch());
    await c.post('/api/matches', await baseMatch({ date: '2025-11-09', role: 'AR1' }));
    const g = await c.post('/api/goals', { title: 'Sezon hedefi', metric: 'TOTAL_MATCHES', target: 4, season: '2025-2026' });
    expect(g.status).toBe(201);
    await c.post('/api/goals', { title: 'Orta', metric: 'REFEREE_MATCHES', target: 1, season: '2025-2026' });
    const career = (await c.get('/api/stats/career')).body;
    const total = career.goals.find((x: { title: string }) => x.title === 'Sezon hedefi');
    expect(total.current).toBe(2);
    expect(total.percent).toBe(50);
    const orta = career.goals.find((x: { title: string }) => x.title === 'Orta');
    expect(orta.achieved).toBe(true);
    expect(career.badges.find((b: { id: string }) => b.id === 'goal-getter').earned).toBe(true);
  });
});

describe('yönetici yetkisi', () => {
  it('normal kullanıcı yönetici uç noktalarına erişemez', async () => {
    const { c } = await registerUser();
    expect((await c.get('/api/admin/overview')).status).toBe(403);
    expect((await c.get('/api/admin/users')).status).toBe(403);
    expect((await c.post('/api/admin/categories', { name: 'Hack' })).status).toBe(403);
  });

  it('kayıt sırasında rol yükseltilemez', async () => {
    const { c } = await registerUser();
    const me = (await c.get('/api/auth/me')).body.user;
    expect(me.role).toBe('USER');
    // Profil güncellemesine eklenen "role" alanı yok sayılır.
    await c.patch('/api/profile', { firstName: 'A', lastName: 'B', username: me.username, role: 'ADMIN' });
    expect((await c.get('/api/admin/overview')).status).toBe(403);
  });

  it('yönetici kullanıcıyı askıya alır ve yeniden etkinleştirir', async () => {
    const admin = await registerUser();
    await prisma.user.update({ where: { id: admin.user.id }, data: { role: 'ADMIN' } });
    const target = await registerUser();

    const overview = await admin.c.get('/api/admin/overview');
    expect(overview.status).toBe(200);
    expect(overview.body.users).toBeGreaterThan(0);

    expect((await admin.c.patch(`/api/admin/users/${target.user.id}/status`, { status: 'SUSPENDED' })).status).toBe(200);
    expect((await target.c.get('/api/matches')).status).toBe(401);
    expect((await admin.c.patch(`/api/admin/users/${target.user.id}/status`, { status: 'ACTIVE' })).status).toBe(200);
    expect((await admin.c.patch(`/api/admin/users/${admin.user.id}/status`, { status: 'SUSPENDED' })).status).toBe(400);
  });
});
