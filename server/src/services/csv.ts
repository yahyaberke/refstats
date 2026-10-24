import {
  MATCH_STATUS_LABELS,
  MATCH_TYPE_LABELS,
  OFFICIAL_ROLE_LABELS,
  REPORT_STATUS_LABELS,
  CARD_ENTRY_MODE_LABELS,
} from '@refstats/shared';
import type { serializeMatch } from './matches';

type SerializedMatch = ReturnType<typeof serializeMatch>;

/**
 * CSV hücresini kaçışlar. Excel'de formül enjeksiyonunu (=, +, -, @ ile başlayan hücreler) önlemek için
 * bu karakterlerle başlayan metinlerin başına tek tırnak eklenir.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[";\n\r,]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

const HEADERS = [
  'Tarih',
  'Saat',
  'Ev sahibi',
  'Deplasman',
  'Skor',
  'Devre',
  'Organizasyon/Lig',
  'Kategori',
  'Sezon',
  'Hafta/Tur',
  'Saha',
  'İl',
  'İlçe',
  'Maç türü',
  'Durum',
  'Görev',
  'Ek görevler',
  'Sarı kart (toplam)',
  'İkinci sarıdan kırmızı',
  'Doğrudan kırmızı',
  'Kırmızı kart (toplam)',
  'Kart kayıt yöntemi',
  'Rapor durumu',
];

/** Noktalı virgül ayraçlı, UTF-8 BOM'lu CSV (Türkçe Excel ile uyumlu). */
export function matchesToCsv(matches: SerializedMatch[]): string {
  const rows = matches.map((m) =>
    [
      m.date,
      m.kickoffTime,
      m.homeTeam,
      m.awayTeam,
      m.homeScore !== null ? `${m.homeScore}-${m.awayScore}` : '',
      m.halfTimeHome !== null ? `${m.halfTimeHome}-${m.halfTimeAway}` : '',
      m.competition,
      m.category.name,
      m.season,
      m.round,
      m.venue,
      m.city,
      m.district,
      MATCH_TYPE_LABELS[m.matchType],
      MATCH_STATUS_LABELS[m.status],
      OFFICIAL_ROLE_LABELS[m.role],
      m.additionalDuties,
      m.yellowCards,
      m.secondYellowReds,
      m.directReds,
      m.redCards,
      CARD_ENTRY_MODE_LABELS[m.cardEntryMode],
      REPORT_STATUS_LABELS[m.reportStatus],
    ]
      .map(csvCell)
      .join(';'),
  );
  return `﻿${[HEADERS.join(';'), ...rows].join('\r\n')}\r\n`;
}
