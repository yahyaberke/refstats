import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Award, Copy, ExternalLink, Lock, Pencil, Plus, Printer, Target, Trash2, Trophy } from 'lucide-react';
import { GOAL_METRIC_LABELS, GOAL_METRICS, goalSchema, seasonForDate, todayIso, type GoalMetric } from '@refstats/shared';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Bars, CHART, ChartCard, HBars, Lines, ROLE_SERIES, ShareBar } from '../components/charts';
import { ConfirmDialog, Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { Avatar, EmptyState, ErrorBox, Field, Input, LoadingBlock, PageHeader, ProgressBar, Select, Spinner, Textarea } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { fmtDate } from '../lib/format';
import type { Career as CareerData, GoalProgress } from '../lib/types';
import { apiErrors, zodErrors, type FieldErrors } from '../lib/useForm';

interface GoalFormState {
  title: string;
  metric: GoalMetric;
  target: string;
  periodType: 'season' | 'year';
  season: string;
  year: string;
  manualProgress: string;
  note: string;
}

const currentSeason = seasonForDate(todayIso());

function goalToForm(g?: GoalProgress): GoalFormState {
  return {
    title: g?.title ?? `${currentSeason} sezon hedefi`,
    metric: g?.metric ?? 'TOTAL_MATCHES',
    target: String(g?.target ?? 30),
    periodType: g?.year ? 'year' : 'season',
    season: g?.season ?? currentSeason,
    year: String(g?.year ?? new Date().getFullYear()),
    manualProgress: String(g?.manualProgress ?? 0),
    note: g?.note ?? '',
  };
}

function GoalModal({ goal, open, onClose }: { goal?: GoalProgress; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState<GoalFormState>(() => goalToForm(goal));
  const [errors, setErrors] = useState<FieldErrors>({});
  const save = useMutation({
    mutationFn: (payload: unknown) => (goal ? api.put(`/goals/${goal.id}`, payload) : api.post('/goals', payload)),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success(goal ? 'Hedef güncellendi' : 'Hedef eklendi');
      onClose();
    },
    onError: (e) => setErrors(apiErrors(e).fields),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const custom = f.metric === 'CUSTOM';
    const payload = {
      title: f.title,
      metric: f.metric,
      target: Number(f.target),
      season: !custom && f.periodType === 'season' ? f.season : null,
      year: !custom && f.periodType === 'year' ? Number(f.year) : null,
      manualProgress: custom ? Number(f.manualProgress || 0) : 0,
      note: f.note || null,
    };
    const v = zodErrors(goalSchema, payload);
    if (v) return setErrors(v);
    save.mutate(payload);
  };
  const seasons = [0, 1, 2].map((i) => {
    const y = Number(currentSeason.slice(0, 4)) - 1 + i;
    return `${y}-${y + 1}`;
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={goal ? 'Hedefi düzenle' : 'Yeni hedef'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn-primary" onClick={submit} disabled={save.isPending}>
            {save.isPending && <Spinner />} Kaydet
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Başlık" error={errors.title}>
          {(id) => <Input id={id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} invalid={!!errors.title} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ölçüt">
            {(id) => (
              <Select id={id} value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value as GoalMetric })}>
                {GOAL_METRICS.map((m) => (
                  <option key={m} value={m}>
                    {GOAL_METRIC_LABELS[m]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Hedef sayı" error={errors.target}>
            {(id) => <Input id={id} type="number" min={1} inputMode="numeric" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} invalid={!!errors.target} />}
          </Field>
        </div>
        {f.metric === 'CUSTOM' ? (
          <Field label="Şu anki ilerleme" hint="Kişisel hedeflerde ilerlemeyi siz güncellersiniz (ör. 3/5 eğitim semineri).">
            {(id, d) => <Input id={id} type="number" min={0} value={f.manualProgress} onChange={(e) => setF({ ...f, manualProgress: e.target.value })} aria-describedby={d} />}
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dönem">
              {(id) => (
                <Select id={id} value={f.periodType} onChange={(e) => setF({ ...f, periodType: e.target.value as 'season' | 'year' })}>
                  <option value="season">Sezon</option>
                  <option value="year">Takvim yılı</option>
                </Select>
              )}
            </Field>
            {f.periodType === 'season' ? (
              <Field label="Sezon" error={errors.season}>
                {(id) => (
                  <Select id={id} value={f.season} onChange={(e) => setF({ ...f, season: e.target.value })}>
                    {seasons.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : (
              <Field label="Yıl" error={errors.year}>
                {(id) => <Input id={id} type="number" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} />}
              </Field>
            )}
          </div>
        )}
        <Field label="Not" optional>
          {(id) => <Textarea id={id} rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />}
        </Field>
      </form>
    </Modal>
  );
}

export default function Career() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['stats', 'career'], queryFn: () => api.get<CareerData>('/stats/career') });
  const [editing, setEditing] = useState<GoalProgress | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<GoalProgress | null>(null);
  const del = useMutation({
    mutationFn: (id: string) => api.del(`/goals/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['stats'] });
      setToDelete(null);
      toast.success('Hedef silindi');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <LoadingBlock />;
  if (q.isError) return <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const c = q.data!;
  const s = c.summary;
  const publicUrl = user ? `${window.location.origin}/u/${user.username}` : '';
  const isPublic = user?.settings?.profilePublic;
  const earned = c.badges.filter((b) => b.earned).length;
  const years = user?.startYear ? new Date().getFullYear() - user.startYear : null;

  return (
    <div className="print-area">
      <PageHeader
        title="Kariyerim"
        subtitle="Hakemlik geçmişinizin özeti, hedefleriniz ve rozetleriniz."
        actions={
          <>
            <button className="btn-secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> CV / Yazdır
            </button>
            {isPublic ? (
              <a className="btn-secondary" href={`/u/${user?.username}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Herkese açık profil
              </a>
            ) : (
              <Link to="/app/settings?tab=privacy" className="btn-secondary">
                <Lock className="h-4 w-4" /> Profil gizli
              </Link>
            )}
          </>
        }
      />

      {/* Kariyer başlığı (yazdırmada CV üst bilgisi) */}
      <section className="panel panel-pad mb-5 flex flex-col gap-5 sm:flex-row sm:items-center">
        {user && <Avatar url={user.avatarUrl} first={user.firstName} last={user.lastName} size={72} />}
        <div className="flex-1">
          <h2 className="text-xl font-semibold">
            {user?.firstName} {user?.lastName}
          </h2>
          <p className="text-sm text-slate-400">{[user?.classification, user?.region, user?.organization].filter(Boolean).join(' · ') || 'Profil bilgilerini tamamlayın'}</p>
          {user?.bio && <p className="mt-2 max-w-2xl text-sm text-slate-300">{user.bio}</p>}
        </div>
        <dl className="grid grid-cols-3 gap-4 text-center">
          <div>
            <dt className="text-xs text-slate-500">Toplam görev</dt>
            <dd className="font-display text-2xl font-semibold text-white">{s.total}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Hakemlikte</dt>
            <dd className="font-display text-2xl font-semibold text-white">{years !== null ? `${years} yıl` : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Rozet</dt>
            <dd className="font-display text-2xl font-semibold text-white">
              {earned}/{c.badges.length}
            </dd>
          </div>
        </dl>
      </section>

      {isPublic && (
        <div className="no-print mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm">
          <span className="text-slate-400">Paylaşılabilir profil bağlantınız:</span>
          <code className="truncate text-pitch-300">{publicUrl}</code>
          <button
            className="btn-ghost btn-sm ml-auto"
            onClick={() => {
              navigator.clipboard?.writeText(publicUrl).then(
                () => toast.success('Bağlantı kopyalandı'),
                () => toast.error('Kopyalanamadı'),
              );
            }}
          >
            <Copy className="h-4 w-4" /> Kopyala
          </button>
        </div>
      )}

      {s.total === 0 ? (
        <div className="panel mb-5">
          <EmptyState icon={Trophy} title="Kariyer özetiniz maç ekledikçe oluşur" description="İlk maçınızı kaydettiğinizde yıllara göre geçmişiniz burada görünecek." action={<Link to="/app/matches/new" className="btn-primary">Maç ekle</Link>} />
        </div>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-3">
            <ChartCard title="Yıllara göre hakemlik geçmişi" subtitle={`İlk kayıtlı maç: ${fmtDate(c.firstMatchDate)}`} className="xl:col-span-2">
              <Bars data={c.yearHistory} xKey="year" series={ROLE_SERIES} stacked height={250} />
            </ChartCard>
            <ChartCard title="Görev türü dağılımı">
              <ShareBar
                items={[
                  { label: 'Orta hakem', value: s.referee, color: CHART.referee },
                  { label: 'Yardımcı hakem', value: s.assistant, color: CHART.assistant },
                  { label: 'Dördüncü hakem', value: s.fourth, color: CHART.fourth },
                  { label: 'Diğer', value: s.other, color: CHART.other },
                ]}
              />
            </ChartCard>
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <ChartCard title="Kategori dağılımı">
              <HBars data={c.categories} />
            </ChartCard>
            <section className="panel panel-pad">
              <h2 className="mb-4 text-sm font-semibold">Sezon özeti</h2>
              <div className="scrollbar-thin overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Sezon</th>
                      <th className="text-right">Maç</th>
                      <th className="text-right">Orta</th>
                      <th className="text-right">Yrd.</th>
                      <th className="text-right">4.</th>
                      <th className="text-right">Kart/maç</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.seasons.map((x) => (
                      <tr key={x.name}>
                        <td className="font-medium text-white">{x.name}</td>
                        <td className="text-right tabular-nums">{x.total}</td>
                        <td className="text-right tabular-nums">{x.referee}</td>
                        <td className="text-right tabular-nums">{x.assistant}</td>
                        <td className="text-right tabular-nums">{x.fourth}</td>
                        <td className="text-right tabular-nums">{x.avgCardsPerMatch.toLocaleString('tr-TR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3 className="mb-2 mt-6 text-xs uppercase tracking-wide text-slate-500">Yıllara göre kategoriler</h3>
              <ul className="space-y-1.5 text-sm">
                {c.yearHistory
                  .slice()
                  .reverse()
                  .map((y) => (
                    <li key={y.year} className="flex gap-3">
                      <span className="w-12 shrink-0 font-display font-semibold text-white">{y.year}</span>
                      <span className="text-slate-400">{y.categories.join(', ')}</span>
                    </li>
                  ))}
              </ul>
            </section>
          </div>
        </>
      )}

      <section className="panel panel-pad mt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Target className="h-4 w-4 text-pitch-400" /> Kişisel hedefler
          </h2>
          <button className="no-print btn-primary btn-sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> Hedef ekle
          </button>
        </div>
        {c.goals.length === 0 ? (
          <p className="text-sm text-slate-400">Henüz hedef yok. Örneğin “Bu sezon 30 maç” veya “15 orta hakemlik” gibi bir hedef ekleyin.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {c.goals.map((g) => (
              <div key={g.id} className={clsx('rounded-xl border p-4', g.achieved ? 'border-pitch-400/30 bg-pitch-500/[0.06]' : 'border-white/[0.06] bg-ink-850/60')}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{g.title}</p>
                    <p className="text-xs text-slate-500">
                      {g.metricLabel}
                      {g.periodLabel && ` · ${g.periodLabel}`}
                    </p>
                  </div>
                  <div className="no-print flex">
                    <button className="btn-ghost btn-sm" onClick={() => setEditing(g)} aria-label="Hedefi düzenle">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button className="btn-ghost btn-sm hover:text-red-300" onClick={() => setToDelete(g)} aria-label="Hedefi sil">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1">
                    <ProgressBar percent={g.percent} achieved={g.achieved} />
                  </div>
                  <span className="text-sm tabular-nums text-slate-300">
                    {g.current}/{g.target}
                  </span>
                </div>
                {g.timeline.length > 1 && (
                  <div className="mt-3">
                    <Lines
                      data={g.timeline}
                      xKey="label"
                      series={[
                        { key: 'cumulative', label: 'Gerçekleşen', color: CHART.referee },
                        { key: 'target', label: 'Doğrusal hedef', color: CHART.other },
                      ]}
                      dashedKeys={['target']}
                      domain={[0, 'auto']}
                      height={150}
                    />
                  </div>
                )}
                {g.note && <p className="mt-2 text-xs text-slate-400">{g.note}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel panel-pad mt-5">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
          <Award className="h-4 w-4 text-pitch-400" /> Başarı rozetleri
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {c.badges.map((b) => (
            <li
              key={b.id}
              className={clsx('flex flex-col items-center rounded-xl border p-4 text-center', b.earned ? 'border-pitch-400/30 bg-pitch-500/[0.07]' : 'border-white/[0.06] opacity-60')}
            >
              <span className={clsx('mb-2 rounded-full p-2.5', b.earned ? 'bg-pitch-500/20 text-pitch-300' : 'bg-white/5 text-slate-500')}>
                {b.earned ? <Trophy className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
              </span>
              <p className="text-sm font-semibold text-white">{b.title}</p>
              <p className="mt-0.5 text-xs text-slate-400">{b.description}</p>
              <p className="mt-2 text-[11px] tabular-nums text-slate-500">
                {b.earned ? (b.earnedAt ? `Kazanıldı: ${fmtDate(b.earnedAt)}` : 'Kazanıldı') : `${b.progress}/${b.target}`}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {editing && <GoalModal open goal={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!toDelete}
        title="Hedefi sil"
        danger
        busy={del.isPending}
        confirmLabel="Sil"
        message={`“${toDelete?.title}” hedefi silinecek.`}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
      />
    </div>
  );
}
