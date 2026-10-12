import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatPeriodPT, MONTHS_SHORT_PT, periodParts } from '../../domain/dates'
import { formatMoney } from '../../domain/money'
import type { InvestSeries, MonthTotal } from '../../domain/stats'
import type { Period } from '../../domain/types'
import { Money } from '../components/Status'

const MAX_SERIES = 8
const OTHERS = '__outros'

export interface ChartSeries extends InvestSeries {
  color: string
}

/** Cores pela ordem fixa da paleta; a partir da 8.ª fatia junta-se tudo em «Outros». */
export function chartSeries(series: InvestSeries[]): ChartSeries[] {
  const withColor = (s: InvestSeries, i: number): ChartSeries => ({ ...s, color: `var(--series-${i + 1})` })
  if (series.length <= MAX_SERIES) return series.map(withColor)
  const head = series.slice(0, MAX_SERIES - 1)
  const rest = series.slice(MAX_SERIES - 1)
  return [...head, { key: OTHERS, name: 'Outros', total: rest.reduce((s, x) => s + x.total, 0) }].map(withColor)
}

/** Valor de uma fatia num mês (com «Outros» a juntar as restantes). */
function partOf(m: MonthTotal, key: string, series: ChartSeries[]): number {
  if (key !== OTHERS) return m.investParts[key] ?? 0
  const shown = new Set(series.map((s) => s.key))
  return Object.entries(m.investParts).reduce((sum, [k, v]) => (shown.has(k) ? sum : sum + v), 0)
}

type Row = { period: Period; label: string; total: number } & Record<string, number | string>

const nf = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 })
const compact = (v: number) => (v >= 1000 ? `${nf.format(v / 1000)} mil` : nf.format(v))

function InvestTooltip({ active, payload, series }: { active?: boolean; payload?: ReadonlyArray<{ payload: Row }>; series: ChartSeries[] }) {
  const row = active ? payload?.[0]?.payload : undefined
  if (!row) return null
  return (
    <div className="min-w-40 rounded-xl bg-ink px-3 py-2 text-sm text-bg shadow-float">
      <div className="font-semibold first-letter:uppercase">{formatPeriodPT(row.period)}</div>
      <div className="tnum font-semibold">{formatMoney(Math.round(row.total * 100))}</div>
      <ul className="mt-1 flex flex-col gap-0.5">
        {series
          .filter((s) => Number(row[s.key]) > 0)
          .map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
              <span className="flex-1">{s.name}</span>
              <span className="tnum">{formatMoney(Math.round(Number(row[s.key]) * 100))}</span>
            </li>
          ))}
      </ul>
    </div>
  )
}

/** Investimento por mês (o total de cada barra), dividido em fatias pelos destinos. */
export function InvestChart({ months, series }: { months: MonthTotal[]; series: ChartSeries[] }) {
  const rows: Row[] = months.map((m) => {
    const [y, mo] = periodParts(m.period)
    const label = months.length > 12 && mo === 1 ? `${MONTHS_SHORT_PT[0]} ${String(y).slice(2)}` : MONTHS_SHORT_PT[mo - 1]!
    const row: Row = { period: m.period, label, total: m.invest / 100 }
    for (const s of series) row[s.key] = partOf(m, s.key, series) / 100
    return row
  })
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  return (
    <div className="flex flex-col gap-3">
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 12, right: 6, left: 0, bottom: 0 }} barCategoryGap={3}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={rows.length > 12 ? 2 : 0} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
            <YAxis width={58} tickLine={false} axisLine={false} tickFormatter={compact} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
            <Tooltip cursor={{ fill: 'var(--neutral-soft)' }} content={(p) => <InvestTooltip active={p.active} payload={p.payload as never} series={series} />} />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                stackId="investimento"
                fill={s.color}
                stroke="var(--surface)"
                strokeWidth={2}
                radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                maxBarSize={32}
                isAnimationActive={!reduceMotion}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <InvestLegend series={series} />
    </div>
  )
}

/** Legenda com o total de cada fatia no período (a cor nunca é a única pista). */
export function InvestLegend({ series }: { series: ChartSeries[] }) {
  return (
    <ul className="flex flex-col gap-1.5 px-2 text-sm" aria-label="Total por destino no período">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-2">
          <span aria-hidden className="size-3 shrink-0 rounded-sm" style={{ background: s.color }} />
          <span className="min-w-0 flex-1 text-muted">{s.name}</span>
          <Money cents={s.total} className="font-semibold" />
        </li>
      ))}
    </ul>
  )
}
