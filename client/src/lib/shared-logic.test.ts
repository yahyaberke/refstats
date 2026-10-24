import { describe, expect, it } from 'vitest';
import { computeCardTotals, matchSchema, seasonForDate, seasonRange, summaryCardTotals } from '@refstats/shared';
import { qs } from './api';
import { score } from './format';

describe('sezon hesaplama', () => {
  it('Temmuz ve sonrası yeni sezona aittir', () => {
    expect(seasonForDate('2025-07-01')).toBe('2025-2026');
    expect(seasonForDate('2026-06-30')).toBe('2025-2026');
    expect(seasonForDate('2026-10-24')).toBe('2026-2027');
  });
  it('sezon aralığını döner', () => {
    expect(seasonRange('2025-2026')).toEqual({ start: '2025-07-01', end: '2026-06-30' });
    expect(seasonRange('2025-2027')).toBeNull();
  });
});

describe('kart toplamları', () => {
  it('özet girişte kırmızı = ikinci sarı + direkt', () => {
    expect(summaryCardTotals({ yellowCards: 4, secondYellowReds: 1, directReds: 2 }).redCards).toBe(3);
  });
  it('olay girişinde ikinci sarı iki toplamı da etkiler', () => {
    expect(computeCardTotals([{ type: 'YELLOW' }, { type: 'SECOND_YELLOW' }])).toMatchObject({ yellowCards: 2, redCards: 1 });
  });
});

describe('maç şeması (istemci doğrulaması)', () => {
  const base = { date: '2025-10-01', homeTeam: 'A', awayTeam: 'B', categoryId: 'c1', role: 'REFEREE' };
  it('aynı takımları reddeder', () => {
    expect(matchSchema.safeParse({ ...base, awayTeam: 'a' }).success).toBe(false);
  });
  it('tek taraflı skoru reddeder', () => {
    expect(matchSchema.safeParse({ ...base, homeScore: 1 }).success).toBe(false);
  });
  it('geçerli minimum kaydı kabul eder', () => {
    expect(matchSchema.safeParse(base).success).toBe(true);
  });
});

describe('yardımcılar', () => {
  it('boş sorgu parametrelerini atlar', () => {
    expect(qs({ a: '1', b: '', c: undefined, d: 0 })).toBe('?a=1&d=0');
  });
  it('skoru biçimlendirir', () => {
    expect(score(2, 1)).toBe('2 - 1');
    expect(score(null, null)).toBe('–');
  });
});
