import { PrismaClient } from '@prisma/client';

// Prisma tüm sorguları parametreli çalıştırır (SQL injection'a karşı koruma).
// Sorgu logları kapalıdır: parametreler kişisel veri içerebilir.
export const prisma = new PrismaClient({ log: ['warn', 'error'] });
