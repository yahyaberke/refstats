import { useMutation } from '@tanstack/react-query';
import { Camera, Lock, Trash2 } from 'lucide-react';
import { profileSchema, startYearFromLicense } from '@refstats/shared';
import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { Avatar, Field, Input, PageHeader, Spinner, Textarea } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import type { Me } from '../lib/types';
import { apiErrors, zodErrors, type FieldErrors } from '../lib/useForm';

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState(() => ({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    username: user?.username ?? '',
    region: user?.region ?? '',
    organization: user?.organization ?? '',
    classification: user?.classification ?? '',
    startYear: user?.startYear ? String(user.startYear) : '',
    licenseNumber: user?.licenseNumber ?? '',
    bio: user?.bio ?? '',
  }));
  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(({ [k]: _drop, ...rest }) => rest);
  };

  const save = useMutation({
    mutationFn: (payload: unknown) => api.patch<{ user: Me }>('/profile', payload),
    onSuccess: ({ user: u }) => {
      setUser(u);
      toast.success('Profil kaydedildi');
    },
    onError: (e) => {
      const { fields, message } = apiErrors(e);
      setErrors(fields);
      toast.error(message);
    },
  });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('avatar', file);
      return api.post<{ user: Me }>('/profile/avatar', fd);
    },
    onSuccess: ({ user: u }) => {
      setUser(u);
      toast.success('Profil fotoğrafı güncellendi');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const removeAvatar = useMutation({
    mutationFn: () => api.del<{ user: Me }>('/profile/avatar'),
    onSuccess: ({ user: u }) => setUser(u),
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!user) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const payload = { ...form, startYear: form.startYear ? Number(form.startYear) : null };
    const v = zodErrors(profileSchema, payload);
    if (v) return setErrors(v);
    save.mutate(payload);
  };

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-4xl">
      <PageHeader title="Profil" subtitle="Kişisel bilgilerin. Hangilerinin herkese açık olacağını Ayarlar → Gizlilik bölümünden seçersin." />

      <section className="panel panel-pad mb-5 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <Avatar url={user.avatarUrl} first={user.firstName} last={user.lastName} size={88} />
        <div className="flex-1">
          <p className="font-medium text-white">Profil fotoğrafı</p>
          <p className="text-xs text-slate-400">JPG, PNG veya WEBP · en fazla 2 MB</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
                e.target.value = '';
              }}
            />
            <button type="button" className="btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? <Spinner /> : <Camera className="h-4 w-4" />} Fotoğraf yükle
            </button>
            {user.avatarUrl && (
              <button type="button" className="btn-ghost btn-sm hover:text-red-300" onClick={() => removeAvatar.mutate()} disabled={removeAvatar.isPending}>
                <Trash2 className="h-4 w-4" /> Kaldır
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="panel panel-pad space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ad" error={errors.firstName}>
            {(id, d) => <Input id={id} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} invalid={!!errors.firstName} aria-describedby={d} />}
          </Field>
          <Field label="Soyad" error={errors.lastName}>
            {(id, d) => <Input id={id} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} invalid={!!errors.lastName} aria-describedby={d} />}
          </Field>
          <Field label="Kullanıcı adı" error={errors.username} hint={`Herkese açık profil adresi: /u/${form.username || '…'}`}>
            {(id, d) => <Input id={id} value={form.username} onChange={(e) => set('username', e.target.value.toLowerCase())} invalid={!!errors.username} aria-describedby={d} />}
          </Field>
          <Field label="E-posta" hint="E-posta adresi hiçbir zaman herkese açık gösterilmez.">
            {(id, d) => <Input id={id} value={user.email} disabled aria-describedby={d} />}
          </Field>
          <Field label="Hakemlik bölgesi / il" optional error={errors.region}>
            {(id) => <Input id={id} value={form.region} onChange={(e) => set('region', e.target.value)} placeholder="ör. İstanbul" />}
          </Field>
          <Field label="Bağlı kurum" optional error={errors.organization}>
            {(id) => <Input id={id} value={form.organization} onChange={(e) => set('organization', e.target.value)} placeholder="ör. İl Hakem Kurulu" />}
          </Field>
          <Field label="Klasman" optional error={errors.classification}>
            {(id) => <Input id={id} value={form.classification} onChange={(e) => set('classification', e.target.value)} placeholder="ör. İl Hakemi, Bölgesel Hakem" />}
          </Field>
          <Field label="Hakemliğe başlangıç yılı" optional error={errors.startYear}>
            {(id, d) => <Input id={id} type="number" inputMode="numeric" min={1950} max={new Date().getFullYear()} value={form.startYear} onChange={(e) => set('startYear', e.target.value)} invalid={!!errors.startYear} aria-describedby={d} />}
          </Field>
        </div>
        <Field
          label="Lisans / sicil numarası"
          optional
          error={errors.licenseNumber}
          hint={
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3" /> 5 haneli. Özel bilgi: yalnızca siz görürsünüz; herkese açık profilde asla yayımlanmaz.
            </span>
          }
        >
          {(id, d) => (
            <Input
              id={id}
              inputMode="numeric"
              maxLength={5}
              value={form.licenseNumber}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 5);
                set('licenseNumber', v);
                // Başlangıç yılı boşsa lisans numarasının ilk iki hanesinden doldurulur (51 → 2023).
                const year = startYearFromLicense(v);
                if (year && !form.startYear) set('startYear', String(year));
              }}
              invalid={!!errors.licenseNumber}
              aria-describedby={d}
              autoComplete="off"
              className="tabular-nums tracking-widest"
            />
          )}
        </Field>
        <Field label="Kısa biyografi" optional error={errors.bio} hint={`${form.bio.length}/600`}>
          {(id, d) => <Textarea id={id} rows={4} maxLength={600} value={form.bio} onChange={(e) => set('bio', e.target.value)} aria-describedby={d} />}
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
          <Link to="/app/settings?tab=privacy" className="text-sm text-pitch-300 hover:underline">
            Gizlilik ayarları →
          </Link>
          <button className="btn-primary" disabled={save.isPending}>
            {save.isPending && <Spinner />} Kaydet
          </button>
        </div>
      </section>
    </form>
  );
}
