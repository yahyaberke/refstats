import clsx from 'clsx';

export function Logo({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 64 64" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="14" fill="#0e1729" stroke="rgba(255,255,255,.08)" />
        <path d="M18 46V18h15a9 9 0 0 1 2 17.8L44 46h-8l-8-10h-3v10z M25 30h7a3.5 3.5 0 0 0 0-7h-7z" fill="#2fd08a" />
        <rect x="40" y="14" width="10" height="14" rx="2" fill="#facc15" transform="rotate(12 45 21)" />
      </svg>
      {!compact && (
        <span className="font-display text-lg font-semibold tracking-tight text-white">
          Ref<span className="text-pitch-400">Stats</span>
        </span>
      )}
    </span>
  );
}
