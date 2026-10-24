import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Download,
  Lock,
  ShieldCheck,
  Smartphone,
  Target,
  Timer,
  Trophy,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';

const FEATURES = [
  { icon: Timer, title: 'Maçı 1 dakikada kaydet', text: 'Akıllı form son maçı kopyalar, takım ve sahaları hatırlar, taslağını otomatik saklar.' },
  { icon: ClipboardList, title: 'Olay bazlı kart kaydı', text: 'Sarı, ikinci sarıdan kırmızı ve doğrudan kırmızı ayrı tutulur; toplamlar otomatik hesaplanır.' },
  { icon: BarChart3, title: 'Gerçek istatistikler', text: 'Görev, kategori ve sezon bazında kart ortalamaları, yoğunluk ve trendler — tamamı kendi kayıtlarından.' },
  { icon: CalendarDays, title: 'Kişisel takvim', text: 'Geçmiş ve planladığın maçları aylık/haftalık görünümde takip et.' },
  { icon: Target, title: 'Hedefler ve rozetler', text: 'Sezonluk maç hedefi koy, ilerlemeni grafikle izle, kilometre taşlarında rozet kazan.' },
  { icon: Trophy, title: 'Kariyer özeti ve CV', text: 'Yıllara göre hakemlik geçmişin; paylaşmak istediğin kadarını herkese açık profile ekle.' },
];

function PreviewBars() {
  const bars = [4, 6, 3, 7, 5, 8, 6, 9, 7, 5, 8, 10];
  return (
    <div className="flex h-28 items-end gap-1.5">
      {bars.map((h, i) => (
        <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-pitch-700 to-pitch-400" style={{ height: `${h * 10}%`, opacity: 0.55 + i * 0.035 }} />
      ))}
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link to="/login" className="btn-ghost">
            Giriş yap
          </Link>
          <Link to="/register" className="btn-primary hidden sm:inline-flex">
            Ücretsiz başla
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
        <div className="animate-fade-up">
          <span className="chip border-pitch-400/30 bg-pitch-500/10 text-pitch-300">Hakemler için kişisel analitik</span>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-[56px]">
            Her düdüğün <span className="bg-gradient-to-r from-pitch-300 to-emerald-200 bg-clip-text text-transparent">kaydı</span>,
            <br />
            kariyerinin verisi.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
            RefStats; görev aldığın maçları, kart kararlarını ve gelişim notlarını tek yerde toplar. Sezonunu, kategorilerini ve
            performans trendini profesyonel grafiklerle gör.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/register" className="btn-primary px-6 py-3 text-base">
              Hesap oluştur <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/login" className="btn-secondary px-6 py-3 text-base">
              Hesabım var
            </Link>
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5" /> Verilerin yalnızca sana aittir. Profilin varsayılan olarak gizlidir.
          </p>
        </div>

        {/* Örnek ekran: gerçek kullanıcı verisi değildir */}
        <div className="relative animate-fade-up [animation-delay:120ms]" aria-label="Örnek panel görünümü">
          <div className="absolute -inset-6 -z-10 rounded-[32px] bg-pitch-500/10 blur-3xl" />
          <div className="panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">2025-2026 Sezonu</p>
              <span className="chip border-white/10 text-slate-400">Örnek görünüm</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Toplam maç', '38'],
                ['Orta hakem', '24'],
                ['Kart / maç', '3,4'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-white/[0.06] bg-ink-850 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{k}</p>
                  <p className="mt-1 font-display text-2xl font-semibold text-white">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-white/[0.06] bg-ink-850 p-4">
              <p className="mb-3 text-xs text-slate-400">Aylık maç dağılımı</p>
              <PreviewBars />
            </div>
            <div className="mt-4 space-y-2">
              {[
                ['Yeşilvadi FK – Kuzeyspor', 'Orta', '2 - 1', 3, 0],
                ['Liman Gücü – Kayalar SK', 'YH1', '0 - 0', 2, 1],
              ].map(([m, r, s, y, red]) => (
                <div key={m as string} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-ink-850 px-3 py-2.5 text-sm">
                  <span className="truncate text-slate-200">{m}</span>
                  <span className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="chip border-pitch-400/30 text-pitch-300">{r}</span>
                    <span className="tabular-nums">{s}</span>
                    <span className="flex items-center gap-1">
                      <span className="card-yellow" />
                      {y}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="card-red" />
                      {red}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-semibold sm:text-3xl">Sahada sen, kayıtta RefStats</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-400">
          Amatör liglerden altyapıya kadar görev alan hakemlerin günlük ihtiyacına göre tasarlandı.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="panel panel-pad transition hover:border-pitch-400/20">
              <span className="inline-flex rounded-xl bg-pitch-500/10 p-2.5 text-pitch-300">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { icon: ShieldCheck, title: 'Gizlilik öncelikli', text: 'Sicil numaran, notların ve gözlemci değerlendirmelerin asla herkese açık olmaz.' },
            { icon: Smartphone, title: 'Mobilde hızlı', text: 'Maç sonrası soyunma odasında telefondan kayıt; bağlantı koparsa taslağın kaybolmaz.' },
            { icon: Download, title: 'Verin senin', text: 'Maçlarını CSV, tüm hesabını JSON yedeği olarak istediğin an indir.' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4 rounded-2xl border border-white/[0.06] p-5">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-pitch-400" />
              <div>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-400">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="panel relative overflow-hidden p-8 text-center sm:p-12">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-pitch-500/15 via-transparent to-sky-500/10" />
          <h2 className="text-2xl font-semibold sm:text-3xl">Bu sezonun hikâyesini kaydetmeye başla</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">Ücretsiz hesap oluştur, ilk maçını ekle, istatistiklerin anında oluşsun.</p>
          <Link to="/register" className="btn-primary mt-7 px-6 py-3 text-base">
            Ücretsiz başla <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl border-t border-white/[0.06] px-4 py-8 text-xs text-slate-500 sm:px-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row">
          <Logo />
          <p className="max-w-xl sm:text-right">
            RefStats bağımsız, kişisel bir kayıt aracıdır. Herhangi bir federasyon, il temsilciliği veya resmî atama sistemiyle
            bağlantısı yoktur; yalnızca kullanıcının kendi girdiği bilgilerle çalışır.
          </p>
        </div>
      </footer>
    </div>
  );
}
