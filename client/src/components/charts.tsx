import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Grafik paleti — koyu yüzey (#0a1120) için doğrulandı (renk körlüğü ayrımı ve kontrast).
 * Kategorik sıra sabittir; renk varlığa bağlıdır, sıralamaya değil.
 * Sarı/kırmızı kart renkleri alanın kendi anlamını taşır ve her zaman metin etiketiyle birlikte kullanılır.
 */
export const CHART = {
  referee: '#199e70',
  assistant: '#3987e5',
  fourth: '#d95926',
  other: '#9085e9',
  primary: '#199e70',
  yellow: '#c9a000',
  red: '#dc3c4a',
  grid: 'rgba(255,255,255,0.06)',
  axis: '#64748b',
  surface: '#0a1120',
};

/** Kategori dağılımları için sıralı tek renk (yeşil) yerine yatay çubuk kullanılır; tek seri tek renk. */
export const ROLE_SERIES = [
  { key: 'referee', label: 'Orta hakem', color: CHART.referee },
  { key: 'assistant', label: 'Yardımcı hakem', color: CHART.assistant },
  { key: 'fourth', label: 'Dördüncü hakem', color: CHART.fourth },
  { key: 'other', label: 'Diğer', color: CHART.other },
] as const;

const axisProps = {
  stroke: CHART.axis,
  tick: { fill: '#94a3b8', fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-ink-850/95 px-3 py-2 text-xs shadow-panel backdrop-blur">
      {label && <p className="mb-1 font-medium text-white">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-slate-300">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} aria-hidden />
          <span>{p.name}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums text-white">
            {typeof p.value === 'number' ? p.value.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : p.value}
            {unit}
          </span>
        </p>
      ))}
    </div>
  );
}

const legendStyle = { fontSize: 12, color: '#cbd5e1', paddingTop: 8 };
const legendFormatter = (value: string) => <span className="text-slate-300">{value}</span>;

export function ChartCard({
  title,
  subtitle,
  children,
  action,
  empty,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  empty?: boolean;
  className?: string;
}) {
  return (
    <section className={`panel panel-pad animate-fade-up ${className ?? ''}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {empty ? (
        <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-slate-500">
          Bu aralıkta veri yok
        </div>
      ) : (
        children
      )}
    </section>
  );
}

interface SeriesDef {
  key: string;
  label: string;
  color: string;
}

/** Yığılmış veya tekli dikey çubuk grafiği. */
export function Bars({
  data,
  xKey,
  series,
  stacked,
  height = 240,
  unit,
}: {
  data: object[];
  xKey: string;
  series: readonly SeriesDef[];
  stacked?: boolean;
  height?: number;
  unit?: string;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...axisProps} allowDecimals={false} width={44} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip unit={unit} />} />
          {series.length > 1 && <Legend wrapperStyle={legendStyle} iconType="square" iconSize={9} formatter={legendFormatter} />}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color}
              stackId={stacked ? 'a' : undefined}
              stroke={stacked ? CHART.surface : undefined}
              strokeWidth={stacked ? 1 : 0}
              radius={!stacked || i === series.length - 1 ? [4, 4, 0, 0] : 0}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Yatay çubuk: kategori/takım sıralamaları için (etiketler okunaklı kalır). */
export function HBars({
  data,
  labelKey = 'name',
  valueKey = 'count',
  color = CHART.primary,
  label = 'Maç',
  height,
}: {
  data: object[];
  labelKey?: string;
  valueKey?: string;
  color?: string;
  label?: string;
  height?: number;
}) {
  const h = height ?? Math.max(160, data.length * 34 + 20);
  return (
    <div style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }} barCategoryGap="26%">
          <CartesianGrid horizontal={false} stroke={CHART.grid} />
          <XAxis type="number" {...axisProps} allowDecimals={false} />
          <YAxis type="category" dataKey={labelKey} {...axisProps} width={128} tick={{ fill: '#cbd5e1', fontSize: 12 }} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip />} />
          <Bar dataKey={valueKey} name={label} fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AreaTrend({
  data,
  xKey,
  yKey,
  label,
  color = CHART.primary,
  height = 220,
}: {
  data: object[];
  xKey: string;
  yKey: string;
  label: string;
  color?: string;
  height?: number;
}) {
  const gid = `g-${yKey}-${color.slice(1)}`;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" minTickGap={18} />
          <YAxis {...axisProps} allowDecimals={false} width={44} />
          <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.2)' }} content={<ChartTooltip />} />
          <Area type="monotone" dataKey={yKey} name={label} stroke={color} strokeWidth={2} fill={`url(#${gid})`} activeDot={{ r: 4, stroke: CHART.surface, strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Lines({
  data,
  xKey,
  series,
  height = 240,
  domain,
  dashedKeys = [],
}: {
  data: object[];
  xKey: string;
  series: readonly SeriesDef[];
  height?: number;
  domain?: [number | 'auto', number | 'auto'];
  dashedKeys?: string[];
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" minTickGap={18} />
          <YAxis
            {...axisProps}
            width={44}
            domain={domain ?? ['auto', 'auto']}
            tickFormatter={(v: number) => v.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
          />
          <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.2)' }} content={<ChartTooltip />} />
          {series.length > 1 && <Legend wrapperStyle={legendStyle} iconType="plainline" formatter={legendFormatter} />}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={dashedKeys.includes(s.key) ? '5 4' : undefined}
              dot={data.length <= 24 ? { r: 3, strokeWidth: 0, fill: s.color } : false}
              activeDot={{ r: 5, stroke: CHART.surface, strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Parça-bütün için yüzde çubuğu (pasta grafiği yerine; değerler ve etiketler okunaklı). */
export function ShareBar({ items }: { items: { label: string; value: number; color: string }[] }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) {
    return <p className="text-sm text-slate-500">Henüz veri yok</p>;
  }
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={items.map((i) => `${i.label}: ${i.value}`).join(', ')}>
        {items
          .filter((i) => i.value > 0)
          .map((i) => (
            <div key={i.label} style={{ width: `${(i.value / total) * 100}%`, background: i.color }} title={`${i.label}: ${i.value}`} />
          ))}
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-y-2.5">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: i.color }} aria-hidden />
            <span className="truncate text-slate-300">{i.label}</span>
            <span className="ml-auto tabular-nums font-semibold text-white">{i.value}</span>
            <span className="w-10 text-right tabular-nums text-xs text-slate-500">%{Math.round((i.value / total) * 100)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
