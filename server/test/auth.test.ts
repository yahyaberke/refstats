import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { client, registerUser } from './helpers';

afterAll(() => prisma.$disconnect());

describe('kimlik doğrulama', () => {
  it('kayıt olur, oturum açar ve /me ile kullanıcıyı döner', async () => {
    const { c, creds } = await registerUser();
    const me = await c.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(creds.email);
    expect(me.body.user.passwordHash).toBeUndefined();

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: creds.email } });
    expect(stored.passwordHash).not.toContain(creds.password);
    expect(stored.passwordHash.startsWith('$2')).toBe(true);
  });

  it('zayıf parolayı ve geçersiz e-postayı reddeder', async () => {
    const res = await client().post('/api/auth/register', {
      email: 'gecersiz',
      password: 'kisa',
      firstName: 'A',
      lastName: 'B',
      username: 'ab_test',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details.email).toBeDefined();
    expect(res.body.error.details.password).toBeDefined();
  });

  it('aynı kullanıcı adıyla ikinci kaydı engeller', async () => {
    const { creds } = await registerUser();
    const res = await client().post('/api/auth/register', {
      email: `baska_${creds.email}`,
      password: 'Parola1234',
      firstName: 'X',
      lastName: 'Y',
      username: creds.username,
    });
    expect(res.status).toBe(409);
  });

  it('hatalı parolada genel bir hata döner, doğru parolada giriş yapar', async () => {
    const { creds } = await registerUser();
    const bad = await client().post('/api/auth/login', { email: creds.email, password: 'YanlisParola1' });
    expect(bad.status).toBe(401);
    const unknown = await client().post('/api/auth/login', { email: 'yok@test.local', password: 'YanlisParola1' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.message).toBe(bad.body.error.message);

    const c = client();
    const ok = await c.post('/api/auth/login', creds);
    expect(ok.status).toBe(200);
    expect((await c.get('/api/auth/me')).body.user.email).toBe(creds.email);
  });

  it('çıkış yapınca oturum geçersiz olur', async () => {
    const { c } = await registerUser();
    await c.post('/api/auth/logout');
    expect((await c.get('/api/auth/me')).body.user).toBeNull();
    expect((await c.get('/api/matches')).status).toBe(401);
  });

  it('CSRF başlığı olmayan durum değiştiren istekleri reddeder', async () => {
    const { c } = await registerUser();
    const res = await c.agent.post('/api/matches').send({});
    expect(res.status).toBe(403);
  });

  it('parola sıfırlama: token tek kullanımlıktır ve tüm oturumları kapatır', async () => {
    const { c, creds } = await registerUser();
    const res = await client().post('/api/auth/forgot-password', { email: creds.email });
    expect(res.status).toBe(200);
    // Var olmayan e-posta için de aynı yanıt (hesap varlığı ifşa edilmez).
    const res2 = await client().post('/api/auth/forgot-password', { email: 'yok@test.local' });
    expect(res2.body.message).toBe(res.body.message);

    // Ham token yalnızca e-postada olduğu için testte doğrudan yeni bir token üretiyoruz.
    const { randomToken, sha256 } = await import('../src/lib/crypto');
    const user = await prisma.user.findUniqueOrThrow({ where: { email: creds.email } });
    const token = randomToken();
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60_000) },
    });
    const reset = await client().post('/api/auth/reset-password', { token, password: 'YeniParola99' });
    expect(reset.status).toBe(200);
    expect((await c.get('/api/auth/me')).body.user).toBeNull();
    const again = await client().post('/api/auth/reset-password', { token, password: 'BaskaParola99' });
    expect(again.status).toBe(400);
    expect((await client().post('/api/auth/login', { email: creds.email, password: 'YeniParola99' })).status).toBe(200);
  });

  it('askıya alınan kullanıcı giriş yapamaz ve mevcut oturumu düşer', async () => {
    const { c, creds, user } = await registerUser();
    await prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
    expect((await c.get('/api/matches')).status).toBe(401);
    expect((await client().post('/api/auth/login', creds)).status).toBe(403);
  });
});
