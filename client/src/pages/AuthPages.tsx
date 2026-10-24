import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '@refstats/shared';
import { CheckCircle2, Eye, EyeOff, MailCheck } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Logo } from '../components/Logo';
import { Field, Input, Spinner } from '../components/ui';
import { api } from '../lib/api';
import type { Me } from '../lib/types';
import { apiErrors, useFieldErrors, zodErrors } from '../lib/useForm';

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link to="/" className="mb-8" aria-label="Ana sayfa">
        <Logo />
      </Link>
      <div className="panel w-full max-w-md animate-fade-up p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-6 text-sm text-slate-400">{footer}</div>}
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
      {message}
    </p>
  );
}

function PasswordInput(props: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean; describedBy?: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={props.id}
        type={show ? 'text' : 'password'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        invalid={props.invalid}
        aria-describedby={props.describedBy}
        autoComplete={props.autoComplete}
        className="pr-10"
        required
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-white"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Parolayı gizle' : 'Parolayı göster'}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function LoginPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const { errors, setErrors, clear } = useFieldErrors();
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const v = zodErrors(loginSchema, form);
    if (v) return setErrors(v);
    setBusy(true);
    try {
      const { user } = await api.post<{ user: Me }>('/auth/login', form);
      setUser(user);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith('/app') ? from : '/app', { replace: true });
    } catch (err) {
      const { fields, message } = apiErrors(err);
      setErrors(fields);
      setFormError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Tekrar hoş geldin"
      subtitle="Maç kayıtlarına ve istatistiklerine eriş."
      footer={
        <>
          Hesabın yok mu?{' '}
          <Link to="/register" className="font-medium text-pitch-300 hover:underline">
            Kayıt ol
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={formError} />
        <Field label="E-posta" error={errors.email}>
          {(id, d) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => (setForm({ ...form, email: e.target.value }), clear('email'))}
              invalid={!!errors.email}
              aria-describedby={d}
              required
            />
          )}
        </Field>
        <Field label="Parola" error={errors.password}>
          {(id, d) => (
            <PasswordInput
              id={id}
              value={form.password}
              onChange={(v) => (setForm({ ...form, password: v }), clear('password'))}
              invalid={!!errors.password}
              describedBy={d}
              autoComplete="current-password"
            />
          )}
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs text-slate-400 hover:text-pitch-300">
            Parolamı unuttum
          </Link>
        </div>
        <button className="btn-primary w-full py-3" disabled={busy}>
          {busy && <Spinner />} Giriş yap
        </button>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', username: '', email: '', password: '' });
  const { errors, setErrors, clear } = useFieldErrors();
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    clear(k);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const v = zodErrors(registerSchema, form);
    if (v) return setErrors(v);
    setBusy(true);
    try {
      const { user } = await api.post<{ user: Me }>('/auth/register', form);
      setUser(user);
      navigate('/app', { replace: true });
    } catch (err) {
      const { fields, message } = apiErrors(err);
      setErrors(fields);
      setFormError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Hesap oluştur"
      subtitle="Kişisel hakemlik kayıt defterin birkaç saniyede hazır."
      footer={
        <>
          Zaten hesabın var mı?{' '}
          <Link to="/login" className="font-medium text-pitch-300 hover:underline">
            Giriş yap
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={formError} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ad" error={errors.firstName}>
            {(id, d) => (
              <Input id={id} autoComplete="given-name" value={form.firstName} onChange={(e) => set('firstName')(e.target.value)} invalid={!!errors.firstName} aria-describedby={d} />
            )}
          </Field>
          <Field label="Soyad" error={errors.lastName}>
            {(id, d) => (
              <Input id={id} autoComplete="family-name" value={form.lastName} onChange={(e) => set('lastName')(e.target.value)} invalid={!!errors.lastName} aria-describedby={d} />
            )}
          </Field>
        </div>
        <Field label="Kullanıcı adı" error={errors.username} hint="Küçük harf, rakam, nokta ve alt çizgi. Profil adresinde kullanılır.">
          {(id, d) => (
            <Input
              id={id}
              autoComplete="username"
              value={form.username}
              onChange={(e) => set('username')(e.target.value.toLowerCase())}
              invalid={!!errors.username}
              aria-describedby={d}
            />
          )}
        </Field>
        <Field label="E-posta" error={errors.email}>
          {(id, d) => (
            <Input id={id} type="email" autoComplete="email" value={form.email} onChange={(e) => set('email')(e.target.value)} invalid={!!errors.email} aria-describedby={d} />
          )}
        </Field>
        <Field label="Parola" error={errors.password} hint="En az 8 karakter; en az bir harf ve bir rakam.">
          {(id, d) => (
            <PasswordInput id={id} value={form.password} onChange={set('password')} invalid={!!errors.password} describedBy={d} autoComplete="new-password" />
          )}
        </Field>
        <button className="btn-primary w-full py-3" disabled={busy}>
          {busy && <Spinner />} Hesabı oluştur
        </button>
        <p className="text-center text-xs text-slate-500">Profilin varsayılan olarak gizlidir; neyin paylaşılacağına sen karar verirsin.</p>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = zodErrors(forgotPasswordSchema, { email });
    if (v) return setError(v.email);
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setDone(true);
    } catch (err) {
      setError(apiErrors(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Parolamı unuttum"
      subtitle="Kayıtlı e-posta adresine bir sıfırlama bağlantısı gönderelim."
      footer={
        <Link to="/login" className="text-pitch-300 hover:underline">
          Girişe dön
        </Link>
      }
    >
      {done ? (
        <div className="flex flex-col items-center text-center">
          <MailCheck className="h-10 w-10 text-pitch-400" />
          <p className="mt-3 text-sm text-slate-300">Bu e-posta kayıtlıysa, 1 saat geçerli bir sıfırlama bağlantısı gönderildi.</p>
          <p className="mt-2 text-xs text-slate-500">E-posta gelmediyse istenmeyen klasörünü kontrol edin.</p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label="E-posta" error={error ?? undefined}>
            {(id, d) => (
              <Input id={id} type="email" autoComplete="email" value={email} onChange={(e) => (setEmail(e.target.value), setError(null))} invalid={!!error} aria-describedby={d} />
            )}
          </Field>
          <button className="btn-primary w-full py-3" disabled={busy}>
            {busy && <Spinner />} Bağlantı gönder
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = zodErrors(resetPasswordSchema, { token, password });
    if (v) return setError(v.password ?? 'Bağlantı geçersiz');
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(apiErrors(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Yeni parola belirle">
      {done ? (
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="h-10 w-10 text-pitch-400" />
          <p className="mt-3 text-sm text-slate-300">Parolan güncellendi. Güvenliğin için tüm cihazlardaki oturumlar kapatıldı.</p>
          <Link to="/login" className="btn-primary mt-5">
            Giriş yap
          </Link>
        </div>
      ) : !token ? (
        <p className="text-sm text-slate-300">
          Bağlantı eksik veya hatalı.{' '}
          <Link to="/forgot-password" className="text-pitch-300 hover:underline">
            Yeni bağlantı iste
          </Link>
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label="Yeni parola" error={error ?? undefined} hint="En az 8 karakter; en az bir harf ve bir rakam.">
            {(id, d) => (
              <PasswordInput id={id} value={password} onChange={(v) => (setPassword(v), setError(null))} invalid={!!error} describedBy={d} autoComplete="new-password" />
            )}
          </Field>
          <button className="btn-primary w-full py-3" disabled={busy}>
            {busy && <Spinner />} Parolayı güncelle
          </button>
        </form>
      )}
    </AuthShell>
  );
}
