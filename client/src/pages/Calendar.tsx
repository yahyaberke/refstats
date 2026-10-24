import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Plus, Target } from 'lucide-react';
import { todayIso } from '@refstats/shared';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorBox, PageHeader, ProgressBar, RoleBadge, Spinner, StatusBadge } from '../components/ui';
import { api, errorMessage, qs } from '../lib/api';
import type { CalendarItem, Dashboard } from '../lib/types';

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

const chipStyle: Record<CalendarItem['status'], string> = {
  COMPLETED: 'border-pitch-400/30 bg-pitch-500/15 text-pitch-100',
  SCHEDULED: 'border-dashed border-sky-400/50 bg-sky-500/10 text-sky-100',
  POSTPONED: 'border-amber-400/30 bg-amber-500/10 text-amber-100 line-through decoration-amber-300/50',
  CANCELLED: 'border-red-400/30 bg-red-500/10 text-red-200 line-through decoration-red-300/50',
};

export default function CalendarPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<'month' | 'week'>(() => (window.innerWidth < 768 ? 'week' : 'month'));
  const [anchor, setAnchor] = useState(() => new Date());
  const today = todayIso();

  const range = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(anchor);
      return { start, days: Array.from({ length: 7 }, (_, i) => addDays(start, i)) };
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = startOfWeek(first);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const total = Math.ceil(((last.getTime() - start.getTime()) / 86400000 + 1) / 7) * 7;
    return { start, days: Array.from({ length: total }, (_, i) => addDays(start, i)) };
  }, [anchor, view]);

  const from = iso(range.days[0]);
  const to = iso(range.days[range.days.length - 1]);
  const q = useQuery({
    queryKey: ['calendar', from, to],
    queryFn: () => api.get<{ items: CalendarItem[] }>(`/matches/calendar${qs({ from, to })}`).then((r) => r.items),
  });
  const dash = useQuery({ queryKey: ['stats', 'dashboard'], queryFn: () => api.get<Dashboard>('/stats/dashboard') });
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of q.data ?? []) map.set(it.date, [...(map.get(it.date) ?? []), it]);
    return map;
  }, [q.data]);

  const move = (dir: number) =>
    setAnchor((a) => (view === 'week' ? addDays(a, dir * 7) : new Date(a.getFullYear(), a.getMonth() + dir, 1)));
  const title =
    view === 'month'
      ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
      : `${range.days[0].getDate()} ${MONTHS[range.days[0].getMonth()]} – ${range.days[6].getDate()} ${MONTHS[range.days[6].getMonth()]} ${range.days[6].getFullYear()}`;
  const seasonGoal = dash.data?.goals.find((g) => g.metric !== 'CUSTOM');

  return (
    <>
      <PageHeader
        title="Takvim"
        subtitle="Geçmiş ve planladığınız görevler. Bu takvim yalnızca sizin girdiğiniz kayıtları gösterir; resmî atama sistemiyle bağlantılı değildir."
        actions={
          <Link to="/app/matches/new" className="btn-primary">
            <Plus className="h-4 w-4" /> Maç / görev ekle
          </Link>
        }
      />

      {seasonGoal && (
        <Link to="/app/career" className="panel panel-pad mb-5 flex flex-col gap-3 transition hover:border-pitch-400/20 sm:flex-row sm:items-center">
          <span className="flex items-center gap-2 text-sm font-medium text-white">
            <Target className="h-4 w-4 text-pitch-400" /> {seasonGoal.title}
          </span>
          <div className="flex-1">
            <ProgressBar percent={seasonGoal.percent} achieved={seasonGoal.achieved} />
          </div>
          <span className="text-sm tabular-nums text-slate-300">
            {seasonGoal.current}/{seasonGoal.target} · %{seasonGoal.percent}
          </span>
        </Link>
      )}

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-1">
            <button className="btn-ghost btn-sm" onClick={() => move(-1)} aria-label="Önceki">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="btn-ghost btn-sm" onClick={() => move(1)} aria-label="Sonraki">
              <ChevronRight className="h-4 w-4" />
            </button>
            <h2 className="ml-2 text-base font-semibold" aria-live="polite">
              {title}
            </h2>
            {q.isFetching && <Spinner className="ml-2 h-4 w-4 text-slate-500" />}
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary btn-sm" onClick={() => setAnchor(new Date())}>
              Bugün
            </button>
            <div className="flex rounded-xl border border-white/10 p-0.5 text-xs" role="group" aria-label="Görünüm">
              {(['month', 'week'] as const).map((v) => (
                <button key={v} className={clsx('rounded-lg px-3 py-1.5 font-medium', view === v ? 'bg-white/10 text-white' : 'text-slate-400')} onClick={() => setView(v)} aria-pressed={view === v}>
                  {v === 'month' ? 'Aylık' : 'Haftalık'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {q.isError ? (
          <div className="p-4">
            <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} />
          </div>
        ) : view === 'month' ? (
          <div className="scrollbar-thin overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-7 border-b border-white/[0.06] text-center text-xs font-medium uppercase tracking-wide text-slate-500">
                {DAYS.map((d) => (
                  <div key={d} className="py-2">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {range.days.map((d) => {
                  const key = iso(d);
                  const items = byDay.get(key) ?? [];
                  const inMonth = d.getMonth() === anchor.getMonth();
                  return (
                    <div
                      key={key}
                      className={clsx('group min-h-[112px] border-b border-r border-white/[0.05] p-1.5', !inMonth && 'bg-ink-950/40 opacity-50')}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className={clsx(
                            'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums',
                            key === today ? 'bg-pitch-500 font-semibold text-ink-950' : 'text-slate-400',
                          )}
                        >
                          {d.getDate()}
                        </span>
                        <button
                          className="rounded p-0.5 text-slate-500 opacity-0 transition hover:text-pitch-300 focus:opacity-100 group-hover:opacity-100"
                          onClick={() => navigate(`/app/matches/new?date=${key}`)}
                          aria-label={`${key} tarihine maç ekle`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        {items.slice(0, 3).map((it) => (
                          <Link
                            key={it.id}
                            to={`/app/matches/${it.id}`}
                            className={clsx('block truncate rounded-md border px-1.5 py-1 text-[11px] leading-tight transition hover:brightness-125', chipStyle[it.status])}
                            title={`${it.homeTeam} – ${it.awayTeam} · ${it.category} · ${it.roleShort}`}
                          >
                            <span className="font-semibold">{it.roleShort}</span> {it.homeTeam} – {it.awayTeam}
                          </Link>
                        ))}
                        {items.length > 3 && <p className="px-1 text-[11px] text-slate-500">+{items.length - 3} daha</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {range.days.map((d) => {
              const key = iso(d);
              const items = byDay.get(key) ?? [];
              return (
                <li key={key} className="flex gap-4 px-4 py-3">
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-xs uppercase text-slate-500">{DAYS[(d.getDay() + 6) % 7]}</p>
                    <p className={clsx('mx-auto mt-0.5 flex h-9 w-9 items-center justify-center rounded-full font-display text-lg', key === today ? 'bg-pitch-500 text-ink-950' : 'text-white')}>
                      {d.getDate()}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    {items.length === 0 ? (
                      <button className="mt-2 text-xs text-slate-600 hover:text-pitch-300" onClick={() => navigate(`/app/matches/new?date=${key}`)}>
                        + Görev ekle
                      </button>
                    ) : (
                      items.map((it) => (
                        <Link key={it.id} to={`/app/matches/${it.id}`} className={clsx('flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm', chipStyle[it.status])}>
                          <span className="font-medium">
                            {it.homeTeam} – {it.awayTeam}
                          </span>
                          {it.homeScore !== null && <span className="tabular-nums">{it.homeScore}-{it.awayScore}</span>}
                          <span className="text-xs opacity-80">
                            {it.kickoffTime ?? ''} {it.category}
                            {it.venue ? ` · ${it.venue}` : ''}
                          </span>
                          <span className="ml-auto flex gap-1.5">
                            <RoleBadge role={it.role} short />
                            <StatusBadge status={it.status} />
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-2">
          <span className="h-3 w-5 rounded border border-pitch-400/30 bg-pitch-500/15" /> Tamamlandı
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-5 rounded border border-dashed border-sky-400/50 bg-sky-500/10" /> Planlandı (gelecek)
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-5 rounded border border-amber-400/30 bg-amber-500/10" /> Ertelendi
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-5 rounded border border-red-400/30 bg-red-500/10" /> İptal
        </span>
      </div>
    </>
  );
}
