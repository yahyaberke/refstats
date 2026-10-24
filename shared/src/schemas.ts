import { z } from 'zod';
import {
  CARD_ENTRY_MODES,
  CARD_TEAM_SIDES,
  CARD_TYPES,
  DASHBOARD_WIDGETS,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  GOAL_METRICS,
  MATCH_STATUSES,
  MATCH_TYPES,
  OFFICIAL_ROLES,
  PERSON_TYPES,
  REPORT_STATUSES,
} from './constants';

const trimmed = (max: number) => z.string().trim().max(max, `En fazla ${max} karakter olabilir`);
/** Boş string'i null'a çeviren isteğe bağlı metin alanı. */
const optionalText = (max: number) =>
  z
    .union([trimmed(max), z.null()])
    .optional()
    .transform((v) => (v ? v : null));
const optionalInt = (min: number, max: number, label = 'Değer') =>
  z
    .number({ invalid_type_error: `${label} sayı olmalı` })
    .int(`${label} tam sayı olmalı`)
    .min(min, `${label} en az ${min} olabilir`)
    .max(max, `${label} en fazla ${max} olabilir`)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? null : v));

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-AA-GG biçiminde olmalı')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Geçersiz tarih');

export const passwordSchema = z
  .string()
  .min(8, 'Parola en az 8 karakter olmalı')
  .max(128, 'Parola en fazla 128 karakter olabilir')
  .refine((p) => /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(p) && /\d/.test(p), 'Parola en az bir harf ve bir rakam içermeli');

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Kullanıcı adı en az 3 karakter olmalı')
  .max(30, 'Kullanıcı adı en fazla 30 karakter olabilir')
  .regex(/^[a-z0-9_.]+$/, 'Kullanıcı adı yalnızca küçük harf, rakam, nokta ve alt çizgi içerebilir');

export const emailSchema = z.string().trim().toLowerCase().email('Geçerli bir e-posta adresi girin').max(254);

/** Hakem lisans numarası: 5 hane. İlk iki hane hakemliğe başlangıç yılını gösterir (bkz. startYearFromLicense). */
export const licenseNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{5}$/, 'Lisans numarası 5 haneli bir sayı olmalı');

/** "51800" → 2023, "50123" → 2022. Geçersiz/makul olmayan yıl için null. */
export function startYearFromLicense(license: string | null | undefined): number | null {
  if (!license || !/^\d{5}$/.test(license)) return null;
  const year = 1972 + Number(license.slice(0, 2));
  return year >= 1950 && year <= new Date().getFullYear() ? year : null;
}

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: trimmed(60).min(1, 'Ad zorunludur'),
  lastName: trimmed(60).min(1, 'Soyad zorunludur'),
  username: usernameSchema,
  licenseNumber: licenseNumberSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Parola zorunludur').max(128),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mevcut parola zorunludur').max(128),
  newPassword: passwordSchema,
});

const currentYear = new Date().getFullYear();
export const profileSchema = z.object({
  firstName: trimmed(60).min(1, 'Ad zorunludur'),
  lastName: trimmed(60).min(1, 'Soyad zorunludur'),
  username: usernameSchema,
  region: optionalText(80),
  organization: optionalText(120),
  classification: optionalText(80),
  startYear: optionalInt(1950, currentYear, 'Başlangıç yılı'),
  licenseNumber: z
    .union([licenseNumberSchema, z.literal(''), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  bio: optionalText(600),
});
export type ProfileInput = z.input<typeof profileSchema>;

export const settingsSchema = z.object({
  profilePublic: z.boolean(),
  showPhoto: z.boolean(),
  showBio: z.boolean(),
  showRegion: z.boolean(),
  showOrganization: z.boolean(),
  showStartYear: z.boolean(),
  showStats: z.boolean(),
  showCategories: z.boolean(),
  showSeasons: z.boolean(),
  showBadges: z.boolean(),
  dashboardWidgets: z.array(z.enum(DASHBOARD_WIDGETS)).max(DASHBOARD_WIDGETS.length),
  defaultRole: z.enum(OFFICIAL_ROLES).nullable(),
  defaultCategoryId: z.string().max(40).nullable(),
  defaultCompetition: optionalText(120),
});
export type SettingsInput = z.input<typeof settingsSchema>;

export const cardIncidentSchema = z.object({
  type: z.enum(CARD_TYPES),
  personType: z.enum(PERSON_TYPES),
  personName: optionalText(80),
  shirtNumber: optionalInt(0, 99, 'Forma numarası'),
  team: z.enum(CARD_TEAM_SIDES).nullable().optional().transform((v) => v ?? null),
  minute: optionalInt(0, 130, 'Dakika'),
  addedMinute: optionalInt(0, 30, 'Ek süre'),
  description: optionalText(500),
});
export type CardIncidentInput = z.input<typeof cardIncidentSchema>;

export const matchNotesSchema = z.object({
  generalAssessment: optionalText(5000),
  selfAssessment: optionalText(5000),
  difficultSituations: optionalText(5000),
  improvementAreas: optionalText(5000),
  observerEvaluation: optionalText(5000),
  observerScore: z
    .number()
    .min(0, 'Puan 0-10 arasında olmalı')
    .max(10, 'Puan 0-10 arasında olmalı')
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? null : v)),
  reportNotes: optionalText(5000),
  substitutionNotes: optionalText(3000),
  injuryNotes: optionalText(3000),
  disciplineNotes: optionalText(3000),
});
export type MatchNotesInput = z.input<typeof matchNotesSchema>;

export const summaryCardsSchema = z.object({
  yellowCards: z.number().int().min(0).max(40),
  secondYellowReds: z.number().int().min(0).max(20),
  directReds: z.number().int().min(0).max(20),
});

export const matchSchema = z
  .object({
    date: isoDate,
    kickoffTime: z
      .union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Saat SS:DD biçiminde olmalı'), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
    homeTeam: trimmed(80).min(1, 'Ev sahibi takım zorunludur'),
    awayTeam: trimmed(80).min(1, 'Deplasman takımı zorunludur'),
    homeScore: optionalInt(0, 99, 'Skor'),
    awayScore: optionalInt(0, 99, 'Skor'),
    halfTimeHome: optionalInt(0, 99, 'Devre skoru'),
    halfTimeAway: optionalInt(0, 99, 'Devre skoru'),
    competition: optionalText(120),
    categoryId: z.string().min(1, 'Kategori seçin').max(40),
    season: z
      .union([z.string().regex(/^\d{4}-\d{4}$/, 'Sezon 2025-2026 biçiminde olmalı'), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
    round: optionalText(40),
    venue: optionalText(120),
    city: optionalText(60),
    district: optionalText(60),
    matchType: z.enum(MATCH_TYPES).default('LEAGUE'),
    status: z.enum(MATCH_STATUSES).default('COMPLETED'),
    role: z.enum(OFFICIAL_ROLES, { errorMap: () => ({ message: 'Görev türü seçin' }) }),
    additionalDuties: optionalText(200),
    firstHalfAdded: optionalInt(0, 30, 'Uzatma dakikası'),
    secondHalfAdded: optionalInt(0, 30, 'Uzatma dakikası'),
    wentToExtraTime: z.boolean().default(false),
    penaltiesHome: optionalInt(0, 50, 'Penaltı'),
    penaltiesAway: optionalInt(0, 50, 'Penaltı'),
    reportStatus: z.enum(REPORT_STATUSES).default('NOT_STARTED'),
    cardEntryMode: z.enum(CARD_ENTRY_MODES).default('DETAILED'),
    summaryCards: summaryCardsSchema.nullable().optional(),
    cards: z.array(cardIncidentSchema).max(80, 'Bir maçta en fazla 80 kart olayı kaydedilebilir').default([]),
    notes: matchNotesSchema.nullable().optional(),
    allowDuplicate: z.boolean().optional(),
  })
  .superRefine((m, ctx) => {
    if (m.homeTeam.toLocaleLowerCase('tr') === m.awayTeam.toLocaleLowerCase('tr')) {
      ctx.addIssue({ code: 'custom', path: ['awayTeam'], message: 'Ev sahibi ve deplasman takımı aynı olamaz' });
    }
    if ((m.homeScore === null) !== (m.awayScore === null)) {
      ctx.addIssue({ code: 'custom', path: ['awayScore'], message: 'Skor için iki takımın golünü de girin' });
    }
    if ((m.halfTimeHome === null) !== (m.halfTimeAway === null)) {
      ctx.addIssue({ code: 'custom', path: ['halfTimeAway'], message: 'Devre skoru için iki değeri de girin' });
    }
    if (
      m.halfTimeHome !== null &&
      m.homeScore !== null &&
      (m.halfTimeHome > m.homeScore || (m.halfTimeAway ?? 0) > (m.awayScore ?? 0))
    ) {
      ctx.addIssue({ code: 'custom', path: ['halfTimeHome'], message: 'Devre skoru maç sonu skorundan büyük olamaz' });
    }
    if ((m.penaltiesHome === null) !== (m.penaltiesAway === null)) {
      ctx.addIssue({ code: 'custom', path: ['penaltiesAway'], message: 'Penaltı atışları için iki değeri de girin' });
    }
    if (m.status === 'COMPLETED') {
      // Saat dilimi farkları için bir gün tolerans.
      const tomorrow = new Date(Date.now() + 36 * 3600 * 1000).toISOString().slice(0, 10);
      if (m.date > tomorrow) {
        ctx.addIssue({
          code: 'custom',
          path: ['status'],
          message: 'Gelecek tarihli maç "Tamamlandı" olamaz; durumu "Planlandı" seçin',
        });
      }
    }
    if (m.cardEntryMode === 'SUMMARY') {
      if (!m.summaryCards) {
        ctx.addIssue({ code: 'custom', path: ['summaryCards'], message: 'Özet kart sayılarını girin' });
      } else if (m.summaryCards.yellowCards < m.summaryCards.secondYellowReds * 2) {
        ctx.addIssue({
          code: 'custom',
          path: ['summaryCards', 'yellowCards'],
          message: 'Toplam sarı kart, ikinci sarıdan kırmızı sayısının en az iki katı olmalı (ilk sarı + ikinci sarı)',
        });
      }
      if (m.cards.length > 0) {
        ctx.addIssue({ code: 'custom', path: ['cards'], message: 'Özet modunda ayrıntılı kart olayı gönderilemez' });
      }
    } else {
      const yellows = m.cards.filter((c) => c.type === 'YELLOW').length;
      const seconds = m.cards.filter((c) => c.type === 'SECOND_YELLOW').length;
      if (seconds > yellows) {
        ctx.addIssue({
          code: 'custom',
          path: ['cards'],
          message: 'Her "ikinci sarıdan kırmızı" olayı için kişinin ilk sarı kartı da ayrı bir olay olarak girilmeli',
        });
      }
    }
  });
export type MatchInput = z.input<typeof matchSchema>;
export type MatchParsed = z.output<typeof matchSchema>;

export const goalSchema = z
  .object({
    title: trimmed(100).min(1, 'Hedef başlığı zorunludur'),
    metric: z.enum(GOAL_METRICS),
    target: z.number().int().min(1, 'Hedef en az 1 olmalı').max(1000),
    season: z
      .union([z.string().regex(/^\d{4}-\d{4}$/), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
    year: optionalInt(2000, 2100, 'Yıl'),
    manualProgress: z.number().int().min(0).max(1000).default(0),
    note: optionalText(300),
  })
  .superRefine((g, ctx) => {
    if (g.metric !== 'CUSTOM' && !g.season && g.year === null) {
      ctx.addIssue({ code: 'custom', path: ['season'], message: 'Sezon veya yıl seçin' });
    }
  });
export type GoalInput = z.input<typeof goalSchema>;

export const feedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  message: trimmed(2000).min(10, 'Mesaj en az 10 karakter olmalı'),
  page: optionalText(200),
});

export const feedbackAdminSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES),
  adminNote: optionalText(1000),
});

export const categoryCreateSchema = z.object({
  name: trimmed(60).min(1, 'Kategori adı zorunludur'),
});
export const categoryAdminSchema = z.object({
  name: trimmed(60).min(1, 'Kategori adı zorunludur'),
  sortOrder: z.number().int().min(0).max(10000).default(500),
  isActive: z.boolean().default(true),
});

export const closureRequestSchema = z.object({
  password: z.string().min(1, 'Parolanızı girin').max(128),
  reason: optionalText(500),
});
