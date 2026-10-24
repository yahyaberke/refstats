import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodSchema, ZodTypeDef } from 'zod';

/** Kullanıcıya gösterilebilecek, kontrollü hata. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Kayıt') => new HttpError(404, `${what} bulunamadı`, 'NOT_FOUND');

/** async route handler'larındaki hataları error middleware'ine iletir. */
export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req as T, res, next).catch(next);
  };
}

/** İstek gövdesini Zod şemasıyla doğrular; hata durumunda alan bazlı 400 döner. */
export function parseBody<Out, In = Out>(schema: ZodSchema<Out, ZodTypeDef, In>, body: unknown): Out {
  const result = schema.safeParse(body);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    throw new HttpError(400, 'Lütfen formdaki hataları düzeltin', 'VALIDATION', fieldErrors);
  }
  return result.data;
}
