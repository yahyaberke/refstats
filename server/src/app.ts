import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import { config } from './config';
import { HttpError } from './lib/errors';
import { csrfGuard, loadUser } from './middleware/auth';
import { activityRouter } from './routes/activity';
import { adminRouter } from './routes/admin';
import { authRouter } from './routes/auth';
import { categoriesRouter } from './routes/categories';
import { feedbackRouter } from './routes/feedback';
import { goalsRouter } from './routes/goals';
import { libraryRouter } from './routes/library';
import { matchesRouter } from './routes/matches';
import { profileRouter } from './routes/profile';
import { publicRouter } from './routes/public';
import { statsRouter } from './routes/stats';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Ters vekil sunucu (Render, Railway, Nginx vb.) arkasında doğru IP ve "secure" çerez için.
  if (config.isProd) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  const api = express.Router();
  api.use(csrfGuard);
  api.use(loadUser);
  api.use('/auth', authRouter);
  api.use('/profile', profileRouter);
  api.use('/matches', matchesRouter);
  api.use('/stats', statsRouter);
  api.use('/categories', categoriesRouter);
  api.use('/goals', goalsRouter);
  api.use('/library', libraryRouter);
  api.use('/feedback', feedbackRouter);
  api.use('/activity', activityRouter);
  api.use('/public', publicRouter);
  api.use('/admin', adminRouter);
  api.use((_req, _res, next) => next(new HttpError(404, 'Uç nokta bulunamadı', 'NOT_FOUND')));
  app.use('/api', api);

  // Profil fotoğrafları: rastgele dosya adlarıyla, yalnızca görsel olarak sunulur.
  app.use(
    '/uploads/avatars',
    express.static(path.join(config.uploadDir, 'avatars'), {
      fallthrough: false,
      maxAge: '7d',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );

  // Production: derlenmiş React uygulamasını aynı kökenden sun (SPA yönlendirmesi dahil).
  if (fs.existsSync(path.join(config.clientDist, 'index.html'))) {
    app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
  }

  // Merkezi hata yönetimi: iç ayrıntılar kullanıcıya gösterilmez.
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: { message: err.message, code: err.code, details: err.details } });
    }
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Dosya en fazla 2 MB olabilir' : 'Dosya yüklenemedi';
      return res.status(400).json({ error: { message, code: 'UPLOAD' } });
    }
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: { message: 'Geçersiz istek gövdesi', code: 'BAD_JSON' } });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: { message: 'Bu kayıt zaten mevcut', code: 'CONFLICT' } });
    }
    if ((err as { status?: number })?.status === 404 && req.path.startsWith('/uploads')) {
      return res.status(404).end();
    }
    // Yalnızca hata türü ve mesajı loglanır; istek gövdesi (kişisel veri/parola) loglanmaz.
    console.error(`[error] ${req.method} ${req.path}:`, err instanceof Error ? err.message : err);
    res.status(500).json({ error: { message: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.', code: 'INTERNAL' } });
  });

  return app;
}
