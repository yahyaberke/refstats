import type {
  AccountStatus,
  CardEntryMode,
  CardTeamSide,
  CardType,
  DashboardWidget,
  FeedbackStatus,
  FeedbackType,
  GoalMetric,
  MatchStatus,
  MatchType,
  OfficialRole,
  PersonType,
  ReportStatus,
  UserRole,
} from '@refstats/shared';

export interface Settings {
  profilePublic: boolean;
  showPhoto: boolean;
  showBio: boolean;
  showRegion: boolean;
  showOrganization: boolean;
  showStartYear: boolean;
  showStats: boolean;
  showCategories: boolean;
  showSeasons: boolean;
  showBadges: boolean;
  dashboardWidgets: DashboardWidget[];
  defaultRole: OfficialRole | null;
  defaultCategoryId: string | null;
  defaultCompetition: string | null;
}

export interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  role: UserRole;
  status: AccountStatus;
  avatarUrl: string | null;
  region: string | null;
  organization: string | null;
  classification: string | null;
  startYear: number | null;
  licenseNumber: string | null;
  bio: string | null;
  isDemo: boolean;
  closureRequestedAt: string | null;
  createdAt: string;
  settings: Settings | null;
}

export interface Category {
  id: string;
  name: string;
  custom: boolean;
}

export interface CardIncident {
  id?: string;
  type: CardType;
  personType: PersonType;
  personName: string | null;
  shirtNumber: number | null;
  team: CardTeamSide | null;
  minute: number | null;
  addedMinute: number | null;
  description: string | null;
}

export interface MatchNotes {
  generalAssessment: string | null;
  selfAssessment: string | null;
  difficultSituations: string | null;
  improvementAreas: string | null;
  observerEvaluation: string | null;
  observerScore: number | null;
  reportNotes: string | null;
  substitutionNotes: string | null;
  injuryNotes: string | null;
  disciplineNotes: string | null;
}

export interface Match {
  id: string;
  date: string;
  kickoffTime: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  halfTimeHome: number | null;
  halfTimeAway: number | null;
  competition: string | null;
  category: { id: string; name: string };
  season: string | null;
  round: string | null;
  venue: string | null;
  city: string | null;
  district: string | null;
  matchType: MatchType;
  status: MatchStatus;
  role: OfficialRole;
  additionalDuties: string | null;
  firstHalfAdded: number | null;
  secondHalfAdded: number | null;
  wentToExtraTime: boolean;
  penaltiesHome: number | null;
  penaltiesAway: number | null;
  reportStatus: ReportStatus;
  cardEntryMode: CardEntryMode;
  yellowCards: number;
  secondYellowReds: number;
  directReds: number;
  redCards: number;
  cards: CardIncident[];
  notes: MatchNotes | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paged<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

export interface Summary {
  total: number;
  referee: number;
  assistant: number;
  fourth: number;
  other: number;
  yellowCards: number;
  redCards: number;
  secondYellowReds: number;
  directReds: number;
  avgCardsPerMatch: number;
  avgYellowPerMatch: number;
  avgRedPerMatch: number;
  distinctCategories: number;
}

export interface MonthPoint {
  key: string;
  label: string;
  count: number;
  referee: number;
  assistant: number;
  fourth: number;
  other: number;
  yellowCards: number;
  redCards: number;
  avgCards?: number;
}

export interface GoalProgress {
  id: string;
  title: string;
  metric: GoalMetric;
  metricLabel: string;
  target: number;
  season: string | null;
  year: number | null;
  periodLabel: string | null;
  manualProgress: number;
  note: string | null;
  current: number;
  percent: number;
  achieved: boolean;
  timeline: { key: string; label: string; cumulative: number; target: number }[];
}

export interface Activity {
  id: string;
  action: string;
  summary: string;
  entityId: string | null;
  createdAt: string;
}

export interface RoleCount {
  role: OfficialRole;
  label: string;
  count: number;
}

export interface Dashboard {
  hasMatches: boolean;
  summary: Summary & {
    thisYear: number;
    lastMatchDate: string | null;
    upcoming: number;
    postponed: number;
    cancelled: number;
    pendingReports: number;
  };
  nextMatch: { id: string; date: string; homeTeam: string; awayTeam: string; role: OfficialRole; category: string } | null;
  recentMatches: {
    id: string;
    date: string;
    status: MatchStatus;
    role: OfficialRole;
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
    yellowCards: number;
    redCards: number;
    category: string;
  }[];
  last30: { date: string; label: string; count: number }[];
  monthly: MonthPoint[];
  categories: { name: string; count: number }[];
  roles: RoleCount[];
  goals: GoalProgress[];
  activity: Activity[];
}

export interface Analytics {
  summary: Summary;
  statusCounts: { completed: number; scheduled: number; postponed: number; cancelled: number };
  roles: RoleCount[];
  roleComparison: {
    key: string;
    label: string;
    count: number;
    yellowCards: number;
    redCards: number;
    avgYellow: number;
    avgRed: number;
    avgGoals: number;
  }[];
  categories: {
    name: string;
    count: number;
    yellowCards: number;
    redCards: number;
    avgYellow: number;
    avgRed: number;
    avgCards: number;
  }[];
  topCategories: { name: string; count: number }[];
  topCompetitions: { name: string; count: number }[];
  seasons: (Summary & { name: string })[];
  years: (Summary & { year: string })[];
  monthly: MonthPoint[];
  weekday: { label: string; count: number }[];
  results: { withScore: number; homeWins: number; draws: number; awayWins: number; avgGoals: number };
  topTeams: { name: string; count: number; home: number; away: number }[];
  observerTrend: { date: string; label: string; score: number; match: string }[];
  goals: GoalProgress[];
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  earned: boolean;
  earnedAt: string | null;
}

export interface Career {
  summary: Summary;
  firstMatchDate: string | null;
  lastMatchDate: string | null;
  yearHistory: {
    year: string;
    total: number;
    referee: number;
    assistant: number;
    fourth: number;
    other: number;
    categories: string[];
  }[];
  roles: RoleCount[];
  categories: { name: string; count: number }[];
  seasons: (Summary & { name: string })[];
  goals: GoalProgress[];
  badges: Badge[];
}

export interface Suggestions {
  teams: { id: string; name: string; isFavorite: boolean }[];
  venues: { id: string; name: string; city: string | null; district: string | null; isFavorite: boolean }[];
  competitions: string[];
  topCategoryIds: string[];
  topRoles: OfficialRole[];
  seasons: string[];
}

export interface CalendarItem {
  id: string;
  date: string;
  kickoffTime: string | null;
  status: MatchStatus;
  role: OfficialRole;
  roleShort: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  category: string;
  venue: string | null;
}

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  message: string;
  status: FeedbackStatus;
  adminNote: string | null;
  createdAt: string;
}

export interface SessionInfo {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  current: boolean;
}

export interface PublicProfile {
  profile: {
    username: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    bio: string | null;
    region: string | null;
    organization: string | null;
    classification: string | null;
    startYear: number | null;
  };
  stats: {
    total: number;
    referee: number;
    assistant: number;
    fourth: number;
    other: number;
    yellowCards: number;
    redCards: number;
    firstMatchDate: string | null;
    yearHistory: { year: string; total: number; referee: number; assistant: number; fourth: number; other: number }[];
  } | null;
  categories: { name: string; count: number }[] | null;
  seasons: { name: string; total: number; referee: number; assistant: number; fourth: number }[] | null;
  badges: { id: string; title: string; description: string }[] | null;
}
