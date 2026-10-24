import { useState } from 'react';
import type { ZodType } from 'zod';
import { ApiError } from './api';

export type FieldErrors = Record<string, string>;

/** Zod hatalarını "alan.yolu" → mesaj eşlemesine çevirir. */
export function zodErrors(schema: ZodType, value: unknown): FieldErrors | null {
  const r = schema.safeParse(value);
  if (r.success) return null;
  const out: FieldErrors = {};
  for (const i of r.error.issues) {
    const k = i.path.join('.') || '_';
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

/** Sunucudan gelen alan hatalarını alır; yoksa genel mesajı döner. */
export function apiErrors(e: unknown): { fields: FieldErrors; message: string } {
  if (e instanceof ApiError) {
    const { matchIds: _ignored, ...rest } = e.details ?? {};
    return { fields: (rest as FieldErrors) ?? {}, message: e.message };
  }
  return { fields: {}, message: 'Beklenmeyen bir hata oluştu' };
}

export function useFieldErrors() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const clear = (key: string) =>
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  return { errors, setErrors, clear };
}
