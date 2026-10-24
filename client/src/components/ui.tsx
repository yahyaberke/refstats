import clsx from 'clsx';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, type LucideIcon } from 'lucide-react';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import {
  MATCH_STATUS_LABELS,
  OFFICIAL_ROLE_LABELS,
  OFFICIAL_ROLE_SHORT,
  REPORT_STATUS_LABELS,
  type MatchStatus,
  type OfficialRole,
  type ReportStatus,
} from '@refstats/shared';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin', className ?? 'h-4 w-4')} aria-hidden />;
}

export function LoadingBlock({ label = 'Yükleniyor…' }: { label?: string }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center gap-3 text-sm text-slate-400" role="status">
      <Spinner className="h-5 w-5 text-pitch-400" /> {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="panel panel-pad flex flex-col items-start gap-3 border-red-400/20 sm:flex-row sm:items-center">
      <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
      <p className="flex-1 text-sm text-slate-300">{message}</p>
      {onRetry && (
        <button className="btn-secondary btn-sm" onClick={onRetry}>
          Tekrar dene
        </button>
      )}
    </div>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  children: (id: string, describedBy?: string) => ReactNode;
  className?: string;
  optional?: boolean;
}

/** Erişilebilir form alanı: etiket, ipucu ve hata mesajını input'a bağlar. */
export function Field({ label, error, hint, children, className, optional }: FieldProps) {
  const id = useId();
  const descId = error || hint ? `${id}-desc` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {optional && <span className="ml-1 normal-case tracking-normal text-slate-500">(isteğe bağlı)</span>}
      </label>
      {children(id, descId)}
      {error ? (
        <p id={descId} className="mt-1.5 text-xs text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={descId} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return <input ref={ref} aria-invalid={invalid || undefined} className={clsx('input', invalid && 'input-error', className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ className, invalid, children, ...props }, ref) {
    return (
      <select ref={ref} aria-invalid={invalid || undefined} className={clsx('input pr-8', invalid && 'input-error', className)} {...props}>
        {children}
      </select>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...props }, ref) {
    return (
      <textarea ref={ref} aria-invalid={invalid || undefined} className={clsx('input min-h-[88px] resize-y', invalid && 'input-error', className)} {...props} />
    );
  },
);

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-100">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-slate-400">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50',
          checked ? 'bg-pitch-500' : 'bg-white/15',
        )}
      >
        <span className={clsx('inline-block h-5 w-5 rounded-full bg-white shadow transition', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = 'green',
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: ReactNode;
  accent?: 'green' | 'yellow' | 'red' | 'blue' | 'slate';
}) {
  const accents = {
    green: 'text-pitch-300 bg-pitch-500/10',
    yellow: 'text-yellow-300 bg-yellow-400/10',
    red: 'text-red-300 bg-red-500/10',
    blue: 'text-sky-300 bg-sky-500/10',
    slate: 'text-slate-300 bg-white/5',
  };
  return (
    <div className="panel panel-pad animate-fade-up">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        {Icon && (
          <span className={clsx('rounded-lg p-1.5', accents[accent])}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>
      <p className="mt-2 font-display text-2xl font-semibold text-white sm:text-[28px]">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <Icon className="h-7 w-7 text-pitch-400" aria-hidden />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-slate-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const roleColors: Record<OfficialRole, string> = {
  REFEREE: 'border-pitch-400/30 bg-pitch-500/10 text-pitch-300',
  AR1: 'border-sky-400/30 bg-sky-500/10 text-sky-300',
  AR2: 'border-sky-400/30 bg-sky-500/10 text-sky-300',
  ADDITIONAL_AR: 'border-indigo-400/30 bg-indigo-500/10 text-indigo-300',
  FOURTH: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
  OTHER: 'border-slate-400/30 bg-slate-500/10 text-slate-300',
};
export function RoleBadge({ role, short }: { role: OfficialRole; short?: boolean }) {
  return (
    <span className={clsx('chip whitespace-nowrap', roleColors[role])} title={OFFICIAL_ROLE_LABELS[role]}>
      {short ? OFFICIAL_ROLE_SHORT[role] : OFFICIAL_ROLE_LABELS[role]}
    </span>
  );
}

const statusColors: Record<MatchStatus, string> = {
  COMPLETED: 'border-pitch-400/25 bg-pitch-500/10 text-pitch-300',
  SCHEDULED: 'border-sky-400/30 bg-sky-500/10 text-sky-300',
  POSTPONED: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
  CANCELLED: 'border-red-400/30 bg-red-500/10 text-red-300',
};
export function StatusBadge({ status }: { status: MatchStatus }) {
  const label = status === 'SCHEDULED' ? 'Planlandı' : MATCH_STATUS_LABELS[status];
  return <span className={clsx('chip whitespace-nowrap', statusColors[status])}>{label}</span>;
}

const reportColors: Record<ReportStatus, string> = {
  NOT_STARTED: 'border-slate-400/30 text-slate-400',
  IN_PROGRESS: 'border-amber-400/30 text-amber-300',
  DONE: 'border-pitch-400/30 text-pitch-300',
};
export function ReportBadge({ status }: { status: ReportStatus }) {
  return <span className={clsx('chip whitespace-nowrap bg-transparent', reportColors[status])}>{REPORT_STATUS_LABELS[status]}</span>;
}

export function CardCounts({ yellow, red }: { yellow: number; red: number }) {
  return (
    <span className="inline-flex items-center gap-3 text-sm tabular-nums" aria-label={`${yellow} sarı, ${red} kırmızı kart`}>
      <span className="inline-flex items-center gap-1.5">
        <span className="card-yellow" aria-hidden />
        {yellow}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="card-red" aria-hidden />
        {red}
      </span>
    </span>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="no-print flex items-center justify-between gap-3 px-1 pt-4 text-sm text-slate-400" aria-label="Sayfalama">
      <span>
        {from}–{to} / {total} kayıt
      </span>
      <div className="flex items-center gap-1">
        <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Önceki sayfa">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 tabular-nums">
          {page} / {pages}
        </span>
        <button className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Sonraki sayfa">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string; icon?: LucideIcon }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" className="no-print scrollbar-thin -mx-1 mb-5 flex gap-1 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={clsx(
            'inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition',
            value === t.value ? 'bg-pitch-500/15 text-pitch-300 ring-1 ring-pitch-400/30' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200',
          )}
        >
          {t.icon && <t.icon className="h-4 w-4" aria-hidden />}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function ProgressBar({ percent, achieved }: { percent: number; achieved?: boolean }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={clsx('h-full rounded-full transition-all duration-700', achieved ? 'bg-gradient-to-r from-pitch-400 to-emerald-300' : 'bg-gradient-to-r from-pitch-600 to-pitch-400')}
        style={{ width: `${Math.max(2, percent)}%` }}
      />
    </div>
  );
}

export function Avatar({ url, first, last, size = 40 }: { url: string | null; first: string; last: string; size?: number }) {
  if (url) {
    return <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover ring-2 ring-white/10" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pitch-500 to-pitch-700 font-display font-semibold text-ink-950 ring-2 ring-white/10"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {`${first[0] ?? ''}${last[0] ?? ''}`.toLocaleUpperCase('tr')}
    </span>
  );
}
