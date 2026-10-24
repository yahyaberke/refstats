// Uygulama genelindeki sabit değerler ve Türkçe etiketleri.
// Değerler Prisma enum'ları ile birebir aynıdır.

export const OFFICIAL_ROLES = ['REFEREE', 'AR1', 'AR2', 'FOURTH', 'ADDITIONAL_AR', 'OTHER'] as const;
export type OfficialRole = (typeof OFFICIAL_ROLES)[number];
export const OFFICIAL_ROLE_LABELS: Record<OfficialRole, string> = {
  REFEREE: 'Orta hakem',
  AR1: 'Yardımcı hakem 1',
  AR2: 'Yardımcı hakem 2',
  FOURTH: 'Dördüncü hakem',
  ADDITIONAL_AR: 'İlave yardımcı hakem',
  OTHER: 'Diğer görev',
};
export const OFFICIAL_ROLE_SHORT: Record<OfficialRole, string> = {
  REFEREE: 'Orta',
  AR1: 'YH1',
  AR2: 'YH2',
  FOURTH: '4. Hakem',
  ADDITIONAL_AR: 'İYH',
  OTHER: 'Diğer',
};
/** Yardımcı hakemlik sayılan görevler (istatistiklerde birlikte gruplanır). */
export const ASSISTANT_ROLES: OfficialRole[] = ['AR1', 'AR2', 'ADDITIONAL_AR'];

export const MATCH_TYPES = ['LEAGUE', 'CUP', 'FRIENDLY', 'TOURNAMENT', 'SPECIAL'] as const;
export type MatchType = (typeof MATCH_TYPES)[number];
export const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  LEAGUE: 'Lig',
  CUP: 'Kupa',
  FRIENDLY: 'Hazırlık maçı',
  TOURNAMENT: 'Turnuva',
  SPECIAL: 'Özel maç',
};

export const MATCH_STATUSES = ['SCHEDULED', 'COMPLETED', 'POSTPONED', 'CANCELLED'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];
export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  SCHEDULED: 'Planlandı (gelecek)',
  COMPLETED: 'Tamamlandı',
  POSTPONED: 'Ertelendi',
  CANCELLED: 'İptal edildi',
};

export const REPORT_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'DONE'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  NOT_STARTED: 'Hazırlanmadı',
  IN_PROGRESS: 'Hazırlanıyor',
  DONE: 'Tamamlandı',
};

export const CARD_ENTRY_MODES = ['DETAILED', 'SUMMARY'] as const;
export type CardEntryMode = (typeof CARD_ENTRY_MODES)[number];
export const CARD_ENTRY_MODE_LABELS: Record<CardEntryMode, string> = {
  DETAILED: 'Olay bazlı (ayrıntılı)',
  SUMMARY: 'Yalnızca özet sayılar',
};

/**
 * Kart olayı türleri. Her olay sahada yaşanan TEK bir disiplin kararıdır:
 *  - YELLOW: İhtar (sarı kart). İkinci sarıya yol açan kişinin İLK sarısı da bu türdür.
 *  - SECOND_YELLOW: İkinci sarı kart ve sonucunda gelen kırmızı (ihraç).
 *  - DIRECT_RED: Doğrudan kırmızı kart.
 * Toplam tanımları için bkz. computeCardTotals.
 */
export const CARD_TYPES = ['YELLOW', 'SECOND_YELLOW', 'DIRECT_RED'] as const;
export type CardType = (typeof CARD_TYPES)[number];
export const CARD_TYPE_LABELS: Record<CardType, string> = {
  YELLOW: 'Sarı kart',
  SECOND_YELLOW: 'İkinci sarıdan kırmızı',
  DIRECT_RED: 'Doğrudan kırmızı',
};

export const PERSON_TYPES = [
  'PLAYER',
  'SUBSTITUTE',
  'HEAD_COACH',
  'COACH',
  'TECHNICAL_STAFF',
  'MANAGER',
  'TEAM_OFFICIAL',
  'OTHER',
] as const;
export type PersonType = (typeof PERSON_TYPES)[number];
export const PERSON_TYPE_LABELS: Record<PersonType, string> = {
  PLAYER: 'Oyuncu',
  SUBSTITUTE: 'Yedek oyuncu',
  HEAD_COACH: 'Teknik direktör',
  COACH: 'Antrenör',
  TECHNICAL_STAFF: 'Teknik sorumlu',
  MANAGER: 'Yönetici',
  TEAM_OFFICIAL: 'Takım görevlisi',
  OTHER: 'Diğer',
};

export const CARD_TEAM_SIDES = ['HOME', 'AWAY'] as const;
export type CardTeamSide = (typeof CARD_TEAM_SIDES)[number];

export const GOAL_METRICS = [
  'TOTAL_MATCHES',
  'REFEREE_MATCHES',
  'ASSISTANT_MATCHES',
  'FOURTH_MATCHES',
  'CUSTOM',
] as const;
export type GoalMetric = (typeof GOAL_METRICS)[number];
export const GOAL_METRIC_LABELS: Record<GoalMetric, string> = {
  TOTAL_MATCHES: 'Toplam maç',
  REFEREE_MATCHES: 'Orta hakemlik',
  ASSISTANT_MATCHES: 'Yardımcı hakemlik',
  FOURTH_MATCHES: 'Dördüncü hakemlik',
  CUSTOM: 'Kişisel gelişim hedefi (manuel)',
};

export const FEEDBACK_TYPES = ['BUG', 'SUGGESTION', 'QUESTION', 'OTHER'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  BUG: 'Hata bildirimi',
  SUGGESTION: 'Öneri',
  QUESTION: 'Soru',
  OTHER: 'Diğer',
};
export const FEEDBACK_STATUSES = ['OPEN', 'REVIEWED', 'RESOLVED'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  OPEN: 'Açık',
  REVIEWED: 'İncelendi',
  RESOLVED: 'Çözüldü',
};

export const ACCOUNT_STATUSES = ['ACTIVE', 'SUSPENDED', 'CLOSURE_REQUESTED', 'CLOSED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  ACTIVE: 'Aktif',
  SUSPENDED: 'Askıya alındı',
  CLOSURE_REQUESTED: 'Kapatma talebi',
  CLOSED: 'Kapatıldı',
};

export const USER_ROLES = ['USER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Başlangıçta hazır sunulan kategoriler (seed ile veritabanına yazılır). */
export const DEFAULT_CATEGORIES = [
  'U11',
  'U12',
  'U13',
  'U14',
  'U15',
  'U16',
  'U17',
  'U18',
  'U19',
  'PAF',
  '2. Amatör Lig',
  '1. Amatör Lig',
  'Süper Amatör Lig (SAL)',
  'Diğer',
] as const;

export const DASHBOARD_WIDGETS = [
  'summary',
  'recentMatches',
  'last30',
  'monthly',
  'categories',
  'roles',
  'cards',
  'goals',
  'activity',
] as const;
export type DashboardWidget = (typeof DASHBOARD_WIDGETS)[number];
export const DASHBOARD_WIDGET_LABELS: Record<DashboardWidget, string> = {
  summary: 'Özet kartları',
  recentMatches: 'Son eklenen maçlar',
  last30: 'Son 30 gün grafiği',
  monthly: 'Aylık dağılım',
  categories: 'Kategori dağılımı',
  roles: 'Görev türü dağılımı',
  cards: 'Kart grafikleri',
  goals: 'Hedef ilerlemesi',
  activity: 'Son aktiviteler',
};
