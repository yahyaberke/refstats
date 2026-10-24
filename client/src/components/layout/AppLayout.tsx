import clsx from 'clsx';
import {
  BarChart3,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Menu,
  PlusCircle,
  Settings,
  ShieldCheck,
  Trophy,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Logo } from '../Logo';
import { Avatar } from '../ui';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/matches', label: 'Maçlarım', icon: ListOrdered, end: true },
  { to: '/app/matches/new', label: 'Yeni Maç', icon: PlusCircle, end: true },
  { to: '/app/stats', label: 'İstatistikler', icon: BarChart3 },
  { to: '/app/calendar', label: 'Takvim', icon: CalendarDays },
  { to: '/app/career', label: 'Kariyerim', icon: Trophy },
  { to: '/app/profile', label: 'Profil', icon: UserRound },
  { to: '/app/settings', label: 'Ayarlar', icon: Settings },
];

function readCollapsed() {
  try {
    return localStorage.getItem('rs.sidebar') === 'collapsed';
  } catch {
    return false;
  }
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => setDrawer(false), [location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem('rs.sidebar', collapsed ? 'collapsed' : 'open');
    } catch {
      /* depolama kapalı olabilir */
    }
  }, [collapsed]);

  // Klavye kısayolu: "N" → yeni maç (yazı alanlarında devre dışı).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        navigate('/app/matches/new');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navigate]);

  if (!user) return null;
  const items = user.role === 'ADMIN' ? [...NAV, { to: '/app/admin', label: 'Yönetici', icon: ShieldCheck }] : NAV;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navList = (compact: boolean) => (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Ana menü">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          title={compact ? label : undefined}
          className={({ isActive }) =>
            clsx(
              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              compact && 'justify-center px-0',
              isActive
                ? 'bg-pitch-500/[0.12] text-pitch-300 ring-1 ring-inset ring-pitch-400/20'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100',
            )
          }
        >
          <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
          {!compact && <span>{label}</span>}
        </NavLink>
      ))}
    </nav>
  );

  const userBox = (compact: boolean) => (
    <div className={clsx('mt-4 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5', compact && 'flex-col p-2')}>
      <Avatar url={user.avatarUrl} first={user.firstName} last={user.lastName} size={34} />
      {!compact && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate text-xs text-slate-500">@{user.username}</p>
        </div>
      )}
      <button onClick={handleLogout} className="btn-ghost btn-sm" aria-label="Çıkış yap" title="Çıkış yap">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-pitch-500 focus:px-3 focus:py-2 focus:text-ink-950">
        İçeriğe geç
      </a>
      {/* Masaüstü kenar çubuğu */}
      <aside
        className={clsx(
          'no-print sticky top-0 hidden h-screen shrink-0 flex-col border-r border-white/[0.06] bg-ink-900/70 p-3 backdrop-blur transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[76px]' : 'w-[248px]',
        )}
      >
        <div className={clsx('mb-6 flex items-center px-1.5 pt-1.5', collapsed ? 'justify-center' : 'justify-between')}>
          <NavLink to="/app" aria-label="RefStats ana sayfa">
            <Logo compact={collapsed} />
          </NavLink>
        </div>
        {navList(collapsed)}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={clsx('btn-ghost btn-sm mt-2', collapsed ? 'justify-center' : 'justify-start')}
          aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!collapsed && 'Daralt'}
        </button>
        {userBox(collapsed)}
      </aside>

      {/* Mobil üst çubuk */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-ink-950/85 px-4 py-3 backdrop-blur lg:hidden">
        <NavLink to="/app" aria-label="RefStats ana sayfa">
          <Logo />
        </NavLink>
        <button className="btn-ghost btn-sm" onClick={() => setDrawer(true)} aria-label="Menüyü aç">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menü">
          <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <div className="absolute right-0 top-0 flex h-full w-[280px] animate-fade-up flex-col border-l border-white/[0.06] bg-ink-900 p-4">
            <div className="mb-5 flex items-center justify-between">
              <Logo />
              <button className="btn-ghost btn-sm" onClick={() => setDrawer(false)} aria-label="Menüyü kapat">
                <X className="h-5 w-5" />
              </button>
            </div>
            {navList(false)}
            {userBox(false)}
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        {user.isDemo && (
          <div className="no-print border-b border-amber-400/20 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-200">
            Demo hesabındasınız. Veriler örnektir ve demo komutu her çalıştırıldığında sıfırlanır.
          </div>
        )}
        {user.status === 'CLOSURE_REQUESTED' && (
          <div className="no-print border-b border-red-400/20 bg-red-500/10 px-4 py-2 text-center text-xs text-red-200">
            Hesap kapatma talebiniz alındı. Vazgeçmek için Ayarlar → Hesap bölümünü kullanabilirsiniz.
          </div>
        )}
        <main id="main" className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          <Outlet />
        </main>
      </div>

      {/* Mobil alt gezinme: en sık kullanılan sayfalar + hızlı maç ekleme */}
      <nav className="no-print pb-safe fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/[0.06] bg-ink-950/95 px-2 pt-2 backdrop-blur lg:hidden" aria-label="Hızlı menü">
        {[
          { to: '/app', label: 'Panel', icon: LayoutDashboard, end: true },
          { to: '/app/matches', label: 'Maçlar', icon: ListOrdered, end: true },
          { to: '/app/matches/new', label: 'Ekle', icon: PlusCircle, end: true, primary: true },
          { to: '/app/stats', label: 'İstatistik', icon: BarChart3 },
          { to: '/app/calendar', label: 'Takvim', icon: CalendarDays },
        ].map(({ to, label, icon: Icon, end, primary }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx('flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium', isActive ? 'text-pitch-300' : 'text-slate-400')
            }
          >
            {primary ? (
              <span className="-mt-5 rounded-2xl bg-pitch-500 p-3 text-ink-950 shadow-glow">
                <Icon className="h-5 w-5" />
              </span>
            ) : (
              <Icon className="h-5 w-5" />
            )}
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
