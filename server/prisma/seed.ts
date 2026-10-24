/**
 * Temel veri: sistem kategorileri (idempotent) ve isteğe bağlı ilk yönetici.
 * Çalıştırma: npm run db:seed
 */
import { PrismaClient } from '@prisma/client';
import { DEFAULT_CATEGORIES } from '@refstats/shared';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  let created = 0;
  for (const [i, name] of DEFAULT_CATEGORIES.entries()) {
    const existing = await prisma.category.findFirst({ where: { ownerId: null, name } });
    if (!existing) {
      await prisma.category.create({ data: { name, sortOrder: (i + 1) * 10, isSystem: true } });
      created++;
    }
  }
  console.info(`Kategoriler hazır (${created} yeni, toplam ${DEFAULT_CATEGORIES.length}).`);

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 12) throw new Error('ADMIN_PASSWORD en az 12 karakter olmalı.');
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' } });
      console.info(`Mevcut kullanıcı yönetici yapıldı: ${email}`);
    } else {
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
  } else {
    console.info('ADMIN_EMAIL/ADMIN_PASSWORD tanımlı değil; yönetici oluşturulmadı.');
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
