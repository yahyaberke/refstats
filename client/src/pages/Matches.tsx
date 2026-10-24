import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowDown,
  ArrowUp,
  Download,
  Eye,
  Filter,
  LayoutGrid,
  ListOrdered,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  MATCH_STATUS_LABELS,
  MATCH_STATUSES,
  OFFICIAL_ROLE_LABELS,
  OFFICIAL_ROLES,
  REPORT_STATUS_LABELS,
  REPORT_STATUSES,
} from '@refstats/shared';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/Modal';
import { useToast } from '../components/Toast';
import {
  CardCounts,
  EmptyState,
  ErrorBox,
  Input,
  LoadingBlock,
  PageHeader,
  Pagination,
  ReportBadge,
  RoleBadge,
  Select,
  StatusBadge,
} from '../components/ui';
import { api, errorMessage, qs } from '../lib/api';
import { fmtDate, score } from '../lib/format';
import { useCategories, useInvalidateMatchData, useSuggestions } from '../lib/queries';
import type { Match, Paged } from '../lib/types';

const FILTER_KEYS = ['q', 'from', 'to', 'season', 'categoryId', 'role', 'competition', 'team', 'city', 'status', 'reportStatus', 'minCards', 'maxCards'] as const;

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function readView(): 'table' | 'cards' {
  try {
    return localStorage.getItem('rs.matchView') === 'cards' ? 'cards' : 'table';
  } catch {
    return 'table';
  }
}

export default function Matches() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const invalidate = useInvalidateMatchData();
  const categories = useCategories();
  const suggestions = useSuggestions();
  const [showFilters, setShowFilters] = useState(() => FILTER_KEYS.some((k) => k !== 'q' && params.get(k)));
  const [view, setView] = useState(readView);
  const [toDelete, setToDelete] = useState<Match | null>(null);
  const [search, setSearch] = useState(params.get('q') ?? '');
  const debounced = useDebounced(search);

  const filters = useMemo(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ''])), [params]);
  const page = Number(params.get('page') ?? '1') || 1;
  const sort = params.get('sort') ?? 'date';
  const dir = params.get('dir') ?? 'desc';
  const activeCount = FILTER_KEYS.filter((k) => k !== 'q' && filters[k]).length;

  const update = (patch: Record<string, string>, resetPage = true) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (resetPage) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if ((params.get('q') ?? '') !== debounced) update({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    try {
      localStorage.setItem('rs.matchView', view);
    } catch {
      /* yoksay */
    }
  }, [view]);

  const query = qs({ ...filters, page, sort, dir, pageSize: 20 });
  const list = useQuery({
    queryKey: ['matches', query],
    queryFn: () => api.get<Paged<Match>>(`/matches${query}`),
    placeholderData: keepPreviousData,
  });

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/matches/${id}`),
    onSuccess: async () => {
      toast.success('Maç silindi');
      setToDelete(null);
      await invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const sortBy = (key: string) => update({ sort: key, dir: sort === key && dir === 'desc' ? 'asc' : 'desc' }, false);
  const SortIcon = ({ k }: { k: string }) => (sort === k ? dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : null);

  const exportCsv = () => {
    window.location.href = `/api/matches/export.csv${qs(filters)}`;
  };

  const data = list.data;
  const hasAnyFilter = FILTER_KEYS.some((k) => filters[k]);

  return (
    <div className="print-area">
      <PageHeader
        title="Maçlarım"
        subtitle={data ? `${data.total} kayıt` : undefined}
        actions={
          <>
            <button className="btn-secondary" onClick={exportCsv} disabled={!data?.total}>
              <Download className="h-4 w-4" /> CSV
            </button>
            <button className="btn-secondary" onClick={() => window.print()} disabled={!data?.total}>
              <Printer className="h-4 w-4" /> <span className="hidden sm:inline">Yazdır</span>
            </button>
            <Link to="/app/matches/new" className="btn-primary">
              <Plus className="h-4 w-4" /> Yeni maç
            </Link>
          </>
        }
      />

      <div className="no-print panel panel-pad mb-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Takım, lig, saha, şehir ara…" className="pl-9" aria-label="Maçlarda ara" />
          </div>
          <div className="flex gap-2">
            <button className={clsx('btn-secondary flex-1 sm:flex-none', showFilters && 'ring-1 ring-pitch-400/40')} onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
              <Filter className="h-4 w-4" /> Filtreler {activeCount > 0 && <span className="rounded-full bg-pitch-500 px-1.5 text-[11px] text-ink-950">{activeCount}</span>}
            </button>
            <div className="hidden rounded-xl border border-white/10 p-0.5 sm:flex" role="group" aria-label="Görünüm">
              <button className={clsx('btn-ghost btn-sm', view === 'table' && 'bg-white/10 text-white')} onClick={() => setView('table')} aria-label="Tablo görünümü" aria-pressed={view === 'table'}>
                <ListOrdered className="h-4 w-4" />
              </button>
              <button className={clsx('btn-ghost btn-sm', view === 'cards' && 'bg-white/10 text-white')} onClick={() => setView('cards')} aria-label="Kart görünümü" aria-pressed={view === 'cards'}>
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        {showFilters && (
          <div className="mt-4 grid animate-fade-up grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <label className="col-span-1">
              <span className="label">Başlangıç</span>
              <Input type="date" value={filters.from} onChange={(e) => update({ from: e.target.value })} />
            </label>
            <label>
              <span className="label">Bitiş</span>
              <Input type="date" value={filters.to} onChange={(e) => update({ to: e.target.value })} />
            </label>
            <label>
              <span className="label">Sezon</span>
              <Select value={filters.season} onChange={(e) => update({ season: e.target.value })}>
                <option value="">Tümü</option>
                {suggestions.data?.seasons.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </label>
            <label>
              <span className="label">Kategori</span>
              <Select value={filters.categoryId} onChange={(e) => update({ categoryId: e.target.value })}>
                <option value="">Tümü</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span className="label">Görev</span>
              <Select value={filters.role} onChange={(e) => update({ role: e.target.value })}>
                <option value="">Tümü</option>
                <option value="ASSISTANT">Tüm yardımcı hakemlikler</option>
                {OFFICIAL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {OFFICIAL_ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span className="label">Durum</span>
              <Select value={filters.status} onChange={(e) => update({ status: e.target.value })}>
                <option value="">Tümü</option>
                {MATCH_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {MATCH_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span className="label">Lig / organizasyon</span>
              <Input value={filters.competition} onChange={(e) => update({ competition: e.target.value })} list="competition-list" />
              <datalist id="competition-list">
                {suggestions.data?.competitions.map((c) => <option key={c} value={c} />)}
              </datalist>
            </label>
            <label>
              <span className="label">Takım</span>
              <Input value={filters.team} onChange={(e) => update({ team: e.target.value })} list="team-list" />
              <datalist id="team-list">
                {suggestions.data?.teams.map((t) => <option key={t.id} value={t.name} />)}
              </datalist>
            </label>
            <label>
              <span className="label">Şehir / ilçe</span>
              <Input value={filters.city} onChange={(e) => update({ city: e.target.value })} />
            </label>
            <label>
              <span className="label">Rapor</span>
              <Select value={filters.reportStatus} onChange={(e) => update({ reportStatus: e.target.value })}>
                <option value="">Tümü</option>
                {REPORT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {REPORT_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span className="label">Min. kart</span>
              <Input type="number" min={0} inputMode="numeric" value={filters.minCards} onChange={(e) => update({ minCards: e.target.value })} />
            </label>
            <label>
              <span className="label">Maks. kart</span>
              <Input type="number" min={0} inputMode="numeric" value={filters.maxCards} onChange={(e) => update({ maxCards: e.target.value })} />
            </label>
            {hasAnyFilter && (
              <div className="col-span-2 flex items-end md:col-span-4 xl:col-span-6">
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    setSearch('');
                    setParams(new URLSearchParams(), { replace: true });
                  }}
                >
                  <X className="h-3.5 w-3.5" /> Filtreleri temizle
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {list.isLoading ? (
        <LoadingBlock />
      ) : list.isError ? (
        <ErrorBox message={errorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : !data?.total ? (
        <div className="panel">
          <EmptyState
            icon={ListOrdered}
            title={hasAnyFilter ? 'Filtrelere uyan maç yok' : 'Henüz maç kaydın yok'}
            description={hasAnyFilter ? 'Filtreleri değiştirmeyi veya temizlemeyi deneyin.' : 'İlk maçını ekle; istatistiklerin otomatik oluşsun.'}
            action={
              !hasAnyFilter && (
                <Link to="/app/matches/new" className="btn-primary">
                  <Plus className="h-4 w-4" /> Maç ekle
                </Link>
              )
            }
          />
        </div>
      ) : (
        <>
          {/* Tablo (masaüstü ve yazdırma) */}
          <div className={clsx('panel overflow-hidden', view === 'cards' ? 'hidden print:block' : 'hidden md:block print:block')}>
            <div className="scrollbar-thin overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>
                      <button className="inline-flex items-center gap-1 hover:text-white" onClick={() => sortBy('date')}>
                        Tarih <SortIcon k="date" />
                      </button>
                    </th>
                    <th>Maç</th>
                    <th>Skor</th>
                    <th>
                      <button className="inline-flex items-center gap-1 hover:text-white" onClick={() => sortBy('category')}>
                        Kategori <SortIcon k="category" />
                      </button>
                    </th>
                    <th>Görev</th>
                    <th>
                      <button className="inline-flex items-center gap-1 hover:text-white" onClick={() => sortBy('cards')}>
                        Kartlar <SortIcon k="cards" />
                      </button>
                    </th>
                    <th>Durum</th>
                    <th>Rapor</th>
                    <th className="no-print text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((m) => (
                    <tr key={m.id} className="cursor-pointer" onClick={() => navigate(`/app/matches/${m.id}`)}>
                      <td className="whitespace-nowrap tabular-nums text-slate-300">
                        {fmtDate(m.date)}
                        {m.kickoffTime && <span className="block text-xs text-slate-500">{m.kickoffTime}</span>}
                      </td>
                      <td className="min-w-[220px]">
                        <Link to={`/app/matches/${m.id}`} className="font-medium text-white hover:text-pitch-300" onClick={(e) => e.stopPropagation()}>
                          {m.homeTeam} – {m.awayTeam}
                        </Link>
                        <span className="block text-xs text-slate-500">{[m.competition, m.round, m.venue].filter(Boolean).join(' · ') || '—'}</span>
                      </td>
                      <td className="whitespace-nowrap font-display tabular-nums text-white">{score(m.homeScore, m.awayScore)}</td>
                      <td className="whitespace-nowrap text-slate-300">{m.category.name}</td>
                      <td>
                        <RoleBadge role={m.role} short />
                      </td>
                      <td>
                        <CardCounts yellow={m.yellowCards} red={m.redCards} />
                      </td>
                      <td>
                        <StatusBadge status={m.status} />
                      </td>
                      <td>
                        <ReportBadge status={m.reportStatus} />
                      </td>
                      <td className="no-print whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <Link to={`/app/matches/${m.id}/edit`} className="btn-ghost btn-sm" aria-label={`${m.homeTeam} – ${m.awayTeam} maçını düzenle`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button className="btn-ghost btn-sm hover:text-red-300" onClick={() => setToDelete(m)} aria-label={`${m.homeTeam} – ${m.awayTeam} maçını sil`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Kart görünümü (mobil varsayılan) */}
          <div className={clsx('no-print grid gap-3 sm:grid-cols-2 xl:grid-cols-3', view === 'table' && 'md:hidden')}>
            {data.items.map((m) => (
              <article key={m.id} className="panel panel-pad flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                  <span className="tabular-nums">
                    {fmtDate(m.date)}
                    {m.kickoffTime && ` · ${m.kickoffTime}`}
                  </span>
                  <StatusBadge status={m.status} />
                </div>
                <Link to={`/app/matches/${m.id}`} className="block">
                  <p className="font-medium text-white">{m.homeTeam}</p>
                  <p className="font-medium text-white">{m.awayTeam}</p>
                  <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-pitch-300">{score(m.homeScore, m.awayScore)}</p>
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="chip border-white/10">{m.category.name}</span>
                  <RoleBadge role={m.role} short />
                  <ReportBadge status={m.reportStatus} />
                </div>
                <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
                  <CardCounts yellow={m.yellowCards} red={m.redCards} />
                  <div className="flex">
                    <Link to={`/app/matches/${m.id}`} className="btn-ghost btn-sm" aria-label="Ayrıntı">
                      <Eye className="h-4 w-4" />
                    </Link>
                    <Link to={`/app/matches/${m.id}/edit`} className="btn-ghost btn-sm" aria-label="Düzenle">
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <button className="btn-ghost btn-sm hover:text-red-300" onClick={() => setToDelete(m)} aria-label="Sil">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(p) => update({ page: String(p) }, false)} />
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Maçı sil"
        danger
        busy={del.isPending}
        confirmLabel="Kalıcı olarak sil"
        message={
          toDelete && (
            <>
              <strong className="text-white">
                {toDelete.homeTeam} – {toDelete.awayTeam}
              </strong>{' '}
              ({fmtDate(toDelete.date)}) maçı, kart olayları ve notlarıyla birlikte kalıcı olarak silinecek. İstatistiklerin hemen güncellenir.
              Bu işlem geri alınamaz.
            </>
          )
        }
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
      />
    </div>
  );
}
