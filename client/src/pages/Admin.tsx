import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Flag, Layers, MessageSquare, Search, ShieldAlert, UserCheck, Users } from 'lucide-react';
import {
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUSES,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPE_LABELS,
  type AccountStatus,
  type FeedbackStatus,
  type FeedbackType,
} from '@refstats/shared';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/Modal';
import { useToast } from '../components/Toast';
import { ErrorBox, Input, LoadingBlock, PageHeader, Pagination, Select, StatCard, Tabs, Textarea } from '../components/ui';
import { api, errorMessage, qs } from '../lib/api';
import { fmtDate, relativeTime } from '../lib/format';

interface Overview {
  users: number;
  activeUsers: number;
  suspendedUsers: number;
  closureRequests: number;
  closedUsers: number;
  demoUsers: number;
  newUsers30: number;
  matches: number;
  matches30: number;
  openFeedback: number;
  systemCategories: number;
}
interface AdminUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: 'USER' | 'ADMIN';
  status: AccountStatus;
  isDemo: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  closureRequestedAt: string | null;
  closureReason: string | null;
  matchCount: number;
}
interface AdminCategory {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  matchCount: number;
}
interface AdminFeedback {
  id: string;
  type: FeedbackType;
  message: string;
  page: string | null;
  status: FeedbackStatus;
  adminNote: string | null;
  createdAt: string;
  user: { username: string; firstName: string; lastName: string } | null;
}

const statusColor: Record<AccountStatus, string> = {
  ACTIVE: 'border-pitch-400/30 text-pitch-300',
  SUSPENDED: 'border-amber-400/30 text-amber-300',
  CLOSURE_REQUESTED: 'border-red-400/30 text-red-300',
  CLOSED: 'border-slate-400/30 text-slate-400',
};

function UsersTab() {
  const { user: me } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);
  const query = qs({ q: search, status, page });
  const users = useQuery({
    queryKey: ['admin', 'users', query],
    queryFn: () => api.get<{ total: number; page: number; pageSize: number; items: AdminUser[] }>(`/admin/users${query}`),
    placeholderData: keepPreviousData,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const setUserStatus = useMutation({
    mutationFn: ({ id, status: s }: { id: string; status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' }) => api.patch(`/admin/users/${id}/status`, { status: s }),
    onSuccess: () => {
      toast.success('Hesap durumu güncellendi');
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/admin/users/${id}`),
    onSuccess: () => {
      toast.success('Hesap ve tüm verileri silindi');
      setToDelete(null);
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <section className="panel panel-pad">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input value={search} onChange={(e) => (setSearch(e.target.value), setPage(1))} placeholder="E-posta, ad veya kullanıcı adı" className="pl-9" aria-label="Kullanıcı ara" />
        </div>
        <Select value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="sm:w-56" aria-label="Durum filtresi">
          <option value="">Tüm durumlar</option>
          {ACCOUNT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ACCOUNT_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>
      {users.isLoading ? (
        <LoadingBlock />
      ) : users.isError ? (
        <ErrorBox message={errorMessage(users.error)} />
      ) : (
        <>
          <div className="scrollbar-thin overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Durum</th>
                  <th className="text-right">Maç</th>
                  <th>Kayıt</th>
                  <th>Son giriş</th>
                  <th className="text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {users.data!.items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <p className="font-medium text-white">
                        {u.firstName} {u.lastName}
                        {u.role === 'ADMIN' && <span className="chip ml-2 border-sky-400/30 text-sky-300">Yönetici</span>}
                        {u.isDemo && <span className="chip ml-2 border-amber-400/30 text-amber-300">Demo</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        @{u.username} · {u.email}
                      </p>
                      {u.closureReason && <p className="mt-1 text-xs text-red-300/80">Kapatma nedeni: {u.closureReason}</p>}
                    </td>
                    <td>
                      <span className={clsx('chip', statusColor[u.status])}>{ACCOUNT_STATUS_LABELS[u.status]}</span>
                    </td>
                    <td className="text-right tabular-nums">{u.matchCount}</td>
                    <td className="whitespace-nowrap text-slate-400">{fmtDate(u.createdAt)}</td>
                    <td className="whitespace-nowrap text-slate-400">{u.lastLoginAt ? relativeTime(u.lastLoginAt) : '—'}</td>
                    <td className="whitespace-nowrap text-right">
                      {u.id !== me?.id && (
                        <div className="flex justify-end gap-1">
                          {u.status === 'ACTIVE' ? (
                            <button className="btn-ghost btn-sm text-amber-300" onClick={() => setUserStatus.mutate({ id: u.id, status: 'SUSPENDED' })}>
                              Askıya al
                            </button>
                          ) : (
                            <button className="btn-ghost btn-sm text-pitch-300" onClick={() => setUserStatus.mutate({ id: u.id, status: 'ACTIVE' })}>
                              Etkinleştir
                            </button>
                          )}
                          {(u.status === 'CLOSURE_REQUESTED' || u.status === 'CLOSED') && (
                            <button className="btn-ghost btn-sm text-red-300" onClick={() => setToDelete(u)}>
                              Kalıcı sil
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={users.data!.page} pageSize={users.data!.pageSize} total={users.data!.total} onChange={setPage} />
        </>
      )}
      <ConfirmDialog
        open={!!toDelete}
        danger
        title="Hesabı kalıcı olarak sil"
        confirmLabel="Kalıcı olarak sil"
        busy={remove.isPending}
        message={
          <>
            <strong className="text-white">{toDelete?.email}</strong> hesabı ve ona ait tüm maçlar, notlar ve hedefler kalıcı olarak silinecek. Bu işlem geri alınamaz.
          </>
        }
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </section>
  );
}

function CategoriesTab() {
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const cats = useQuery({ queryKey: ['admin', 'categories'], queryFn: () => api.get<{ categories: AdminCategory[] }>('/admin/categories').then((r) => r.categories) });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['admin'] }), qc.invalidateQueries({ queryKey: ['categories'] })]);
  const mut = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <section className="panel panel-pad">
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) mut.mutate(() => api.post('/admin/categories', { name, sortOrder: 500, isActive: true }).then(() => setName('')));
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Yeni sistem kategorisi" aria-label="Kategori adı" />
        <button className="btn-primary">Ekle</button>
      </form>
      {cats.isLoading ? (
        <LoadingBlock />
      ) : (
        <table className="table-base">
          <thead>
            <tr>
              <th>Kategori</th>
              <th className="text-right">Sıra</th>
              <th className="text-right">Maç</th>
              <th>Durum</th>
              <th className="text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {cats.data?.map((c) => (
              <tr key={c.id}>
                <td className="font-medium text-white">{c.name}</td>
                <td className="text-right tabular-nums">
                  <input
                    type="number"
                    defaultValue={c.sortOrder}
                    className="input w-20 py-1 text-right"
                    aria-label={`${c.name} sırası`}
                    onBlur={(e) => Number(e.target.value) !== c.sortOrder && mut.mutate(() => api.put(`/admin/categories/${c.id}`, { name: c.name, isActive: c.isActive, sortOrder: Number(e.target.value) }))}
                  />
                </td>
                <td className="text-right tabular-nums">{c.matchCount}</td>
                <td>
                  <button
                    className={clsx('chip', c.isActive ? 'border-pitch-400/30 text-pitch-300' : 'border-slate-400/30 text-slate-400')}
                    onClick={() => mut.mutate(() => api.put(`/admin/categories/${c.id}`, { name: c.name, sortOrder: c.sortOrder, isActive: !c.isActive }))}
                  >
                    {c.isActive ? 'Aktif' : 'Pasif'}
                  </button>
                </td>
                <td className="text-right">
                  {c.matchCount === 0 && (
                    <button className="btn-ghost btn-sm text-red-300" onClick={() => mut.mutate(() => api.del(`/admin/categories/${c.id}`))}>
                      Sil
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-xs text-slate-500">Kullanımda olan kategoriler silinemez; pasif hâle getirildiğinde yeni maçlarda seçilemez, mevcut kayıtlar korunur.</p>
    </section>
  );
}

function FeedbackAdminTab() {
  const toast = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState('OPEN');
  const items = useQuery({
    queryKey: ['admin', 'feedback', status],
    queryFn: () => api.get<{ items: AdminFeedback[] }>(`/admin/feedback${qs({ status })}`).then((r) => r.items),
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const update = useMutation({
    mutationFn: ({ id, s, note }: { id: string; s: FeedbackStatus; note: string | null }) => api.patch(`/admin/feedback/${id}`, { status: s, adminNote: note }),
    onSuccess: () => {
      toast.success('Güncellendi');
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <section className="panel panel-pad">
      <Select value={status} onChange={(e) => setStatus(e.target.value)} className="mb-4 sm:w-56" aria-label="Durum">
        <option value="">Tümü</option>
        {FEEDBACK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {FEEDBACK_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      {items.isLoading ? (
        <LoadingBlock />
      ) : !items.data?.length ? (
        <p className="text-sm text-slate-500">Kayıt yok.</p>
      ) : (
        <ul className="space-y-3">
          {items.data.map((f) => (
            <li key={f.id} className="rounded-xl border border-white/[0.06] bg-ink-850/60 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="chip border-white/10">{FEEDBACK_TYPE_LABELS[f.type]}</span>
                <span>{f.user ? `@${f.user.username}` : 'Silinmiş kullanıcı'}</span>
                <span>· {relativeTime(f.createdAt)}</span>
                {f.page && <span>· {f.page}</span>}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{f.message}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Textarea
                  rows={1}
                  className="min-h-[40px] flex-1"
                  placeholder="Kullanıcıya görünecek yanıt (isteğe bağlı)"
                  value={notes[f.id] ?? f.adminNote ?? ''}
                  onChange={(e) => setNotes({ ...notes, [f.id]: e.target.value })}
                  aria-label="Yanıt notu"
                />
                <Select
                  value={f.status}
                  className="sm:w-40"
                  aria-label="Durum"
                  onChange={(e) => update.mutate({ id: f.id, s: e.target.value as FeedbackStatus, note: (notes[f.id] ?? f.adminNote) || null })}
                >
                  {FEEDBACK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {FEEDBACK_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
                <button className="btn-secondary" onClick={() => update.mutate({ id: f.id, s: f.status, note: (notes[f.id] ?? f.adminNote) || null })}>
                  Kaydet
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Admin() {
  const [tab, setTab] = useState<'users' | 'categories' | 'feedback'>('users');
  const ov = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api.get<Overview>('/admin/overview') });
  return (
    <>
      <PageHeader title="Yönetici paneli" subtitle="Gizlilik gereği yöneticiler kullanıcıların maç içeriklerini ve notlarını göremez; yalnızca sayısal özetler gösterilir." />
      {ov.isError ? (
        <ErrorBox message={errorMessage(ov.error)} />
      ) : (
        ov.data && (
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Kullanıcı" value={ov.data.users} icon={Users} hint={`Son 30 gün +${ov.data.newUsers30}`} />
            <StatCard label="Aktif" value={ov.data.activeUsers} icon={UserCheck} />
            <StatCard label="Askıda" value={ov.data.suspendedUsers} icon={ShieldAlert} accent="yellow" />
            <StatCard label="Kapatma talebi" value={ov.data.closureRequests} icon={ShieldAlert} accent="red" />
            <StatCard label="Toplam maç" value={ov.data.matches} icon={Flag} accent="blue" hint={`Son 30 gün +${ov.data.matches30}`} />
            <StatCard label="Açık geri bildirim" value={ov.data.openFeedback} icon={MessageSquare} accent="slate" />
          </div>
        )
      )}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'users', label: 'Kullanıcılar', icon: Users },
          { value: 'categories', label: 'Kategoriler', icon: Layers },
          { value: 'feedback', label: 'Geri bildirimler', icon: MessageSquare },
        ]}
      />
      {tab === 'users' && <UsersTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'feedback' && <FeedbackAdminTab />}
    </>
  );
}
