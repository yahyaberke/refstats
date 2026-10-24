import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/db';

export const app = createApp();

let counter = 0;

/** Çerezleri saklayan ve CSRF başlığını otomatik ekleyen test istemcisi. */
export function client() {
  const agent = request.agent(app);
  const h = { 'X-Requested-With': 'RefStats' };
  return {
    agent,
    get: (url: string) => agent.get(url).set(h),
    post: (url: string, body?: object) => agent.post(url).set(h).send(body),
    put: (url: string, body?: object) => agent.put(url).set(h).send(body),
    patch: (url: string, body?: object) => agent.patch(url).set(h).send(body),
    del: (url: string) => agent.delete(url).set(h),
  };
}

export async function registerUser(overrides: Partial<{ email: string; username: string; password: string }> = {}) {
  counter++;
  const tag = `${Date.now().toString(36)}${counter}`;
  const creds = {
    email: overrides.email ?? `hakem${tag}@test.local`,
    username: overrides.username ?? `hakem_${tag}`,
    password: overrides.password ?? 'Parola1234',
  };
  const c = client();
  const res = await c.post('/api/auth/register', { ...creds, firstName: 'Test', lastName: 'Hakem', licenseNumber: '51800' });
  if (res.status !== 201) throw new Error(`register failed ${res.status} ${JSON.stringify(res.body)}`);
  return { c, user: res.body.user as { id: string; username: string }, creds };
}

export async function categoryId(name = 'U17') {
  const cat = await prisma.category.findFirstOrThrow({ where: { name, ownerId: null } });
  return cat.id;
}

export async function baseMatch(overrides: Record<string, unknown> = {}) {
  return {
    date: '2025-10-12',
    kickoffTime: '14:00',
    homeTeam: 'Yeşilvadi FK',
    awayTeam: 'Kuzeyspor',
    homeScore: 2,
    awayScore: 1,
    categoryId: await categoryId(),
    role: 'REFEREE',
    status: 'COMPLETED',
    cardEntryMode: 'DETAILED',
    cards: [],
    ...overrides,
  };
}
