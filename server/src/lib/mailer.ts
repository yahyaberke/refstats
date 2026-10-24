import nodemailer from 'nodemailer';
import { config } from '../config';

const transporter = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null;

export const mailConfigured = Boolean(transporter);

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (transporter) {
    await transporter.sendMail({ from: config.smtp.from, to, subject, text });
    return;
  }
  if (config.mailDevLog) {
    // Yalnızca geliştirme ortamında ve MAIL_DEV_LOG=true ise. Production'da asla çalışmaz.
    console.info(`\n[mail:dev] Alıcı: ${to}\n[mail:dev] Konu: ${subject}\n${text}\n`);
    return;
  }
  if (!config.isTest) console.warn('[mail] SMTP yapılandırılmadığı için e-posta gönderilemedi.');
}
