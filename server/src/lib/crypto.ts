import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_COST = process.env.NODE_ENV === 'test' ? 4 : 12;

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_COST);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

/** Zamanlama saldırılarını azaltmak için: kullanıcı bulunamadığında da bir bcrypt karşılaştırması yapılır. */
const DUMMY_HASH = bcrypt.hashSync('refstats-dummy-password', BCRYPT_COST);
export const fakeVerify = (password: string) => bcrypt.compare(password, DUMMY_HASH);

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
