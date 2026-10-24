import { createApp } from './app';
import { config } from './config';
import { prisma } from './db';
import { mailConfigured } from './lib/mailer';

async function main() {
  await prisma.$connect();
  // Süresi dolmuş oturumları ve sıfırlama token'larını periyodik olarak temizle.
  const cleanup = () =>
    Promise.all([
      prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
      prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    ]).catch(() => undefined);
  await cleanup();
  setInterval(cleanup, 6 * 3600 * 1000).unref();

  const app = createApp();
  app.listen(config.port, () => {
    console.info(`RefStats API http://localhost:${config.port} (${config.env})`);
    if (!mailConfigured) {
      console.info(
        config.mailDevLog
          ? '[mail] SMTP yok: parola sıfırlama bağlantıları geliştirme konsoluna yazılacak.'
          : '[mail] SMTP yapılandırılmadı: parola sıfırlama e-postaları gönderilemez.',
      );
    }
  });
}

main().catch((err) => {
  console.error('Sunucu başlatılamadı:', err instanceof Error ? err.message : err);
  process.exit(1);
});
