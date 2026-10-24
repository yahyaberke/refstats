import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Lock, Pencil, Printer, Trash2 } from 'lucide-react';
import {
  CARD_ENTRY_MODE_LABELS,
  CARD_TYPE_LABELS,
  MATCH_TYPE_LABELS,
  PERSON_TYPE_LABELS,
  type CardType,
} from '@refstats/shared';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/Modal';
import { useToast } from '../components/Toast';
import { ErrorBox, LoadingBlock, ReportBadge, RoleBadge, StatusBadge } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { fmtDateTime, fmtLongDate } from '../lib/format';
import { useInvalidateMatchData } from '../lib/queries';
import type { Match } from '../lib/types';

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-100">{children || '—'}</dd>
    </div>
  );
}

const cardIcon: Record<CardType, ReactNode> = {
  YELLOW: <span className="card-yellow" aria-hidden />,
  SECOND_YELLOW: (
    <span className="inline-flex" aria-hidden>
      <span className="card-yellow" />
      <span className="card-red -ml-1" />
    </span>
  ),
  DIRECT_RED: <span className="card-red" aria-hidden />,
};

export default function MatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const invalidate = useInvalidateMatchData();
  const [confirm, setConfirm] = useState(false);
  const q = useQuery({ queryKey: ['match', id], queryFn: () => api.get<{ match: Match }>(`/matches/${id}`).then((r) => r.match) });
  const del = useMutation({
    mutationFn: () => api.del(`/matches/${id}`),
    onSuccess: async () => {
      await invalidate();
      toast.success('Maç silindi');
      navigate('/app/matches');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <LoadingBlock />;
  if (q.isError) return <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const m = q.data!;
  const notes = m.notes;
  const noteEntries: [string, string | null][] = notes
    ? [
        ['Genel değerlendirme', notes.generalAssessment],
        ['Kendi performansım', notes.selfAssessment],
        ['Zorlandığım pozisyonlar', notes.difficultSituations],
        ['Geliştirmek istediklerim', notes.improvementAreas],
        ['Gözlemci değerlendirmesi', notes.observerEvaluation],
        ['Rapor notları', notes.reportNotes],
        ['Oyuncu değişiklikleri', notes.substitutionNotes],
        ['Sakatlık / duraksamalar', notes.injuryNotes],
        ['Disiplin olayları', notes.disciplineNotes],
      ]
    : [];
  const filledNotes = noteEntries.filter(([, v]) => v);
  const teamName = (t: 'HOME' | 'AWAY' | null) => (t === 'HOME' ? m.homeTeam : t === 'AWAY' ? m.awayTeam : '—');

  return (
    <div className="print-area mx-auto max-w-5xl">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/app/matches" className="btn-ghost -ml-3">
          <ArrowLeft className="h-4 w-4" /> Maçlarım
        </Link>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Yazdır
          </button>
          <Link to={`/app/matches/${m.id}/edit`} className="btn-secondary">
            <Pencil className="h-4 w-4" /> Düzenle
          </Link>
          <button className="btn-secondary hover:text-red-300" onClick={() => setConfirm(true)}>
            <Trash2 className="h-4 w-4" /> Sil
          </button>
        </div>
      </div>

      <section className="panel overflow-hidden">
        <div className="relative px-5 py-7 sm:px-8">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-pitch-500/10 via-transparent to-transparent" />
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{fmtLongDate(m.date)}</span>
            {m.kickoffTime && <span>· {m.kickoffTime}</span>}
            <StatusBadge status={m.status} />
            <RoleBadge role={m.role} />
          </div>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center sm:gap-6">
            <h1 className="text-lg font-semibold sm:text-2xl">{m.homeTeam}</h1>
            <div>
              <p className="font-display text-4xl font-semibold tabular-nums text-pitch-300 sm:text-5xl">
                {m.homeScore ?? '–'}
                <span className="px-2 text-slate-500">:</span>
                {m.awayScore ?? '–'}
              </p>
              {m.halfTimeHome !== null && (
                <p className="mt-1 text-xs text-slate-400">
                  Devre {m.halfTimeHome}-{m.halfTimeAway}
                </p>
              )}
              {m.penaltiesHome !== null && (
                <p className="text-xs text-slate-400">
                  Penaltılar {m.penaltiesHome}-{m.penaltiesAway}
                </p>
              )}
            </div>
            <h1 className="text-lg font-semibold sm:text-2xl">{m.awayTeam}</h1>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/[0.06] px-5 py-5 sm:px-8 md:grid-cols-4">
          <Info label="Kategori">{m.category.name}</Info>
          <Info label="Organizasyon / lig">{m.competition}</Info>
          <Info label="Sezon">{m.season}</Info>
          <Info label="Hafta / tur">{m.round}</Info>
          <Info label="Saha">{m.venue}</Info>
          <Info label="İl / ilçe">{[m.city, m.district].filter(Boolean).join(' / ')}</Info>
          <Info label="Maç türü">{MATCH_TYPE_LABELS[m.matchType]}</Info>
          <Info label="Rapor">
            <ReportBadge status={m.reportStatus} />
          </Info>
          <Info label="Uzatmalar">
            {[
              m.firstHalfAdded !== null || m.secondHalfAdded !== null ? `1. yarı +${m.firstHalfAdded ?? 0} · 2. yarı +${m.secondHalfAdded ?? 0}` : '',
              m.wentToExtraTime ? 'Uzatmalara gitti' : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </Info>
          <Info label="Ek görevler">{m.additionalDuties}</Info>
        </dl>
      </section>

      <section className="panel panel-pad mt-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Kartlar</h2>
          <span className="chip border-white/10 text-slate-400">{CARD_ENTRY_MODE_LABELS[m.cardEntryMode]}</span>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Sarı (toplam)', m.yellowCards, 'text-yellow-300'],
            ['İkinci sarıdan kırmızı', m.secondYellowReds, 'text-orange-300'],
            ['Doğrudan kırmızı', m.directReds, 'text-red-300'],
            ['Kırmızı (toplam)', m.redCards, 'text-red-300'],
          ].map(([l, v, c]) => (
            <div key={l as string} className="rounded-xl border border-white/[0.06] bg-ink-850/60 p-3">
              <p className="text-xs text-slate-400">{l}</p>
              <p className={`font-display text-2xl font-semibold tabular-nums ${c}`}>{v}</p>
            </div>
          ))}
        </div>
        {m.cardEntryMode === 'DETAILED' && m.cards.length > 0 ? (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Dk.</th>
                  <th>Kart</th>
                  <th>Kişi</th>
                  <th>Tür</th>
                  <th>Takım</th>
                  <th>Açıklama</th>
                </tr>
              </thead>
              <tbody>
                {m.cards.map((c, i) => (
                  <tr key={c.id ?? i}>
                    <td className="whitespace-nowrap tabular-nums">
                      {c.minute !== null ? `${c.minute}'` : '—'}
                      {c.addedMinute ? `+${c.addedMinute}` : ''}
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        {cardIcon[c.type]} {CARD_TYPE_LABELS[c.type]}
                      </span>
                    </td>
                    <td>
                      {c.personName || '—'}
                      {c.shirtNumber !== null && <span className="ml-1 text-slate-500">#{c.shirtNumber}</span>}
                    </td>
                    <td className="whitespace-nowrap text-slate-300">{PERSON_TYPE_LABELS[c.personType]}</td>
                    <td className="whitespace-nowrap text-slate-300">{teamName(c.team)}</td>
                    <td className="text-slate-400">{c.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">{m.cardEntryMode === 'SUMMARY' ? 'Bu maç için yalnızca özet kart sayıları kaydedildi.' : 'Bu maçta kart olayı kaydedilmedi.'}</p>
        )}
      </section>

      <section className="panel panel-pad mt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Kişisel notlar</h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5" /> Yalnızca size görünür
          </span>
        </div>
        {notes?.observerScore !== null && notes?.observerScore !== undefined && (
          <p className="mb-4 text-sm text-slate-300">
            Gözlemci puanı: <strong className="font-display text-lg text-pitch-300">{notes.observerScore.toLocaleString('tr-TR')}</strong>
          </p>
        )}
        {filledNotes.length ? (
          <dl className="grid gap-4 md:grid-cols-2">
            {filledNotes.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/[0.06] bg-ink-850/60 p-4">
                <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
                <dd className="mt-1.5 whitespace-pre-wrap text-sm text-slate-200">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-slate-500">
            Not eklenmemiş.{' '}
            <Link to={`/app/matches/${m.id}/edit`} className="no-print text-pitch-300 hover:underline">
              Değerlendirme ekle
            </Link>
          </p>
        )}
      </section>

      <p className="mt-4 text-xs text-slate-500">
        Oluşturulma: {fmtDateTime(m.createdAt)} · Son güncelleme: {fmtDateTime(m.updatedAt)}
      </p>

      <ConfirmDialog
        open={confirm}
        title="Maçı sil"
        danger
        busy={del.isPending}
        confirmLabel="Kalıcı olarak sil"
        message="Bu maç, tüm kart olayları ve notlarıyla birlikte kalıcı olarak silinecek. Bu işlem geri alınamaz."
        onClose={() => setConfirm(false)}
        onConfirm={() => del.mutate()}
      />
    </div>
  );
}
