import type { User, UserSettings } from '@prisma/client';

export const avatarUrl = (file: string | null) => (file ? `/uploads/avatars/${file}` : null);

/** Kullanıcının KENDİSİNE gösterilen profil (özel alanlar dahil). passwordHash asla dönmez. */
export function serializeMe(user: User, settings: UserSettings | null) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    role: user.role,
    status: user.status,
    avatarUrl: avatarUrl(user.avatarFile),
    region: user.region,
    organization: user.organization,
    classification: user.classification,
    startYear: user.startYear,
    licenseNumber: user.licenseNumber,
    bio: user.bio,
    isDemo: user.isDemo,
    closureRequestedAt: user.closureRequestedAt,
    createdAt: user.createdAt,
    settings: settings ? serializeSettings(settings) : null,
  };
}

export function serializeSettings(s: UserSettings) {
  return {
    profilePublic: s.profilePublic,
    showPhoto: s.showPhoto,
    showBio: s.showBio,
    showRegion: s.showRegion,
    showOrganization: s.showOrganization,
    showStartYear: s.showStartYear,
    showStats: s.showStats,
    showCategories: s.showCategories,
    showSeasons: s.showSeasons,
    showBadges: s.showBadges,
    dashboardWidgets: s.dashboardWidgets,
    defaultRole: s.defaultRole,
    defaultCategoryId: s.defaultCategoryId,
    defaultCompetition: s.defaultCompetition,
  };
}

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
