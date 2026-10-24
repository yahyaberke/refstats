const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const longFmt = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dateTimeFmt = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** "2025-10-12" → "12 Eki 2025" */
export const fmtDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : '—');
export const fmtLongDate = (iso: string) => longFmt.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
export const fmtDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));
export const fmtNum = (n: number, digits = 0) =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} gün önce`;
  return fmtDateTime(iso);
}

export const score = (h: number | null, a: number | null) => (h === null || a === null ? '–' : `${h} - ${a}`);

export const initials = (first: string, last: string) => `${first[0] ?? ''}${last[0] ?? ''}`.toLocaleUpperCase('tr');

export function downloadUrl(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
