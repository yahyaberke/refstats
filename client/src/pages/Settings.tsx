import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Database,
  Eye,
  LayoutDashboard,
  Library,
  MessageSquare,
  Monitor,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trash2,
  UserX,
} from 'lucide-react';
import {
  changePasswordSchema,
  DASHBOARD_WIDGET_LABELS,
  DASHBOARD_WIDGETS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPE_LABELS,
  FEEDBACK_TYPES,
  OFFICIAL_ROLE_LABELS,
  OFFICIAL_ROLES,
  type FeedbackType,
  type OfficialRole,
} from '@refstats/shared';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/Modal';
import { useToast } from '../components/Toast';
import { ErrorBox, Field, Input, LoadingBlock, PageHeader, Select, Spinner, Tabs, Textarea, Toggle } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { fmtDateTime, relativeTime } from '../lib/format';
import { useCategories } from '../lib/queries';
import type { FeedbackItem, Me, SessionInfo, Settings } from '../lib/types';
import { apiErrors, zodErrors, type FieldErrors } from '../lib/useForm';

type Tab = 'privacy' | 'security' | 'dashboard' | 'defaults' | 'library' | 'feedback' | 'data' | 'account';

function useSaveSettings() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  return useMutation({
    mutationFn: (patch: Partial<Settings>) => api.put<{ settings: Settings }>('/profile/settings', { ...user!.settings!, ...patch }),
    onSuccess: ({ settings }) => {
      if (user) setUser({ ...user, settings });
      toast.success('Ayarlar kaydedildi');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

function PrivacyTab() {
  const { user } = useAuth();
  const save = useSaveSettings();
  const st = user!.settings!;
  const t = (key: keyof Settings, label: string, description?: string) => (
    <Toggle key={key} label={label} description={description} checked={Boolean(st[key])} disabled={save.isPending || (key !== 'profilePublic' && !st.profilePublic)} onChange={(v) => save.mutate({ [key]: v })} />
  );
  return (
    <section className="panel panel-pad">
      <h2 className="text-base font-semibold">Profil gizliliği</h2>
      <p className="mt-1 text-sm text-slate-400">
        Herkese açık profilde yalnızca seçtiğiniz alanlar görünür. E-posta, lisans/sicil numarası, maç notları, gözlemci değerlendirmeleri ve tek tek maç kayıtları
        <strong className="text-slate-200"> hiçbir zaman</strong> paylaşılmaz.
      </p>
      <div className="mt-4 divide-y divide-white/[0.06]">
        {t('profilePublic', 'Herkese açık profil', `Açıkken profiliniz /u/${user!.username} adresinden görüntülenebilir.`)}
        {t('showPhoto', 'Profil fotoğrafı')}
        {t('showBio', 'Biyografi')}
        {t('showRegion', 'Bölge / il')}
        {t('showOrganization', 'Kurum ve klasman')}
        {t('showStartYear', 'Hakemliğe başlangıç yılı')}
        {t('showStats', 'Toplam görev ve yıllara göre istatistik', 'Görev türü sayıları, toplam kartlar ve yıllık özet.')}
        {t('showCategories', 'Kategori dağılımı')}
        {t('showSeasons', 'Sezon özeti')}
        {t('showBadges', 'Kazanılan rozetler')}
      </div>
    </section>
  );
}

function parseUA(ua: string | null) {
  if (!ua) return 'Bilinmeyen cihaz';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Tarayıcı';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return `${browser}${os ? ` · ${os}` : ''}`;
}

function SecurityTab() {
  const toast = useToast();
  const qc = useQueryClient();
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api.get<{ sessions: SessionInfo[] }>('/auth/sessions').then((r) => r.sessions) });
  const change = useMutation({
    mutationFn: () => api.post('/auth/change-password', pw),
    onSuccess: () => {
      setPw({ currentPassword: '', newPassword: '' });
      toast.success('Parola değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.');
      qc.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (e) => setErrors(apiErrors(e).fields),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.del(`/auth/sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
  const revokeOthers = useMutation({
    mutationFn: () => api.post<{ count: number }>('/auth/sessions/revoke-others'),
    onSuccess: (r) => {
      toast.success(`${r.count} oturum kapatıldı`);
      qc.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = zodErrors(changePasswordSchema, pw);
    if (v) return setErrors(v);
    setErrors({});
    change.mutate();
  };
  return (
    <div className="space-y-5">
      <form onSubmit={submit} noValidate className="panel panel-pad">
        <h2 className="mb-4 text-base font-semibold">Parola değiştir</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mevcut parola" error={errors.currentPassword}>
            {(id, d) => <Input id={id} type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} invalid={!!errors.currentPassword} aria-describedby={d} />}
          </Field>
          <Field label="Yeni parola" error={errors.newPassword} hint="En az 8 karakter; harf ve rakam içermeli.">
            {(id, d) => <Input id={id} type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} invalid={!!errors.newPassword} aria-describedby={d} />}
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="btn-primary" disabled={change.isPending}>
            {change.isPending && <Spinner />} Parolayı güncelle
          </button>
        </div>
      </form>

      <section className="panel panel-pad">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Açık oturumlar</h2>
            <p className="text-xs text-slate-400">Tanımadığınız bir oturum görürseniz kapatın ve parolanızı değiştirin.</p>
          </div>
          <button className="btn-secondary btn-sm" onClick={() => revokeOthers.mutate()} disabled={revokeOthers.isPending}>
            Diğer tüm oturumları kapat
          </button>
        </div>
        {sessions.isLoading ? (
          <LoadingBlock />
        ) : sessions.isError ? (
          <ErrorBox message={errorMessage(sessions.error)} />
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {sessions.data!.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <Monitor className="h-5 w-5 text-slate-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white">
                    {parseUA(s.userAgent)} {s.current && <span className="chip ml-1 border-pitch-400/30 text-pitch-300">Bu cihaz</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    Açılış: {fmtDateTime(s.createdAt)} · Son kullanım: {relativeTime(s.lastUsedAt)}
                  </p>
                </div>
                {!s.current && (
                  <button className="btn-ghost btn-sm hover:text-red-300" onClick={() => revoke.mutate(s.id)}>
                    Kapat
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DashboardTab() {
  const { user } = useAuth();
  const save = useSaveSettings();
  const current = user!.settings!.dashboardWidgets;
  return (
    <section className="panel panel-pad">
      <h2 className="text-base font-semibold">Dashboard'u kişiselleştir</h2>
      <p className="mt-1 text-sm text-slate-400">Panelde görmek istediğiniz bölümleri seçin.</p>
      <div className="mt-4 divide-y divide-white/[0.06]">
        {DASHBOARD_WIDGETS.map((w) => (
          <Toggle
            key={w}
            label={DASHBOARD_WIDGET_LABELS[w]}
            checked={current.includes(w)}
            disabled={save.isPending}
            onChange={(on) => save.mutate({ dashboardWidgets: on ? DASHBOARD_WIDGETS.filter((x) => x === w || current.includes(x)) : current.filter((x) => x !== w) })}
          />
        ))}
      </div>
    </section>
  );
}

function DefaultsTab() {
  const { user } = useAuth();
  const save = useSaveSettings();
  const categories = useCategories();
  const qc = useQueryClient();
  const toast = useToast();
  const st = user!.settings!;
  const [competition, setCompetition] = useState(st.defaultCompetition ?? '');
  const [newCat, setNewCat] = useState('');
  const addCat = useMutation({
    mutationFn: () => api.post('/categories', { name: newCat }),
    onSuccess: () => {
      setNewCat('');
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Kategori eklendi');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const delCat = useMutation({
    mutationFn: (id: string) => api.del(`/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-5">
      <section className="panel panel-pad">
        <h2 className="text-base font-semibold">Maç formu varsayılanları</h2>
        <p className="mt-1 text-sm text-slate-400">Yeni maç formu bu değerlerle açılır. Boş bırakırsanız en sık kullandıklarınız seçilir.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Varsayılan görev">
            {(id) => (
              <Select id={id} value={st.defaultRole ?? ''} onChange={(e) => save.mutate({ defaultRole: (e.target.value || null) as OfficialRole | null })}>
                <option value="">En sık kullanılan</option>
                {OFFICIAL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {OFFICIAL_ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Varsayılan kategori">
            {(id) => (
              <Select id={id} value={st.defaultCategoryId ?? ''} onChange={(e) => save.mutate({ defaultCategoryId: e.target.value || null })}>
                <option value="">En sık kullanılan</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Varsayılan organizasyon">
            {(id) => <Input id={id} value={competition} onChange={(e) => setCompetition(e.target.value)} onBlur={() => competition !== (st.defaultCompetition ?? '') && save.mutate({ defaultCompetition: competition || null })} />}
          </Field>
        </div>
      </section>
      <section className="panel panel-pad">
        <h2 className="text-base font-semibold">Özel kategoriler</h2>
        <p className="mt-1 text-sm text-slate-400">Sistem kategorileri dışında kendi kategorilerinizi ekleyin (ör. “Okul Ligi”, “Kadınlar Ligi”).</p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newCat.trim()) addCat.mutate();
          }}
        >
          <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Kategori adı" maxLength={60} aria-label="Yeni kategori adı" />
          <button className="btn-primary" disabled={addCat.isPending || !newCat.trim()}>
            Ekle
          </button>
        </form>
        <ul className="mt-4 flex flex-wrap gap-2">
          {categories.data
            ?.filter((c) => c.custom)
            .map((c) => (
              <li key={c.id} className="chip border-white/10 py-1 text-slate-200">
                {c.name}
                <button className="ml-1 text-slate-500 hover:text-red-300" onClick={() => delCat.mutate(c.id)} aria-label={`${c.name} kategorisini sil`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}

interface LibraryData {
  teams: { id: string; name: string; isFavorite: boolean; matches: number }[];
  venues: { id: string; name: string; city: string | null; district: string | null; isFavorite: boolean; matches: number }[];
}

function LibraryTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const lib = useQuery({ queryKey: ['library'], queryFn: () => api.get<LibraryData>('/library') });
  const [team, setTeam] = useState('');
  const [venue, setVenue] = useState('');
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['library'] }), qc.invalidateQueries({ queryKey: ['suggestions'] })]);
  const mut = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (lib.isLoading) return <LoadingBlock />;
  if (lib.isError) return <ErrorBox message={errorMessage(lib.error)} />;
  const list = (kind: 'teams' | 'venues') => {
    const items = lib.data![kind];
    return (
      <ul className="scrollbar-thin mt-4 max-h-[420px] divide-y divide-white/[0.05] overflow-y-auto">
        {items.length === 0 && <li className="py-3 text-sm text-slate-500">Henüz kayıt yok. Maç ekledikçe otomatik dolar.</li>}
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 py-2.5">
            <button
              className={clsx('rounded p-1', it.isFavorite ? 'text-yellow-300' : 'text-slate-600 hover:text-slate-300')}
              onClick={() => mut.mutate(() => api.patch(`/library/${kind}/${it.id}`, { isFavorite: !it.isFavorite }))}
              aria-label={it.isFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
              aria-pressed={it.isFavorite}
            >
              <Star className="h-4 w-4" fill={it.isFavorite ? 'currentColor' : 'none'} />
            </button>
            <span className="min-w-0 flex-1 truncate text-sm text-white">
              {it.name}
              {'city' in it && it.city && <span className="ml-2 text-xs text-slate-500">{[it.city, it.district].filter(Boolean).join(' / ')}</span>}
            </span>
            <span className="text-xs tabular-nums text-slate-500">{it.matches} maç</span>
            {(kind === 'venues' || it.matches === 0) && (
              <button className="btn-ghost btn-sm hover:text-red-300" onClick={() => mut.mutate(() => api.del(`/library/${kind}/${it.id}`))} aria-label={`${it.name} sil`}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    );
  };
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="panel panel-pad">
        <h2 className="text-base font-semibold">Takımlar</h2>
        <p className="mt-1 text-xs text-slate-400">Favori takımlar maç formunda tek dokunuşla seçilir.</p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (team.trim()) mut.mutate(() => api.post('/library/teams', { name: team, isFavorite: true }).then(() => setTeam('')));
          }}
        >
          <Input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Favori takım ekle" aria-label="Takım adı" />
          <button className="btn-secondary">Ekle</button>
        </form>
        {list('teams')}
      </section>
      <section className="panel panel-pad">
        <h2 className="text-base font-semibold">Sahalar</h2>
        <p className="mt-1 text-xs text-slate-400">Saha seçildiğinde il/ilçe otomatik dolar.</p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (venue.trim()) mut.mutate(() => api.post('/library/venues', { name: venue, isFavorite: true }).then(() => setVenue('')));
          }}
        >
          <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Favori saha ekle" aria-label="Saha adı" />
          <button className="btn-secondary">Ekle</button>
        </form>
        {list('venues')}
      </section>
    </div>
  );
}

function FeedbackTab() {
  const toast = useToast();
  const qc = useQueryClient();
  const [type, setType] = useState<FeedbackType>('SUGGESTION');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const items = useQuery({ queryKey: ['feedback'], queryFn: () => api.get<{ items: FeedbackItem[] }>('/feedback').then((r) => r.items) });
  const send = useMutation({
    mutationFn: () => api.post('/feedback', { type, message, page: window.location.pathname }),
    onSuccess: () => {
      setMessage('');
      toast.success('Geri bildiriminiz iletildi. Teşekkürler!');
      qc.invalidateQueries({ queryKey: ['feedback'] });
    },
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form
        className="panel panel-pad space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (message.trim().length < 10) return setError('Mesaj en az 10 karakter olmalı');
          setError(null);
          send.mutate();
        }}
      >
        <h2 className="text-base font-semibold">Geri bildirim gönder</h2>
        <Field label="Tür">
          {(id) => (
            <Select id={id} value={type} onChange={(e) => setType(e.target.value as FeedbackType)}>
              {FEEDBACK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FEEDBACK_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Mesaj" error={error ?? undefined} hint="Kişisel verilerinizi (sicil no vb.) paylaşmamanızı öneririz.">
          {(id, d) => <Textarea id={id} rows={5} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} invalid={!!error} aria-describedby={d} />}
        </Field>
        <div className="flex justify-end">
          <button className="btn-primary" disabled={send.isPending}>
            {send.isPending && <Spinner />} Gönder
          </button>
        </div>
      </form>
      <section className="panel panel-pad">
        <h2 className="mb-4 text-base font-semibold">Gönderdiklerim</h2>
        {items.data?.length ? (
          <ul className="space-y-3">
            {items.data.map((f) => (
              <li key={f.id} className="rounded-xl border border-white/[0.06] bg-ink-850/60 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="chip border-white/10">{FEEDBACK_TYPE_LABELS[f.type]}</span>
                  <span className={clsx('chip', f.status === 'RESOLVED' ? 'border-pitch-400/30 text-pitch-300' : 'border-white/10')}>{FEEDBACK_STATUS_LABELS[f.status]}</span>
                  <span>{relativeTime(f.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{f.message}</p>
                {f.adminNote && <p className="mt-2 rounded-lg bg-pitch-500/10 px-3 py-2 text-xs text-pitch-100">Yanıt: {f.adminNote}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Henüz geri bildirim göndermediniz.</p>
        )}
      </section>
    </div>
  );
}

function DataTab() {
  return (
    <section className="panel panel-pad space-y-4">
      <h2 className="text-base font-semibold">Yedekleme ve dışa aktarma</h2>
      <p className="text-sm text-slate-400">Verileriniz size aittir. İstediğiniz zaman indirebilirsiniz.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <a href="/api/matches/export.csv" className="rounded-xl border border-white/[0.08] bg-ink-850/60 p-4 transition hover:border-pitch-400/30">
          <p className="font-medium text-white">Maçlar (CSV)</p>
          <p className="mt-1 text-xs text-slate-400">Excel/Google E-Tablolar ile açılabilir. Tüm maçlar ve kart toplamları.</p>
        </a>
        <a href="/api/profile/export" className="rounded-xl border border-white/[0.08] bg-ink-850/60 p-4 transition hover:border-pitch-400/30">
          <p className="font-medium text-white">Tam yedek (JSON)</p>
          <p className="mt-1 text-xs text-slate-400">Profil, ayarlar, maçlar, kart olayları, notlar, hedefler, takım ve saha listeleri.</p>
        </a>
      </div>
      <p className="text-xs text-slate-500">JSON yedeği özel notlarınızı ve sicil numaranızı içerir; güvenli bir yerde saklayın.</p>
    </section>
  );
}

function AccountTab() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useMutation({
    mutationFn: () => api.post<{ user: Me }>('/profile/closure-request', { password, reason: reason || null }),
    onSuccess: ({ user: u }) => {
      setUser(u);
      setConfirm(false);
      setPassword('');
      toast.info('Hesap kapatma talebiniz alındı');
    },
    onError: (e) => {
      setConfirm(false);
      setError(apiErrors(e).fields.password ?? errorMessage(e));
    },
  });
  const cancel = useMutation({
    mutationFn: () => api.del<{ user: Me }>('/profile/closure-request'),
    onSuccess: ({ user: u }) => {
      setUser(u);
      toast.success('Kapatma talebi geri çekildi');
    },
  });
  if (user!.status === 'CLOSURE_REQUESTED') {
    return (
      <section className="panel panel-pad">
        <h2 className="text-base font-semibold">Hesap kapatma talebi bekliyor</h2>
        <p className="mt-2 text-sm text-slate-400">
          Talebiniz {user!.closureRequestedAt ? fmtDateTime(user!.closureRequestedAt) : ''} tarihinde oluşturuldu. Yönetici onayıyla hesabınız ve tüm verileriniz kalıcı olarak silinecek.
        </p>
        <button className="btn-secondary mt-4" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
          Talebi geri çek
        </button>
      </section>
    );
  }
  return (
    <section className="panel panel-pad border-red-400/15">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <UserX className="h-4 w-4 text-red-300" /> Hesabı kapat
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        Talep oluşturduğunuzda hesabınız “kapatma talebi” durumuna geçer. Yönetici onayından sonra tüm maçlarınız, notlarınız ve profiliniz kalıcı olarak silinir.
        Onaya kadar talebi geri çekebilirsiniz. Öncesinde “Veri” sekmesinden yedek almanızı öneririz.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Parolanız" error={error ?? undefined}>
          {(id, d) => <Input id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => (setPassword(e.target.value), setError(null))} invalid={!!error} aria-describedby={d} />}
        </Field>
        <Field label="Neden (isteğe bağlı)">
          {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />}
        </Field>
      </div>
      <button className="btn-danger mt-4" disabled={!password} onClick={() => setConfirm(true)}>
        Kapatma talebi oluştur
      </button>
      <ConfirmDialog
        open={confirm}
        danger
        title="Hesap kapatma talebi"
        confirmLabel="Talebi gönder"
        busy={request.isPending}
        message="Talebiniz onaylandığında tüm verileriniz kalıcı olarak silinecek. Devam etmek istiyor musunuz?"
        onClose={() => setConfirm(false)}
        onConfirm={() => request.mutate()}
      />
    </section>
  );
}

const TABS: { value: Tab; label: string; icon: typeof Eye }[] = [
  { value: 'privacy', label: 'Gizlilik', icon: Eye },
  { value: 'security', label: 'Güvenlik', icon: ShieldCheck },
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { value: 'defaults', label: 'Varsayılanlar', icon: SlidersHorizontal },
  { value: 'library', label: 'Takım & saha', icon: Library },
  { value: 'feedback', label: 'Geri bildirim', icon: MessageSquare },
  { value: 'data', label: 'Veri', icon: Database },
  { value: 'account', label: 'Hesap', icon: UserX },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.value === params.get('tab'))?.value ?? 'privacy') as Tab;
  if (!user?.settings) return <LoadingBlock />;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Ayarlar" />
      <Tabs tabs={TABS} value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} />
      <div role="tabpanel" className="animate-fade-up" key={tab}>
        {tab === 'privacy' && <PrivacyTab />}
        {tab === 'security' && <SecurityTab />}
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'defaults' && <DefaultsTab />}
        {tab === 'library' && <LibraryTab />}
        {tab === 'feedback' && <FeedbackTab />}
        {tab === 'data' && <DataTab />}
        {tab === 'account' && <AccountTab />}
      </div>
    </div>
  );
}
