import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  ChevronDown,
  Copy,
  History,
  Plus,
  Save,
  Star,
  Trash2,
  WifiOff,
} from 'lucide-react';
import {
  CARD_TYPE_LABELS,
  CARD_TYPES,
  computeCardTotals,
  MATCH_STATUS_LABELS,
  MATCH_STATUSES,
  MATCH_TYPE_LABELS,
  MATCH_TYPES,
  matchSchema,
  OFFICIAL_ROLE_LABELS,
  OFFICIAL_ROLES,
  PERSON_TYPE_LABELS,
  PERSON_TYPES,
  REPORT_STATUS_LABELS,
  REPORT_STATUSES,
  seasonForDate,
  summaryCardTotals,
  todayIso,
  type CardEntryMode,
  type CardType,
  type MatchInput,
  type MatchStatus,
  type MatchType,
  type OfficialRole,
  type PersonType,
  type ReportStatus,
} from '@refstats/shared';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { ErrorBox, Field, Input, LoadingBlock, PageHeader, Select, Spinner, Textarea } from '../components/ui';
import { api, ApiError, errorMessage } from '../lib/api';
import { fmtDate } from '../lib/format';
import { useCategories, useInvalidateMatchData, useSuggestions } from '../lib/queries';
import type { Match } from '../lib/types';
import { apiErrors, zodErrors, type FieldErrors } from '../lib/useForm';

// ---------------------------------------------------------------- Form durumu

interface CardRow {
  key: string;
  type: CardType;
  personType: PersonType;
  personName: string;
  shirtNumber: string;
  team: '' | 'HOME' | 'AWAY';
  minute: string;
  addedMinute: string;
  description: string;
}

const NOTE_FIELDS = [
  ['generalAssessment', 'Maçın genel değerlendirmesi'],
  ['selfAssessment', 'Kendi performansıma dair not'],
  ['difficultSituations', 'Zorlandığım pozisyonlar'],
  ['improvementAreas', 'Geliştirmek istediğim konular'],
  ['observerEvaluation', 'Gözlemci değerlendirmesi'],
  ['reportNotes', 'Maç raporu için notlar'],
  ['substitutionNotes', 'Oyuncu değişiklikleri'],
  ['injuryNotes', 'Sakatlıklar / oyunun durduğu anlar'],
  ['disciplineNotes', 'Disiplin olayları'],
] as const;
type NoteKey = (typeof NOTE_FIELDS)[number][0];

interface FormState {
  date: string;
  kickoffTime: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: string;
  awayScore: string;
  halfTimeHome: string;
  halfTimeAway: string;
  competition: string;
  categoryId: string;
  season: string;
  round: string;
  venue: string;
  city: string;
  district: string;
  matchType: MatchType;
  status: MatchStatus;
  role: OfficialRole | '';
  additionalDuties: string;
  firstHalfAdded: string;
  secondHalfAdded: string;
  wentToExtraTime: boolean;
  penaltiesHome: string;
  penaltiesAway: string;
  reportStatus: ReportStatus;
  cardEntryMode: CardEntryMode;
  summaryYellow: string;
  summarySecondYellow: string;
  summaryDirectRed: string;
  cards: CardRow[];
  notes: Record<NoteKey, string>;
  observerScore: string;
}

const emptyNotes = Object.fromEntries(NOTE_FIELDS.map(([k]) => [k, ''])) as Record<NoteKey, string>;

function emptyForm(): FormState {
  return {
    date: todayIso(),
    kickoffTime: '',
    homeTeam: '',
    awayTeam: '',
    homeScore: '',
    awayScore: '',
    halfTimeHome: '',
    halfTimeAway: '',
    competition: '',
    categoryId: '',
    season: '',
    round: '',
    venue: '',
    city: '',
    district: '',
    matchType: 'LEAGUE',
    status: 'COMPLETED',
    role: '',
    additionalDuties: '',
    firstHalfAdded: '',
    secondHalfAdded: '',
    wentToExtraTime: false,
    penaltiesHome: '',
    penaltiesAway: '',
    reportStatus: 'NOT_STARTED',
    cardEntryMode: 'DETAILED',
    summaryYellow: '0',
    summarySecondYellow: '0',
    summaryDirectRed: '0',
    cards: [],
    notes: { ...emptyNotes },
    observerScore: '',
  };
}

const s = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));
const n = (v: string): number | null => (v.trim() === '' ? null : Number(v.replace(',', '.')));
let rowSeq = 0;
const rowKey = () => `r${++rowSeq}`;

function fromMatch(m: Match): FormState {
  return {
    date: m.date,
    kickoffTime: m.kickoffTime ?? '',
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeScore: s(m.homeScore),
    awayScore: s(m.awayScore),
    halfTimeHome: s(m.halfTimeHome),
    halfTimeAway: s(m.halfTimeAway),
    competition: m.competition ?? '',
    categoryId: m.category.id,
    season: m.season ?? '',
    round: m.round ?? '',
    venue: m.venue ?? '',
    city: m.city ?? '',
    district: m.district ?? '',
    matchType: m.matchType,
    status: m.status,
    role: m.role,
    additionalDuties: m.additionalDuties ?? '',
    firstHalfAdded: s(m.firstHalfAdded),
    secondHalfAdded: s(m.secondHalfAdded),
    wentToExtraTime: m.wentToExtraTime,
    penaltiesHome: s(m.penaltiesHome),
    penaltiesAway: s(m.penaltiesAway),
    reportStatus: m.reportStatus,
    cardEntryMode: m.cardEntryMode,
    summaryYellow: String(m.yellowCards),
    summarySecondYellow: String(m.secondYellowReds),
    summaryDirectRed: String(m.directReds),
    cards: m.cards.map((c) => ({
      key: rowKey(),
      type: c.type,
      personType: c.personType,
      personName: c.personName ?? '',
      shirtNumber: s(c.shirtNumber),
      team: c.team ?? '',
      minute: s(c.minute),
      addedMinute: s(c.addedMinute),
      description: c.description ?? '',
    })),
    notes: Object.fromEntries(NOTE_FIELDS.map(([k]) => [k, m.notes?.[k] ?? ''])) as Record<NoteKey, string>,
    observerScore: s(m.notes?.observerScore),
  };
}

function toPayload(f: FormState, allowDuplicate = false): MatchInput {
  const detailed = f.cardEntryMode === 'DETAILED';
  return {
    date: f.date,
    kickoffTime: f.kickoffTime || null,
    homeTeam: f.homeTeam,
    awayTeam: f.awayTeam,
    homeScore: n(f.homeScore),
    awayScore: n(f.awayScore),
    halfTimeHome: n(f.halfTimeHome),
    halfTimeAway: n(f.halfTimeAway),
    competition: f.competition || null,
    categoryId: f.categoryId,
    season: f.season || null,
    round: f.round || null,
    venue: f.venue || null,
    city: f.city || null,
    district: f.district || null,
    matchType: f.matchType,
    status: f.status,
    role: f.role as OfficialRole,
    additionalDuties: f.additionalDuties || null,
    firstHalfAdded: n(f.firstHalfAdded),
    secondHalfAdded: n(f.secondHalfAdded),
    wentToExtraTime: f.wentToExtraTime,
    penaltiesHome: n(f.penaltiesHome),
    penaltiesAway: n(f.penaltiesAway),
    reportStatus: f.reportStatus,
    cardEntryMode: f.cardEntryMode,
    summaryCards: detailed
      ? null
      : {
          yellowCards: n(f.summaryYellow) ?? 0,
          secondYellowReds: n(f.summarySecondYellow) ?? 0,
          directReds: n(f.summaryDirectRed) ?? 0,
        },
    cards: detailed
      ? f.cards.map((c) => ({
          type: c.type,
          personType: c.personType,
          personName: c.personName || null,
          shirtNumber: n(c.shirtNumber),
          team: c.team || null,
          minute: n(c.minute),
          addedMinute: n(c.addedMinute),
          description: c.description || null,
        }))
      : [],
    notes: { ...Object.fromEntries(NOTE_FIELDS.map(([k]) => [k, f.notes[k] || null])), observerScore: n(f.observerScore) },
    allowDuplicate,
  };
}

/** Kaydetmeyi engellemeyen ama dikkat edilmesi gereken veri uyarıları. */
function warningsFor(f: FormState): string[] {
  const w: string[] = [];
  const today = todayIso();
  if (f.status === 'COMPLETED' && (f.homeScore === '' || f.awayScore === '')) w.push('Tamamlanan maç için skor girilmedi.');
  if (f.status === 'SCHEDULED' && f.date < today) w.push('Tarihi geçmiş bir maç "Planlandı" durumunda. Maç oynandıysa durumu "Tamamlandı" yapın.');
  if (f.cardEntryMode === 'DETAILED') {
    const missingMinute = f.cards.filter((c) => c.minute === '').length;
    if (missingMinute) w.push(`${missingMinute} kart olayında dakika bilgisi yok.`);
    const noTeam = f.cards.filter((c) => !c.team).length;
    if (noTeam) w.push(`${noTeam} kart olayında takım seçilmedi.`);
  }
  if (f.season && f.date && f.season !== seasonForDate(f.date)) w.push(`Seçilen sezon (${f.season}) maç tarihiyle uyuşmuyor; tarih ${seasonForDate(f.date)} sezonuna denk geliyor.`);
  return w;
}

// ---------------------------------------------------------------- Taslak (internet kesintisine karşı)

const DRAFT_KEY = 'rs.matchDraft.new';
function loadDraft(): { savedAt: string; form: FormState } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveDraft(form: FormState) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), form }));
  } catch {
    /* depolama kapalı/doluysa taslak tutulamaz */
  }
}
function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* yoksay */
  }
}

// ---------------------------------------------------------------- Bileşenler

function Section({ title, subtitle, children, aside }: { title: string; subtitle?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="panel panel-pad">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function NumberInput(props: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean; min?: number; max?: number; placeholder?: string; describedBy?: string; step?: string }) {
  return (
    <Input
      id={props.id}
      type="number"
      inputMode={props.step ? 'decimal' : 'numeric'}
      min={props.min ?? 0}
      max={props.max}
      step={props.step}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      invalid={props.invalid}
      aria-describedby={props.describedBy}
      className="tabular-nums"
    />
  );
}

const cardTypeStyle: Record<CardType, string> = {
  YELLOW: 'border-l-card-yellow',
  SECOND_YELLOW: 'border-l-orange-400',
  DIRECT_RED: 'border-l-card-red',
};

// ---------------------------------------------------------------- Sayfa

export default function MatchFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const existing = useQuery({
    queryKey: ['match', id],
    queryFn: () => api.get<{ match: Match }>(`/matches/${id}`).then((r) => r.match),
    enabled: isEdit,
  });

  if (isEdit && existing.isLoading) return <LoadingBlock />;
  if (isEdit && existing.isError) return <ErrorBox message={errorMessage(existing.error)} onRetry={() => existing.refetch()} />;
  return <MatchFormInner key={id ?? 'new'} match={existing.data ?? null} />;
}

function MatchFormInner({ match }: { match: Match | null }) {
  const isEdit = Boolean(match);
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const invalidate = useInvalidateMatchData();
  const categories = useCategories();
  const suggestions = useSuggestions();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<FormState>(() => {
    if (match) return fromMatch(match);
    const base = emptyForm();
    const date = searchParams.get('date');
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { ...base, date, status: date > todayIso() ? 'SCHEDULED' : 'COMPLETED' };
    }
    return base;
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(() => Boolean(match && (match.notes || match.halfTimeHome !== null || match.firstHalfAdded !== null || match.penaltiesHome !== null)));
  const [draft, setDraft] = useState(() => (match ? null : loadDraft()));
  const [duplicate, setDuplicate] = useState<string[] | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const dirty = useRef(false);
  const defaultsApplied = useRef(isEdit);

  // Akıllı varsayılanlar: ayarlardaki veya en sık kullanılan kategori/görev.
  useEffect(() => {
    if (defaultsApplied.current || !categories.data || !suggestions.data) return;
    defaultsApplied.current = true;
    const st = user?.settings;
    setForm((f) => ({
      ...f,
      categoryId: f.categoryId || st?.defaultCategoryId || suggestions.data.topCategoryIds[0] || '',
      role: f.role || st?.defaultRole || suggestions.data.topRoles[0] || '',
      competition: f.competition || st?.defaultCompetition || '',
    }));
  }, [categories.data, suggestions.data, user]);

  // Taslağı otomatik kaydet (yalnızca yeni maçta).
  useEffect(() => {
    if (isEdit || !dirty.current) return;
    const t = setTimeout(() => saveDraft(form), 600);
    return () => clearTimeout(t);
  }, [form, isEdit]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Kaydedilmemiş değişiklikle sayfadan çıkarken uyar.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    dirty.current = true;
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) setErrors(({ [key as string]: _drop, ...rest }) => rest);
  };
  const setNote = (key: NoteKey, value: string) => {
    dirty.current = true;
    setForm((f) => ({ ...f, notes: { ...f.notes, [key]: value } }));
  };
  const setCard = (key: string, patch: Partial<CardRow>) => {
    dirty.current = true;
    setForm((f) => ({ ...f, cards: f.cards.map((c) => (c.key === key ? { ...c, ...patch } : c)) }));
    setErrors(({ cards: _drop, ...rest }) => rest);
  };
  const addCard = (type: CardType) => {
    dirty.current = true;
    setForm((f) => {
      const last = f.cards[f.cards.length - 1];
      return {
        ...f,
        cards: [
          ...f.cards,
          {
            key: rowKey(),
            type,
            personType: 'PLAYER',
            personName: '',
            shirtNumber: '',
            team: last?.team ?? '',
            minute: '',
            addedMinute: '',
            description: '',
          },
        ],
      };
    });
  };
  const removeCard = (key: string) => {
    dirty.current = true;
    setForm((f) => ({ ...f, cards: f.cards.filter((c) => c.key !== key) }));
  };

  const copyFromLatest = async () => {
    try {
      const { match: last } = await api.get<{ match: Match | null }>('/matches/latest');
      if (!last) return toast.info('Kopyalanacak önceki maç yok');
      dirty.current = true;
      setForm((f) => ({
        ...f,
        competition: last.competition ?? '',
        categoryId: last.category.id,
        round: '',
        venue: last.venue ?? '',
        city: last.city ?? '',
        district: last.district ?? '',
        matchType: last.matchType,
        role: last.role,
        kickoffTime: last.kickoffTime ?? '',
        cardEntryMode: last.cardEntryMode,
      }));
      toast.success(`Bilgiler kopyalandı: ${last.homeTeam} – ${last.awayTeam} (${fmtDate(last.date)})`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const pickVenue = (name: string) => {
    set('venue', name);
    const v = suggestions.data?.venues.find((x) => x.name.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'));
    if (v) {
      setForm((f) => ({ ...f, venue: v.name, city: f.city || v.city || '', district: f.district || v.district || '' }));
    }
  };

  const totals = useMemo(() => {
    if (form.cardEntryMode === 'DETAILED') return computeCardTotals(form.cards);
    return summaryCardTotals({
      yellowCards: n(form.summaryYellow) ?? 0,
      secondYellowReds: n(form.summarySecondYellow) ?? 0,
      directReds: n(form.summaryDirectRed) ?? 0,
    });
  }, [form.cardEntryMode, form.cards, form.summaryYellow, form.summarySecondYellow, form.summaryDirectRed]);

  const warnings = warningsFor(form);

  const save = useMutation({
    mutationFn: (payload: MatchInput) =>
      isEdit ? api.put<{ match: Match }>(`/matches/${match!.id}`, payload) : api.post<{ match: Match }>('/matches', payload),
    onSuccess: async ({ match: saved }) => {
      dirty.current = false;
      if (!isEdit) clearDraft();
      await invalidate();
      toast.success(isEdit ? 'Maç güncellendi' : 'Maç kaydedildi. İstatistiklerin güncellendi.');
      navigate(`/app/matches/${saved.id}`);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'DUPLICATE') {
        setDuplicate(e.details?.matchIds ?? []);
        return;
      }
      if (e instanceof ApiError && e.code === 'NETWORK') {
        if (!isEdit) saveDraft(form);
        setFormError('Sunucuya ulaşılamadı. Form taslak olarak bu cihazda saklandı; bağlantı gelince tekrar kaydedin.');
        return;
      }
      const { fields, message } = apiErrors(e);
      setErrors(fields);
      setFormError(message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  });

  const submit = (e?: FormEvent, allowDuplicate = false) => {
    e?.preventDefault();
    setFormError(null);
    const payload = toPayload(form, allowDuplicate);
    const v = zodErrors(matchSchema, payload);
    if (v) {
      setErrors(v);
      setFormError('Lütfen işaretli alanları kontrol edin.');
      if (Object.keys(v).some((k) => k.startsWith('notes') || ['halfTimeHome', 'halfTimeAway', 'penaltiesAway', 'firstHalfAdded', 'secondHalfAdded'].includes(k))) {
        setDetailsOpen(true);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!navigator.onLine) {
      if (!isEdit) saveDraft(form);
      setFormError('İnternet bağlantısı yok. Form taslak olarak saklandı; bağlantı gelince "Kaydet"e tekrar basın.');
      return;
    }
    save.mutate(payload);
  };

  // Klavye: Ctrl/Cmd + Enter ile kaydet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const err = (k: string) => errors[k];
  const teamNames = suggestions.data?.teams ?? [];
  const favTeams = teamNames.filter((t) => t.isFavorite).slice(0, 8);
  const favVenues = (suggestions.data?.venues ?? []).filter((v) => v.isFavorite).slice(0, 6);
  const homeLabel = form.homeTeam || 'Ev sahibi';
  const awayLabel = form.awayTeam || 'Deplasman';

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-5xl">
      <PageHeader
        title={isEdit ? 'Maçı düzenle' : 'Yeni maç'}
        subtitle={isEdit ? `${match!.homeTeam} – ${match!.awayTeam}` : 'Zorunlu alanlar: tarih, takımlar, kategori ve görev. Gerisi isteğe bağlı.'}
        actions={
          !isEdit && (
            <button type="button" className="btn-secondary" onClick={copyFromLatest}>
              <Copy className="h-4 w-4" /> Önceki maçtan kopyala
            </button>
          )
        }
      />

      {!online && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="status">
          <WifiOff className="h-4 w-4" /> Çevrimdışısınız. Yazdıklarınız bu cihazda taslak olarak korunuyor.
        </div>
      )}

      {draft && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          <History className="h-4 w-4" />
          <span className="flex-1">Kaydedilmemiş bir taslak bulundu ({new Date(draft.savedAt).toLocaleString('tr-TR')}).</span>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => {
              setForm({ ...emptyForm(), ...draft.form, cards: draft.form.cards.map((c) => ({ ...c, key: rowKey() })) });
              defaultsApplied.current = true;
              dirty.current = true;
              setDraft(null);
            }}
          >
            Geri yükle
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              clearDraft();
              setDraft(null);
            }}
          >
            Sil
          </button>
        </div>
      )}

      {formError && (
        <div role="alert" className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {formError}
          {Object.keys(errors).length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-red-300/90">
              {Object.entries(errors)
                .slice(0, 6)
                .map(([k, v]) => (
                  <li key={k}>{v}</li>
                ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-5">
        <Section title="Temel bilgiler">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label="Maç tarihi" error={err('date')}>
              {(fid, d) => <Input id={fid} type="date" value={form.date} onChange={(e) => {
                    const v = e.target.value;
                    set('date', v);
                    // Gelecek tarih seçilirse durum otomatik "Planlandı" olur.
                    if (v > todayIso() && form.status === 'COMPLETED') set('status', 'SCHEDULED');
                  }} invalid={!!err('date')} aria-describedby={d} required />}
            </Field>
            <Field label="Başlama saati" optional error={err('kickoffTime')}>
              {(fid) => <Input id={fid} type="time" value={form.kickoffTime} onChange={(e) => set('kickoffTime', e.target.value)} />}
            </Field>
            <Field label="Durum" error={err('status')}>
              {(fid, d) => (
                <Select id={fid} value={form.status} onChange={(e) => set('status', e.target.value as MatchStatus)} invalid={!!err('status')} aria-describedby={d}>
                  {MATCH_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {MATCH_STATUS_LABELS[st]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Maç türü">
              {(fid) => (
                <Select id={fid} value={form.matchType} onChange={(e) => set('matchType', e.target.value as MatchType)}>
                  {MATCH_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {MATCH_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <datalist id="teams-dl">
            {teamNames.map((t) => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-start">
            <Field label="Ev sahibi takım" error={err('homeTeam')}>
              {(fid, d) => (
                <Input id={fid} list="teams-dl" autoComplete="off" value={form.homeTeam} onChange={(e) => set('homeTeam', e.target.value)} invalid={!!err('homeTeam')} aria-describedby={d} placeholder="Takım adı" />
              )}
            </Field>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 md:pt-0">
              <Field label="Skor" error={err('homeScore')}>
                {(fid, d) => <NumberInput id={fid} value={form.homeScore} onChange={(v) => set('homeScore', v)} max={99} invalid={!!err('homeScore')} describedBy={d} placeholder="–" />}
              </Field>
              <span className="pb-2.5 text-slate-500">:</span>
              <Field label={' '} error={err('awayScore')}>
                {(fid, d) => <NumberInput id={fid} value={form.awayScore} onChange={(v) => set('awayScore', v)} max={99} invalid={!!err('awayScore')} describedBy={d} placeholder="–" />}
              </Field>
            </div>
            <Field label="Deplasman takımı" error={err('awayTeam')}>
              {(fid, d) => (
                <Input id={fid} list="teams-dl" autoComplete="off" value={form.awayTeam} onChange={(e) => set('awayTeam', e.target.value)} invalid={!!err('awayTeam')} aria-describedby={d} placeholder="Takım adı" />
              )}
            </Field>
          </div>
          {favTeams.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-slate-500">
                <Star className="h-3 w-3" /> Favoriler:
              </span>
              {favTeams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="chip border-white/10 text-slate-300 hover:border-pitch-400/40 hover:text-white"
                  onClick={() => (!form.homeTeam ? set('homeTeam', t.name) : set('awayTeam', t.name))}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label="Kategori" error={err('categoryId')}>
              {(fid, d) => (
                <Select id={fid} value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} invalid={!!err('categoryId')} aria-describedby={d}>
                  <option value="">Seçin…</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.custom ? ' (özel)' : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Organizasyon / lig" optional>
              {(fid) => (
                <>
                  <Input id={fid} list="comp-dl" value={form.competition} onChange={(e) => set('competition', e.target.value)} placeholder="ör. İstanbul 1. Amatör Lig" />
                  <datalist id="comp-dl">
                    {suggestions.data?.competitions.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
            <Field label="Sezon" optional error={err('season')} hint={form.date ? `Boş bırakılırsa: ${seasonForDate(form.date)}` : undefined}>
              {(fid, d) => <Input id={fid} value={form.season} onChange={(e) => set('season', e.target.value)} placeholder={form.date ? seasonForDate(form.date) : '2025-2026'} invalid={!!err('season')} aria-describedby={d} />}
            </Field>
            <Field label="Hafta / tur" optional>
              {(fid) => <Input id={fid} value={form.round} onChange={(e) => set('round', e.target.value)} placeholder="ör. 12. Hafta" />}
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
            <Field label="Saha / stadyum" optional className="col-span-2 md:col-span-1">
              {(fid) => (
                <>
                  <Input id={fid} list="venue-dl" value={form.venue} onChange={(e) => pickVenue(e.target.value)} placeholder="Saha adı" />
                  <datalist id="venue-dl">
                    {suggestions.data?.venues.map((v) => (
                      <option key={v.id} value={v.name} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
            <Field label="İl" optional>
              {(fid) => <Input id={fid} value={form.city} onChange={(e) => set('city', e.target.value)} />}
            </Field>
            <Field label="İlçe" optional>
              {(fid) => <Input id={fid} value={form.district} onChange={(e) => set('district', e.target.value)} />}
            </Field>
          </div>
          {favVenues.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-slate-500">
                <Star className="h-3 w-3" /> Favori sahalar:
              </span>
              {favVenues.map((v) => (
                <button key={v.id} type="button" className="chip border-white/10 text-slate-300 hover:border-pitch-400/40 hover:text-white" onClick={() => pickVenue(v.name)}>
                  {v.name}
                </button>
              ))}
            </div>
          )}
        </Section>

        <Section title="Hakemlik görevim" subtitle="Her maç için tek bir ana görev seçilir.">
          <div role="radiogroup" aria-label="Ana görev" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {OFFICIAL_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={form.role === r}
                onClick={() => set('role', r)}
                className={clsx(
                  'rounded-xl border px-3 py-3 text-sm font-medium transition',
                  form.role === r ? 'border-pitch-400/60 bg-pitch-500/15 text-pitch-200 shadow-glow' : 'border-white/10 bg-ink-850 text-slate-300 hover:border-white/20',
                )}
              >
                {OFFICIAL_ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          {err('role') && <p className="mt-2 text-xs text-red-400">{err('role')}</p>}
          <Field label="Ek görevler" optional className="mt-4" hint="Ana görev dışında üstlendiğiniz görevler (ör. ikinci yarıda yardımcı hakemliğe geçiş).">
            {(fid, d) => <Input id={fid} value={form.additionalDuties} onChange={(e) => set('additionalDuties', e.target.value)} aria-describedby={d} />}
          </Field>
        </Section>

        <Section
          title="Kartlar ve disiplin"
          subtitle="İkinci sarıdan ihraç: kişinin ilk sarısını “Sarı kart”, ikincisini “İkinci sarıdan kırmızı” olarak ekleyin."
          aside={
            <div className="flex rounded-xl border border-white/10 p-0.5 text-xs" role="radiogroup" aria-label="Kart kayıt yöntemi">
              {(['DETAILED', 'SUMMARY'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={form.cardEntryMode === m}
                  className={clsx('rounded-lg px-3 py-1.5 font-medium', form.cardEntryMode === m ? 'bg-white/10 text-white' : 'text-slate-400')}
                  onClick={() => set('cardEntryMode', m)}
                >
                  {m === 'DETAILED' ? 'Olay bazlı' : 'Yalnızca özet'}
                </button>
              ))}
            </div>
          }
        >
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-white/[0.06] bg-ink-850/60 p-3 text-sm sm:grid-cols-4" aria-live="polite">
            <p>
              <span className="text-slate-400">Sarı (toplam): </span>
              <strong className="tabular-nums text-yellow-300">{totals.yellowCards}</strong>
            </p>
            <p>
              <span className="text-slate-400">İkinci sarıdan kırmızı: </span>
              <strong className="tabular-nums text-orange-300">{totals.secondYellowReds}</strong>
            </p>
            <p>
              <span className="text-slate-400">Doğrudan kırmızı: </span>
              <strong className="tabular-nums text-red-300">{totals.directReds}</strong>
            </p>
            <p>
              <span className="text-slate-400">Kırmızı (toplam): </span>
              <strong className="tabular-nums text-red-300">{totals.redCards}</strong>
            </p>
          </div>

          {form.cardEntryMode === 'SUMMARY' ? (
            <div>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Toplam sarı kart" error={err('summaryCards.yellowCards') ?? err('summaryCards')} hint="İkinci sarılar dahil">
                  {(fid, d) => <NumberInput id={fid} value={form.summaryYellow} onChange={(v) => set('summaryYellow', v)} max={40} invalid={!!err('summaryCards.yellowCards')} describedBy={d} />}
                </Field>
                <Field label="İkinci sarıdan kırmızı">
                  {(fid) => <NumberInput id={fid} value={form.summarySecondYellow} onChange={(v) => set('summarySecondYellow', v)} max={20} />}
                </Field>
                <Field label="Doğrudan kırmızı">
                  {(fid) => <NumberInput id={fid} value={form.summaryDirectRed} onChange={(v) => set('summaryDirectRed', v)} max={20} />}
                </Field>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Özet modunda kartların kime ve hangi dakikada gösterildiği kaydedilmez. Bu maç istatistiklerde “özet giriş” olarak işaretlenir.
              </p>
            </div>
          ) : (
            <div>
              {err('cards') && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{err('cards')}</p>}
              {form.cards.length === 0 && <p className="mb-3 text-sm text-slate-500">Bu maçta kart olayı yok. Kart gösterildiyse aşağıdan ekleyin.</p>}
              <ol className="space-y-3">
                {form.cards.map((c, i) => (
                  <li key={c.key} className={clsx('rounded-xl border border-white/[0.06] border-l-4 bg-ink-850/70 p-3', cardTypeStyle[c.type])}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400">Olay {i + 1}</span>
                      <button type="button" className="btn-ghost btn-sm hover:text-red-300" onClick={() => removeCard(c.key)} aria-label={`Olay ${i + 1} sil`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                      <label className="col-span-2">
                        <span className="label">Kart türü</span>
                        <Select value={c.type} onChange={(e) => setCard(c.key, { type: e.target.value as CardType })}>
                          {CARD_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {CARD_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className="col-span-2">
                        <span className="label">Kişi türü</span>
                        <Select value={c.personType} onChange={(e) => setCard(c.key, { personType: e.target.value as PersonType })}>
                          {PERSON_TYPES.map((p) => (
                            <option key={p} value={p}>
                              {PERSON_TYPE_LABELS[p]}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className="col-span-2">
                        <span className="label">Takım</span>
                        <Select value={c.team} onChange={(e) => setCard(c.key, { team: e.target.value as CardRow['team'] })}>
                          <option value="">Seçin…</option>
                          <option value="HOME">{homeLabel}</option>
                          <option value="AWAY">{awayLabel}</option>
                        </Select>
                      </label>
                      <label className="col-span-2">
                        <span className="label">Ad soyad (isteğe bağlı)</span>
                        <Input value={c.personName} onChange={(e) => setCard(c.key, { personName: e.target.value })} />
                      </label>
                      <label>
                        <span className="label">Forma no</span>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={99}
                          value={c.shirtNumber}
                          disabled={c.personType !== 'PLAYER' && c.personType !== 'SUBSTITUTE'}
                          onChange={(e) => setCard(c.key, { shirtNumber: e.target.value })}
                        />
                      </label>
                      <label>
                        <span className="label">Dakika</span>
                        <Input type="number" inputMode="numeric" min={0} max={130} value={c.minute} onChange={(e) => setCard(c.key, { minute: e.target.value })} />
                      </label>
                      <label>
                        <span className="label">+ Ek süre</span>
                        <Input type="number" inputMode="numeric" min={0} max={30} value={c.addedMinute} onChange={(e) => setCard(c.key, { addedMinute: e.target.value })} />
                      </label>
                      <label className="col-span-2 md:col-span-5">
                        <span className="label">Açıklama (isteğe bağlı)</span>
                        <Input value={c.description} onChange={(e) => setCard(c.key, { description: e.target.value })} placeholder="ör. Sportmenliğe aykırı hareket" />
                      </label>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-secondary btn-sm" onClick={() => addCard('YELLOW')}>
                  <span className="card-yellow" aria-hidden /> Sarı kart ekle
                </button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => addCard('SECOND_YELLOW')}>
                  <span className="card-yellow" aria-hidden />
                  <span className="card-red -ml-1" aria-hidden /> İkinci sarı ekle
                </button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => addCard('DIRECT_RED')}>
                  <span className="card-red" aria-hidden /> Kırmızı kart ekle
                </button>
              </div>
            </div>
          )}
        </Section>

        <section className="panel">
          <button
            type="button"
            className="flex w-full items-center justify-between px-5 py-4 text-left"
            onClick={() => setDetailsOpen((o) => !o)}
            aria-expanded={detailsOpen}
          >
            <span>
              <span className="block text-base font-semibold text-white">Ayrıntılar ve kişisel notlar</span>
              <span className="text-xs text-slate-400">Devre skoru, uzatmalar, penaltılar, rapor durumu, gözlemci ve gelişim notları — tamamı isteğe bağlı ve size özel.</span>
            </span>
            <ChevronDown className={clsx('h-5 w-5 shrink-0 text-slate-400 transition', detailsOpen && 'rotate-180')} />
          </button>
          {detailsOpen && (
            <div className="space-y-5 border-t border-white/[0.06] px-5 pb-5 pt-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Field label="Devre (ev)" error={err('halfTimeHome')}>
                  {(fid, d) => <NumberInput id={fid} value={form.halfTimeHome} onChange={(v) => set('halfTimeHome', v)} invalid={!!err('halfTimeHome')} describedBy={d} />}
                </Field>
                <Field label="Devre (dep.)" error={err('halfTimeAway')}>
                  {(fid, d) => <NumberInput id={fid} value={form.halfTimeAway} onChange={(v) => set('halfTimeAway', v)} invalid={!!err('halfTimeAway')} describedBy={d} />}
                </Field>
                <Field label="1. yarı uzatma (dk)">
                  {(fid) => <NumberInput id={fid} value={form.firstHalfAdded} onChange={(v) => set('firstHalfAdded', v)} max={30} />}
                </Field>
                <Field label="2. yarı uzatma (dk)">
                  {(fid) => <NumberInput id={fid} value={form.secondHalfAdded} onChange={(v) => set('secondHalfAdded', v)} max={30} />}
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <label className="col-span-2 flex items-center gap-3 rounded-xl border border-white/10 bg-ink-850 px-3 py-2.5 text-sm text-slate-200">
                  <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={form.wentToExtraTime} onChange={(e) => set('wentToExtraTime', e.target.checked)} />
                  Maç uzatmalara gitti
                </label>
                <Field label="Penaltı (ev)" error={err('penaltiesHome')}>
                  {(fid) => <NumberInput id={fid} value={form.penaltiesHome} onChange={(v) => set('penaltiesHome', v)} max={50} />}
                </Field>
                <Field label="Penaltı (dep.)" error={err('penaltiesAway')}>
                  {(fid, d) => <NumberInput id={fid} value={form.penaltiesAway} onChange={(v) => set('penaltiesAway', v)} max={50} invalid={!!err('penaltiesAway')} describedBy={d} />}
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Rapor durumu">
                  {(fid) => (
                    <Select id={fid} value={form.reportStatus} onChange={(e) => set('reportStatus', e.target.value as ReportStatus)}>
                      {REPORT_STATUSES.map((r) => (
                        <option key={r} value={r}>
                          {REPORT_STATUS_LABELS[r]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Gözlemci puanı (0-10)" optional error={err('notes.observerScore')}>
                  {(fid, d) => <NumberInput id={fid} value={form.observerScore} onChange={(v) => set('observerScore', v)} max={10} step="0.1" invalid={!!err('notes.observerScore')} describedBy={d} />}
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {NOTE_FIELDS.map(([k, label]) => (
                  <Field key={k} label={label} optional error={err(`notes.${k}`)}>
                    {(fid) => <Textarea id={fid} value={form.notes[k]} onChange={(e) => setNote(k, e.target.value)} rows={3} />}
                  </Field>
                ))}
              </div>
              <p className="text-xs text-slate-500">Notlarınız yalnızca size görünür; herkese açık profilde veya dışa aktarılan paylaşımlarda yer almaz.</p>
            </div>
          )}
        </section>

        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-100">
            <p className="mb-1 flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-300" /> Kontrol etmek isteyebilirsiniz
            </p>
            <ul className="list-inside list-disc space-y-0.5 text-amber-200/90">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="no-print sticky bottom-[72px] z-20 mt-6 flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-ink-900/95 px-4 py-3 backdrop-blur lg:bottom-4">
        <p className="hidden text-xs text-slate-500 sm:block">
          {isEdit ? 'Değişiklikler istatistiklere anında yansır.' : 'Taslak otomatik olarak bu cihazda saklanır.'} · <kbd className="rounded bg-white/10 px-1">Ctrl</kbd>+<kbd className="rounded bg-white/10 px-1">Enter</kbd> ile kaydet
        </p>
        <div className="flex w-full gap-2 sm:w-auto">
          <Link to={isEdit ? `/app/matches/${match!.id}` : '/app/matches'} className="btn-secondary flex-1 sm:flex-none" onClick={() => (dirty.current = false)}>
            Vazgeç
          </Link>
          <button className="btn-primary flex-1 sm:flex-none" disabled={save.isPending}>
            {save.isPending ? <Spinner /> : isEdit ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isEdit ? 'Değişiklikleri kaydet' : 'Maçı kaydet'}
          </button>
        </div>
      </div>

      <Modal
        open={duplicate !== null}
        onClose={() => setDuplicate(null)}
        title="Bu maç zaten kayıtlı olabilir"
        size="sm"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDuplicate(null)}>
              Vazgeç
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setDuplicate(null);
                submit(undefined, true);
              }}
            >
              Yine de kaydet
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          {fmtDate(form.date)} tarihinde <strong className="text-white">{form.homeTeam} – {form.awayTeam}</strong> maçı için zaten bir kaydınız var.
          Aynı maçı iki kez kaydetmek istatistiklerinizi bozabilir.
        </p>
        {duplicate?.[0] && (
          <Link to={`/app/matches/${duplicate[0]}`} className="mt-3 inline-block text-sm text-pitch-300 hover:underline" target="_blank">
            Mevcut kaydı yeni sekmede aç
          </Link>
        )}
      </Modal>
    </form>
  );
}
