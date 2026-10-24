import { useQuery } from '@tanstack/react-query';
import { MapPin, Printer, Trophy, UserX } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Bars, CHART, HBars, ROLE_SERIES, ShareBar } from '../components/charts';
import { Logo } from '../components/Logo';
import { Avatar, EmptyState, LoadingBlock, StatCard } from '../components/ui';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';
import type { PublicProfile as PublicProfileData } from '../lib/types';

export default function PublicProfile() {
  const { username } = useParams();
  const q = useQuery({
    queryKey: ['public', username],
    queryFn: () => api.get<PublicProfileData>(`/public/profiles/${encodeURIComponent(username ?? '')}`),
    retry: false,
  });

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6">
      <header className="no-print mb-8 flex items-center justify-between">
        <Link to="/" aria-label="RefStats ana sayfa">
          <Logo />
        </Link>
        {q.data && (
          <button className="btn-secondary btn-sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Yazdır / PDF
          </button>
        )}
      </header>
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError || !q.data ? (
        <div className="panel">
          <EmptyState icon={UserX} title="Profil bulunamadı" description="Bu profil mevcut değil ya da sahibi tarafından gizli tutuluyor." />
        </div>
      ) : (
        <div className="print-area space-y-5">
          <section className="panel flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:p-8 sm:text-left">
            <Avatar url={q.data.profile.avatarUrl} first={q.data.profile.firstName} last={q.data.profile.lastName} size={96} />
            <div className="flex-1">
              <h1 className="text-2xl font-semibold sm:text-3xl">
                {q.data.profile.firstName} {q.data.profile.lastName}
              </h1>
              <p className="text-sm text-slate-400">@{q.data.profile.username}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-3 text-sm text-slate-300 sm:justify-start">
                {q.data.profile.region && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-slate-500" /> {q.data.profile.region}
                  </span>
                )}
                {q.data.profile.classification && <span>{q.data.profile.classification}</span>}
                {q.data.profile.organization && <span>{q.data.profile.organization}</span>}
                {q.data.profile.startYear && <span>{q.data.profile.startYear}'den beri hakem</span>}
              </div>
              {q.data.profile.bio && <p className="mt-3 max-w-2xl text-sm text-slate-300">{q.data.profile.bio}</p>}
            </div>
          </section>

          {q.data.stats && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard label="Toplam görev" value={q.data.stats.total} />
                <StatCard label="Orta hakem" value={q.data.stats.referee} />
                <StatCard label="Yardımcı hakem" value={q.data.stats.assistant} accent="blue" />
                <StatCard label="Dördüncü hakem" value={q.data.stats.fourth} accent="slate" />
              </div>
              <div className="grid gap-5 lg:grid-cols-3">
                <section className="panel panel-pad lg:col-span-2">
                  <h2 className="mb-4 text-sm font-semibold">Yıllara göre görevler</h2>
                  <Bars data={q.data.stats.yearHistory} xKey="year" series={ROLE_SERIES} stacked height={240} />
                  {q.data.stats.firstMatchDate && <p className="mt-2 text-xs text-slate-500">İlk kayıtlı görev: {fmtDate(q.data.stats.firstMatchDate)}</p>}
                </section>
                <section className="panel panel-pad">
                  <h2 className="mb-4 text-sm font-semibold">Görev dağılımı</h2>
                  <ShareBar
                    items={[
                      { label: 'Orta hakem', value: q.data.stats.referee, color: CHART.referee },
                      { label: 'Yardımcı hakem', value: q.data.stats.assistant, color: CHART.assistant },
                      { label: 'Dördüncü hakem', value: q.data.stats.fourth, color: CHART.fourth },
                      { label: 'Diğer', value: q.data.stats.other, color: CHART.other },
                    ]}
                  />
                </section>
              </div>
            </>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {q.data.categories && q.data.categories.length > 0 && (
              <section className="panel panel-pad">
                <h2 className="mb-4 text-sm font-semibold">Kategoriler</h2>
                <HBars data={q.data.categories} />
              </section>
            )}
            {q.data.seasons && q.data.seasons.length > 0 && (
              <section className="panel panel-pad">
                <h2 className="mb-4 text-sm font-semibold">Sezonlar</h2>
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Sezon</th>
                      <th className="text-right">Toplam</th>
                      <th className="text-right">Orta</th>
                      <th className="text-right">Yardımcı</th>
                      <th className="text-right">4. hakem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.seasons.map((s) => (
                      <tr key={s.name}>
                        <td className="font-medium text-white">{s.name}</td>
                        <td className="text-right tabular-nums">{s.total}</td>
                        <td className="text-right tabular-nums">{s.referee}</td>
                        <td className="text-right tabular-nums">{s.assistant}</td>
                        <td className="text-right tabular-nums">{s.fourth}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </div>

          {q.data.badges && q.data.badges.length > 0 && (
            <section className="panel panel-pad">
              <h2 className="mb-4 text-sm font-semibold">Rozetler</h2>
              <ul className="flex flex-wrap gap-2">
                {q.data.badges.map((b) => (
                  <li key={b.id} className="chip border-pitch-400/30 bg-pitch-500/10 py-1 text-pitch-200" title={b.description}>
                    <Trophy className="h-3.5 w-3.5" /> {b.title}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="text-center text-xs text-slate-500">
            Bu profil, kullanıcının RefStats'a kendi girdiği kayıtlardan oluşturulmuştur ve resmî bir kurum belgesi değildir.
          </p>
        </div>
      )}
    </div>
  );
}
