/**
 * Mevcut bir kullanıcıyı yönetici yapar:
 *   npm run create-admin -- kullanici@ornek.com
 * Kullanıcı yoksa ADMIN_PASSWORD ortam değişkeniyle yeni yönetici oluşturulur.
 * Yönetici rolü yalnızca sunucuya erişimi olan kişi tarafından bu komutla verilebilir; API üzerinden verilemez.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error('Kullanım: npm run create-admin -- <e-posta>');
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN', status: 'ACTIVE' } });
    console.info(`${email} artık yönetici.`);
    return;
  }
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error('Kullanıcı bulunamadı. Yeni yönetici için ADMIN_PASSWORD (en az 12 karakter) tanımlayın.');
  }
  await prisma.user.create({
    data: {
      email,
      username: `admin_${Math.random().toString(36).slice(2, 7)}`,
      firstName: 'Sistem',
      lastName: 'Yöneticisi',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(password, 12),
      settings: { create: {} },
    },
  });
  console.info(`Yönetici oluşturuldu: ${email}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
