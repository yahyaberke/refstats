import type { CardType } from './constants';

export interface CardTotals {
  /** Gösterilen tüm sarı kartlar. İkinci sarılar DAHİLDİR (her ikinci sarı sahada gösterilmiş bir sarı karttır). */
  yellowCards: number;
  /** İkinci sarıdan gelen ihraçlar. */
  secondYellowReds: number;
  /** Doğrudan kırmızı kartlar. */
  directReds: number;
  /** Toplam ihraç = ikinci sarıdan kırmızı + doğrudan kırmızı. */
  redCards: number;
}

/**
 * Kart olaylarından maç toplamlarını hesaplar.
 *
 * Tanımlar (aynı olay asla iki kez aynı toplamda sayılmaz):
 *  - YELLOW olayı          → sarı +1
 *  - SECOND_YELLOW olayı   → sarı +1 (ikinci sarı) ve kırmızı +1 (ihraç)
 *  - DIRECT_RED olayı      → kırmızı +1
 * Bu nedenle ikinci sarıdan ihraç edilen bir oyuncu için:
 * ilk sarısı (YELLOW) + ikinci sarısı (SECOND_YELLOW) = 2 sarı, 1 kırmızı.
 */
export function computeCardTotals(events: { type: CardType }[]): CardTotals {
  let yellow = 0;
  let second = 0;
  let direct = 0;
  for (const e of events) {
    if (e.type === 'YELLOW') yellow++;
    else if (e.type === 'SECOND_YELLOW') second++;
    else if (e.type === 'DIRECT_RED') direct++;
  }
  return {
    yellowCards: yellow + second,
    secondYellowReds: second,
    directReds: direct,
    redCards: second + direct,
  };
}

/** Özet (manuel) girişten toplamları hesaplar. Girdi: toplam sarı (ikinci sarılar dahil), ikinci sarı, direkt kırmızı. */
export function summaryCardTotals(input: {
  yellowCards: number;
  secondYellowReds: number;
  directReds: number;
}): CardTotals {
  return {
    yellowCards: input.yellowCards,
    secondYellowReds: input.secondYellowReds,
    directReds: input.directReds,
    redCards: input.secondYellowReds + input.directReds,
  };
}
