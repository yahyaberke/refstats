import fs from 'node:fs';

// Testler her zaman ayrı test veritabanında çalışır; geliştirme verisine dokunulmaz.
if (fs.existsSync('.env')) process.loadEnvFile('.env');
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL tanımlı değil (bkz. .env.example)');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.MAIL_DEV_LOG = 'false';
process.env.UPLOAD_DIR = 'test/.uploads';
