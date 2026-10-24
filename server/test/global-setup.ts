import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

/**
 * Test veritabanını hazırlar: migration'ları uygular, tabloları boşaltır ve sistem kategorilerini yükler.
 * Güvenlik: yalnızca adı "_test" ile biten ve DATABASE_URL'den farklı bir veritabanında çalışır.
 */
export default async function setup() {
  if (fs.existsSync('.env')) process.loadEnvFile('.env');
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL tanımlı değil (bkz. .env.example)');
  const dbName = new URL(url).pathname.slice(1);
  if (url === process.env.DATABASE_URL || !dbName.endsWith('_test')) {
    throw new Error('TEST_DATABASE_URL, adı "_test" ile biten ayrı bir veritabanını göstermeli (testler verileri siler)');
  }
  const env = { ...process.env, DATABASE_URL: url, ADMIN_EMAIL: '', ADMIN_PASSWORD: '' };
  execSync('npx prisma migrate deploy', { env, stdio: 'ignore' });

  const prisma = new PrismaClient({ datasourceUrl: url });
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
  }
  await prisma.$disconnect();
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'ignore' });
}
