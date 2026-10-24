/**
 * Türk futbolunda sezonlar genellikle Temmuz–Haziran arasıdır.
 * "2025-07-14" → "2025-2026", "2026-03-02" → "2025-2026".
 */
export function seasonForDate(isoDate: string): string {
  const [y, m] = isoDate.split('-').map(Number);
  if (!y || !m) return '';
  return m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

/** Sezon adının başlangıç/bitiş tarihleri (dahil). */
export function seasonRange(name: string): { start: string; end: string } | null {
  const match = /^(\d{4})-(\d{4})$/.exec(name);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (b !== a + 1) return null;
  return { start: `${a}-07-01`, end: `${b}-06-30` };
}

/** Yerel saate göre bugünün tarihi (YYYY-MM-DD). */
export function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
