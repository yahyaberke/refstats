import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BarChart3, Flag, Goal, Scale, Shirt, Swords, X } from 'lucide-react';
import { OFFICIAL_ROLE_LABELS, OFFICIAL_ROLES } from '@refstats/shared';
import { useSearchParams } from 'react-router-dom';
import { Bars, CHART, ChartCard, HBars, Lines, ROLE_SERIES, ShareBar } from '../components/charts';
import { EmptyState, ErrorBox, Input, LoadingBlock, PageHeader, ProgressBar, Select, StatCard } from '../components/ui';
import { api, errorMessage, qs } from '../lib/api';
import { fmtNum } from '../lib/format';
import { useCategories, useSuggestions } from '../lib/queries';
import type { Analytics } from '../lib/types';

const KEYS = ['role', 'categoryId', 'season', 'from', 'to'] as const;

export default function Stats() {
  const [params, setParams] = useSearchParams();
  const categories = useCategories();
  const suggestions = useSuggestions();
  const filters = Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? ''])) as Record<(typeof KEYS)[number], string>;
  const query = qs(filters);
  const q = useQuery({
    queryKey: ['stats', 'analytics', query],
    queryFn: () => api.get<Analytics>(`/stats/analytics${query}`),
    placeholderData: keepPreviousData,
  });
  const setFilter = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const hasFilter = KEYS.some((k) => filters[k]);

  const filterBar = (
    <div className="no-print panel panel-pad mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
      <label>
        <span className="label">Görev</span>
        <Select value={filters.role} onChange={(e) => setFilter('role', e.target.value)}>
          <option value="">Tüm görevler</option>
          <option value="ASSISTANT">Tüm yardımcı hakemlikler</option>
          {OFFICIAL_ROLES.map((r) => (
            <option key={r} value={r}>
              {OFFICIAL_ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </label>
      <label>
        <span className="label">Kategori</span>
        <Select value={filters.categoryId} onChange={(e) => setFilter('categoryId', e.target.value)}>
          <option value="">Tüm kategoriler</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </label>
      <label>
        <span className="label">Sezon</span>
        <Select value={filters.season} onChange={(e) => setFilter('season', e.target.value)}>
          <option value="">Tüm sezonlar</option>
          {suggestions.data?.seasons.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </label>
      <label>
        <span className="label">Başlangıç</span>
        <Input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
      </label>
      <label>
        <span className="label">Bitiş</span>
        <Input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
      </label>
      {hasFilter && (
        <div className="col-span-2 md:col-span-5">
          <button className="btn-ghost btn-sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
            <X className="h-3.5 w-3.5" /> Filtreleri temizle
          </button>
        </div>
      )}
    </div>
  );

  const header = <PageHeader title="İstatistik ve analiz" subtitle="Yalnızca “Tamamlandı” durumundaki maçlar hesaba katılır." />;
  if (q.isLoading) return (<>{header}{filterBar}<LoadingBlock /></>);
  if (q.isError) return (<>{header}{filterBar}<ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} /></>);
  const a = q.data!;
  const s = a.summary;

  if (s.total === 0) {
    return (
      <>
        {header}
        {filterBar}
        <div className="panel">
          <EmptyState icon={BarChart3} title={hasFilter ? 'Bu filtrelerle tamamlanmış maç yok' : 'Analiz için henüz tamamlanmış maç yok'} description="Maç ekledikçe tüm grafikler ve ortalamalar burada oluşur." />
        </div>
      </>
    );
  }

  const r = a.results;
  return (
    <>
      {header}
      {filterBar}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Maç" value={s.total} icon={Flag} />
        <StatCard label="Sarı kart" value={s.yellowCards} icon={Shirt} accent="yellow" hint={`Maç başı ${fmtNum(s.avgYellowPerMatch, 2)}`} />
        <StatCard label="Kırmızı kart" value={s.redCards} icon={Shirt} accent="red" hint={`Maç başı ${fmtNum(s.avgRedPerMatch, 2)}`} />
        <StatCard label="Kart / maç" value={fmtNum(s.avgCardsPerMatch, 2)} icon={Scale} accent="slate" />
        <StatCard label="Gol / maç" value={r.withScore ? fmtNum(r.avgGoals, 2) : '—'} icon={Goal} accent="blue" hint={`${r.withScore} skorlu maç`} />
        <StatCard label="Kategori" value={s.distinctCategories} icon={Swords} accent="slate" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <ChartCard title="Aylık maç yoğunluğu" subtitle="Görev türüne göre" className="xl:col-span-2">
          <Bars data={a.monthly} xKey="label" series={ROLE_SERIES} stacked height={260} />
        </ChartCard>
        <ChartCard title="Görev dağılımı">
          <ShareBar
            items={[
              { label: 'Orta hakem', value: s.referee, color: CHART.referee },
              { label: 'Yardımcı hakem', value: s.assistant, color: CHART.assistant },
              { label: 'Dördüncü hakem', value: s.fourth, color: CHART.fourth },
              { label: 'Diğer', value: s.other, color: CHART.other },
            ]}
          />
          <div className="mt-6 border-t border-white/[0.06] pt-4">
            <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">Maç sonuçları</p>
            <ShareBar
              items={[
                { label: 'Ev sahibi kazandı', value: r.homeWins, color: CHART.referee },
                { label: 'Beraberlik', value: r.draws, color: CHART.other },
                { label: 'Deplasman kazandı', value: r.awayWins, color: CHART.assistant },
              ]}
            />
          </div>
        </ChartCard>
      </div>

      <section className="panel panel-pad mt-5">
        <h2 className="mb-1 text-sm font-semibold">Orta hakemlik ve yardımcı hakemlik karşılaştırması</h2>
        <p className="mb-4 text-xs text-slate-500">Kart ortalamaları, görev aldığınız maçlarda gösterilen tüm kartlardır.</p>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Görev</th>
                  <th className="text-right">Maç</th>
                  <th className="text-right">Sarı/maç</th>
                  <th className="text-right">Kırmızı/maç</th>
                  <th className="text-right">Gol/maç</th>
                </tr>
              </thead>
              <tbody>
                {a.roleComparison.map((row) => (
                  <tr key={row.key}>
                    <td className="font-medium text-white">{row.label}</td>
                    <td className="text-right tabular-nums">{row.count}</td>
                    <td className="text-right tabular-nums">{row.count ? fmtNum(row.avgYellow, 2) : '—'}</td>
                    <td className="text-right tabular-nums">{row.count ? fmtNum(row.avgRed, 2) : '—'}</td>
                    <td className="text-right tabular-nums">{row.count ? fmtNum(row.avgGoals, 2) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Bars
            data={a.roleComparison.filter((x) => x.count > 0)}
            xKey="label"
            series={[
              { key: 'avgYellow', label: 'Sarı / maç', color: CHART.yellow },
              { key: 'avgRed', label: 'Kırmızı / maç', color: CHART.red },
            ]}
            height={220}
          />
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <ChartCard title="Kategori bazında maç" subtitle="En sık görev alınan kategoriler">
          <HBars data={a.categories.slice().sort((x, y) => y.count - x.count)} />
        </ChartCard>
        <section className="panel panel-pad">
          <h2 className="mb-4 text-sm font-semibold">Kategori başına kart ortalaması</h2>
          <div className="scrollbar-thin max-h-[340px] overflow-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th className="text-right">Maç</th>
                  <th className="text-right">Sarı</th>
                  <th className="text-right">Kırmızı</th>
                  <th className="text-right">Kart/maç</th>
                </tr>
              </thead>
              <tbody>
                {a.categories.map((c) => (
                  <tr key={c.name}>
                    <td className="font-medium text-white">{c.name}</td>
                    <td className="text-right tabular-nums">{c.count}</td>
                    <td className="text-right tabular-nums">{c.yellowCards}</td>
                    <td className="text-right tabular-nums">{c.redCards}</td>
                    <td className="text-right tabular-nums text-pitch-300">{fmtNum(c.avgCards, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <ChartCard title="Sezon karşılaştırması" subtitle="Sezon başına görev türleri">
          <Bars data={a.seasons} xKey="name" series={ROLE_SERIES} stacked height={240} />
          <div className="scrollbar-thin mt-4 overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Sezon</th>
                  <th className="text-right">Maç</th>
                  <th className="text-right">Orta</th>
                  <th className="text-right">Sarı/maç</th>
                  <th className="text-right">Kırmızı/maç</th>
                </tr>
              </thead>
              <tbody>
                {a.seasons.map((x) => (
                  <tr key={x.name}>
                    <td className="font-medium text-white">{x.name}</td>
                    <td className="text-right tabular-nums">{x.total}</td>
                    <td className="text-right tabular-nums">{x.referee}</td>
                    <td className="text-right tabular-nums">{fmtNum(x.avgYellowPerMatch, 2)}</td>
                    <td className="text-right tabular-nums">{fmtNum(x.avgRedPerMatch, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
        <ChartCard title="Kart trendi" subtitle="Aylık maç başına ortalama kart (sarı + kırmızı)">
          <Lines data={a.monthly.filter((m) => m.count > 0)} xKey="label" series={[{ key: 'avgCards', label: 'Kart / maç', color: CHART.yellow }]} height={240} domain={[0, 'auto']} />
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">Yıllara göre maç yoğunluğu</p>
            <Bars data={a.years} xKey="year" series={[{ key: 'total', label: 'Maç', color: CHART.primary }]} height={160} />
          </div>
        </ChartCard>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="panel panel-pad xl:col-span-2">
          <h2 className="mb-4 text-sm font-semibold">En sık görev alınan takımlar</h2>
          <div className="scrollbar-thin overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Takım</th>
                  <th className="text-right">Maç</th>
                  <th className="text-right">Ev sahibi</th>
                  <th className="text-right">Deplasman</th>
                </tr>
              </thead>
              <tbody>
                {a.topTeams.map((t) => (
                  <tr key={t.name}>
                    <td className="font-medium text-white">{t.name}</td>
                    <td className="text-right tabular-nums">{t.count}</td>
                    <td className="text-right tabular-nums">{t.home}</td>
                    <td className="text-right tabular-nums">{t.away}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <ChartCard title="Haftanın günleri" subtitle="Maçların günlere dağılımı">
          <Bars data={a.weekday} xKey="label" series={[{ key: 'count', label: 'Maç', color: CHART.primary }]} height={220} />
          {a.topCompetitions.length > 0 && (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Organizasyonlar</p>
              <ul className="space-y-1.5 text-sm">
                {a.topCompetitions.map((c) => (
                  <li key={c.name} className="flex justify-between gap-2">
                    <span className="truncate text-slate-300">{c.name}</span>
                    <span className="tabular-nums text-white">{c.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <ChartCard title="Gözlemci puanı trendi" subtitle="Notlara girilen gözlemci puanları (0-10)" empty={a.observerTrend.length === 0}>
          <Lines data={a.observerTrend} xKey="label" series={[{ key: 'score', label: 'Puan', color: CHART.assistant }]} height={240} domain={['auto', 'auto']} />
        </ChartCard>
        <section className="panel panel-pad">
          <h2 className="mb-4 text-sm font-semibold">Hedef ve gerçekleşen</h2>
          {a.goals.length ? (
            <div className="space-y-5">
              {a.goals.map((g) => (
                <div key={g.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-slate-200">
                      {g.title} <span className="text-xs text-slate-500">{g.periodLabel}</span>
                    </span>
                    <span className="tabular-nums text-slate-400">
                      {g.current}/{g.target}
                    </span>
                  </div>
                  <ProgressBar percent={g.percent} achieved={g.achieved} />
                </div>
              ))}
              {a.goals.find((g) => g.timeline.length > 1) && (
                <Lines
                  data={a.goals.find((g) => g.timeline.length > 1)!.timeline}
                  xKey="label"
                  series={[
                    { key: 'cumulative', label: 'Gerçekleşen (kümülatif)', color: CHART.referee },
                    { key: 'target', label: 'Doğrusal hedef', color: CHART.other },
                  ]}
                  dashedKeys={['target']}
                  domain={[0, 'auto']}
                  height={200}
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Henüz hedef yok. Kariyerim sayfasından sezon hedefi ekleyebilirsiniz.</p>
          )}
        </section>
      </div>

      <p className="mt-5 text-xs text-slate-500">
        Durum dağılımı: {a.statusCounts.completed} tamamlandı · {a.statusCounts.scheduled} planlandı · {a.statusCounts.postponed} ertelendi ·{' '}
        {a.statusCounts.cancelled} iptal. Sarı kart toplamı ikinci sarıları içerir; kırmızı toplamı ikinci sarıdan ve doğrudan kırmızıların toplamıdır.
      </p>
    </>
  );
}
