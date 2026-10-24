import { prisma } from '../db';

/** Kullanıcının "Son aktiviteler" akışına kayıt ekler. Hassas içerik (parola, not metni vb.) yazılmaz. */
export async function logActivity(userId: string, action: string, summary: string, entityId?: string) {
  await prisma.activityLog.create({ data: { userId, action, summary: summary.slice(0, 200), entityId } });
}
