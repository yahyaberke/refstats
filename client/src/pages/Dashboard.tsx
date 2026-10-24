import { useQuery } from '@tanstack/react-query';
import {
  Activity as ActivityIcon,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  Flag,
  Layers,
  Plus,
  Settings2,
  Shirt,
  Target,
  Timer,
  UserRound,
  Users,
  Whistle,
} from '../components/icons';
import { OFFICIAL_ROLE_LABELS, type DashboardWidget } from '@refstats/shared';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AreaTrend, Bars, CHART, ChartCard, HBars, ROLE_SERIES, ShareBar } from '../components/charts';
import { CardCounts, EmptyState, ErrorBox, LoadingBlock, PageHeader, ProgressBar, RoleBadge, SectionTitle, StatCard, StatusBadge } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { fmtDate, fmtNum, relativeTime, score } from '../lib/format';
import type { Dashboard as DashboardData } from '../lib/types';

function Welcome({ firstName }: { firstName: string }) {
  const steps = [
    { icon: UserRound, title: 'Profilini tamamla', text: 'Bölge, klasman ve başlangıç yılını ekle.', to: '/app/profile', cta: 'Profile git' },
    { icon: Plus, title: 'İlk maçını kaydet', text: 'Tarih, takımlar, kategori ve görevin yeterli.', to: '/app/matches/new', cta: 'Maç ekle' },
    { icon: Target, title: 'Sezon hedefi koy', text: 'Hedefine ne kadar yaklaştığını takip et.', to: '/app/career', cta: 'Hedef belirle' },
  ];
  return (
    <div className="panel overflow-hidden">
      <div className="relative p-6 sm:p-10">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-pitch-500/15 via-transparent to-sky-500/10" />
        <h2 className="text-2xl font-semibold sm:text-3xl">Hoş geldin, {firstName}!</h2>
        <p className="mt-2 max-w-2xl text-slate-400">
          Panelin boş görünüyor çünkü henüz maç eklemedin. İstatistiklerin, grafiklerin ve kariyer özetin tamamen senin girdiğin
          kayıtlardan oluşur — tahmini veya örnek veri gösterilmez.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="rounded-2xl border border-white/[0.08] bg-ink-850/80 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pitch-500/15 font-display text-sm font-semibold text-pitch-300">{i + 1}</span>
                <s.icon className="h-5 w-5 text-slate-400" />
              </div>
              <h3 className="mt-4 text-sm font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{s.text}</p>
              <Link to={s.to} className={i === 1 ? 'btn-primary btn-sm mt-4' : 'btn-secondary btn-sm mt-4'}>
                {s.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['stats', 'dashboard'], queryFn: () => api.get<DashboardData>('/stats/dashboard') });
  const widgets = new Set<DashboardWidget>(user?.settings?.dashboardWidgets ?? []);
  const show = (w: DashboardWidget) => widgets.has(w);

  const header = (
    <PageHeader
      title="Dashboard"
      subtitle={user ? `Merhaba ${user.firstName}, işte hakemlik özetin.` : undefined}
      actions={
        <>
          <Link to="/app/settings?tab=dashboard" className="btn-secondary" title="Paneli özelleştir">
            <Settings2 className="h-4 w-4" /> <span className="hidden sm:inline">Özelleştir</span>
          </Link>
          <Link to="/app/matches/new" className="btn-primary">
            <Plus className="h-4 w-4" /> Hızlı maç ekle
          </Link>
        </>
      }
    />
  );

  if (q.isLoading) return (<>{header}<LoadingBlock /></>);
  if (q.isError) return (<>{header}<ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} /></>);
  const d = q.data!;
  if (!d.hasMatches) return (<>{header}<Welcome firstName={user?.firstName ?? ''} /></>);
  const s = d.summary;
  const year = new Date().getFullYear();

  return (
    <>
      {header}

      {d.nextMatch && (
        <Link
          to={`/app/matches/${d.nextMatch.id}`}
          className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-sky-400/20 bg-sky-500/[0.07] px-4 py-3 text-sm transition hover:border-sky-400/40"
        >
          <CalendarClock className="h-4 w-4 text-sky-300" />
          <span className="text-sky-200">Sıradaki görev:</span>
          <span className="font-medium text-white">
            {d.nextMatch.homeTeam} – {d.nextMatch.awayTeam}
          </span>
          <span className="text-slate-400">
            {fmtDate(d.nextMatch.date)} · {d.nextMatch.category} · {OFFICIAL_ROLE_LABELS[d.nextMatch.role]}
          </span>
        </Link>
      )}

      {show('summary') && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Toplam maç" value={s.total} icon={Flag} hint="Tamamlanan görevler" />
          <StatCard label="Orta hakem" value={s.referee} icon={Whistle} />
          <StatCard label="Yardımcı hakem" value={s.assistant} icon={Users} accent="blue" />
          <StatCard label="Dördüncü hakem" value={s.fourth} icon={ClipboardCheck} accent="slate" />
          <StatCard label={`${year} maçları`} value={s.thisYear} icon={CalendarDays} accent="blue" />
          <StatCard label="Sarı kart" value={s.yellowCards} icon={Shirt} accent="yellow" hint="İkinci sarılar dahil" />
          <StatCard label="Kırmızı kart" value={s.redCards} icon={Shirt} accent="red" hint={`${s.secondYellowReds} ikinci sarı · ${s.directReds} direkt`} />
          <StatCard label="Kart / maç" value={fmtNum(s.avgCardsPerMatch, 2)} icon={Timer} accent="slate" />
          <StatCard label="Kategori" value={s.distinctCategories} icon={Layers} hint="Görev alınan farklı kategori" />
          <StatCard label="Son maç" value={<span className="text-xl sm:text-2xl">{fmtDate(s.lastMatchDate)}</span>} icon={CalendarClock} accent="slate" hint={s.pendingReports ? `${s.pendingReports} rapor bekliyor` : 'Tüm raporlar tamam'} />
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        {show('last30') && (
          <ChartCard title="Son 30 gün" subtitle="Günlük tamamlanan maç sayısı" className="xl:col-span-2" empty={d.last30.every((x) => x.count === 0)}>
            <Bars data={d.last30} xKey="label" series={[{ key: 'count', label: 'Maç', color: CHART.primary }]} height={220} />
          </ChartCard>
        )}
        {show('roles') && (
          <ChartCard title="Görev türleri" subtitle="Tüm tamamlanan maçlar">
            <ShareBar
              items={[
                { label: 'Orta hakem', value: s.referee, color: CHART.referee },
                { label: 'Yardımcı hakem', value: s.assistant, color: CHART.assistant },
                { label: 'Dördüncü hakem', value: s.fourth, color: CHART.fourth },
                { label: 'Diğer', value: s.other, color: CHART.other },
              ]}
            />
          </ChartCard>
        )}
        {show('monthly') && (
          <ChartCard title="Aylara göre maçlar" subtitle="Son 12 ay · görev türüne göre" className="xl:col-span-2" empty={d.monthly.every((m) => m.count === 0)}>
            <Bars data={d.monthly} xKey="label" series={ROLE_SERIES} stacked height={250} />
          </ChartCard>
        )}
        {show('categories') && (
          <ChartCard title="Kategoriler" subtitle="Maç sayısına göre" empty={!d.categories.length}>
            <HBars data={d.categories.slice(0, 8)} />
          </ChartCard>
        )}
        {show('cards') && (
          <ChartCard title="Kart dağılımı" subtitle="Son 12 ay · sarı ve kırmızı" className="xl:col-span-2" empty={d.monthly.every((m) => m.yellowCards + m.redCards === 0)}>
            <Bars
              data={d.monthly}
              xKey="label"
              series={[
                { key: 'yellowCards', label: 'Sarı kart', color: CHART.yellow },
                { key: 'redCards', label: 'Kırmızı kart', color: CHART.red },
              ]}
              height={230}
            />
          </ChartCard>
        )}
        {show('goals') && (
          <section className="panel panel-pad">
            <SectionTitle action={<Link to="/app/career" className="text-xs text-pitch-300 hover:underline">Tümü</Link>}>Hedefler</SectionTitle>
            {d.goals.length ? (
              <ul className="space-y-4">
                {d.goals.slice(0, 4).map((g) => (
                  <li key={g.id}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate text-slate-200">{g.title}</span>
                      <span className="shrink-0 tabular-nums text-slate-400">
                        {g.current}/{g.target}
                      </span>
                    </div>
                    <ProgressBar percent={g.percent} achieved={g.achieved} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">
                Henüz hedef yok.{' '}
                <Link to="/app/career" className="text-pitch-300 hover:underline">
                  Sezon hedefi belirle
                </Link>
              </p>
            )}
          </section>
        )}
      </div>

      {show('last30') && (
        <div className="mt-5">
          <ChartCard title="Son 12 ay trendi" subtitle="Aylık tamamlanan maç" empty={d.monthly.every((m) => m.count === 0)}>
            <AreaTrend data={d.monthly} xKey="label" yKey="count" label="Maç" height={180} />
          </ChartCard>
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        {show('recentMatches') && (
          <section className="panel panel-pad xl:col-span-2">
            <SectionTitle action={<Link to="/app/matches" className="text-xs text-pitch-300 hover:underline">Tüm maçlar</Link>}>Son eklenen maçlar</SectionTitle>
            <ul className="divide-y divide-white/[0.05]">
              {d.recentMatches.map((m) => (
                <li key={m.id}>
                  <Link to={`/app/matches/${m.id}`} className="-mx-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl px-2 py-3 transition hover:bg-white/[0.03]">
                    <span className="w-24 shrink-0 text-xs tabular-nums text-slate-400">{fmtDate(m.date)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                      {m.homeTeam} <span className="px-1 tabular-nums text-pitch-300">{score(m.homeScore, m.awayScore)}</span> {m.awayTeam}
                    </span>
                    <span className="hidden text-xs text-slate-400 md:inline">{m.category}</span>
                    <RoleBadge role={m.role} short />
                    {m.status !== 'COMPLETED' ? <StatusBadge status={m.status} /> : <CardCounts yellow={m.yellowCards} red={m.redCards} />}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {show('activity') && (
          <section className="panel panel-pad">
            <SectionTitle>Son aktiviteler</SectionTitle>
            {d.activity.length ? (
              <ol className="relative space-y-4 border-l border-white/10 pl-4">
                {d.activity.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-pitch-400 ring-4 ring-ink-900" aria-hidden />
                    <p className="text-sm text-slate-200">{a.summary}</p>
                    <p className="text-xs text-slate-500">{relativeTime(a.createdAt)}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState icon={ActivityIcon} title="Aktivite yok" />
            )}
          </section>
        )}
      </div>
    </>
  );
}
