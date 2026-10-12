import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatPeriodPT, MONTHS_SHORT_PT, periodParts } from '../../domain/dates'
import { formatMoney } from '../../domain/money'
import type { InvestSeries, MonthTotal } from '../../domain/stats'
import type { Period } from '../../domain/types'
import { Money } from '../components/Status'

/** Fatias da barra: "fica para ti" (cor 1) e os destinos do investimento (cores 2 a 8, por esta ordem). */
export interface ChartSeries {
  key: string
  name: string
  total: number
  color: string
}

const KEPT = '__fica'
const OTHERS = '__outros'
const MAX_DESTINATIONS = 7

/** Séries do gráfico: "Fica para ti" + destinos (a partir do 7.º destino junta-se tudo em «Outros»). */
export function chartSeries(kept: number, destinations: InvestSeries[]): ChartSeries[] {
  const dest =
    destinations.length <= MAX_DESTINATIONS
      ? destinations
      : [
          ...destinations.slice(0, MAX_DESTINATIONS - 1),
          { key: OTHERS, name: 'Outros', total: destinations.slice(MAX_DESTINATIONS - 1).reduce((s, x) => s + x.total, 0) },
        ]
  return [{ key: KEPT, name: 'Fica para ti', total: kept }, ...dest].map((s, i) => ({ ...s, color: `var(--series-${i + 1})` }))
}

/** Valor de uma fatia num mês (cêntimos). */
function partOf(m: MonthTotal, key: string, series: ChartSeries[]): number {
  if (key === KEPT) return m.total - m.invest
  if (key !== OTHERS) return m.investParts[key] ?? 0
  const shown = new Set(series.map((s) => s.key))
  return Object.entries(m.investParts).reduce((sum, [k, v]) => (shown.has(k) ? sum : sum + v), 0)
}

type Row = { period: Period; label: string; total: number; invest: number } & Record<string, number | string>

const nf = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 })
const euros = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 })
/** Eixo: 0, 500, 1 mil, 1,5 mil… (euros) */
const compact = (v: number) => (v >= 1000 ? `${nf.format(v / 1000)} mil` : nf.format(v))
const cents = (v: number | string) => Math.round(Number(v) * 100)

function MonthTooltip({ active, payload, series }: { active?: boolean; payload?: ReadonlyArray<{ payload: Row }>; series: ChartSeries[] }) {
  const row = active ? payload?.[0]?.payload : undefined
  if (!row) return null
  return (
    <div className="min-w-44 rounded-xl bg-ink px-3 py-2 text-sm text-bg shadow-float">
      <div className="font-semibold first-letter:uppercase">{formatPeriodPT(row.period)}</div>
      <div className="tnum">Recebido {formatMoney(cents(row.total))}</div>
      <ul className="mt-1 flex flex-col gap-0.5">
        {series
          .filter((s) => Number(row[s.key]) > 0)
          .map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
              <span className="flex-1">{s.name}</span>
              <span className="tnum">{formatMoney(cents(row[s.key]!))}</span>
            </li>
          ))}
      </ul>
    </div>
  )
}

/**
 * Recebido por mês: cada barra é o total recebido, partida no que fica para ti e no que vai
 * para cada destino do investimento. Com a linha da média e o melhor mês identificado.
 */
export function MonthlyChart({ months, series, best }: { months: MonthTotal[]; series: ChartSeries[]; best?: Period }) {
  const rows: Row[] = months.map((m) => {
    const [y, mo] = periodParts(m.period)
    const label = months.length > 12 && mo === 1 ? `${MONTHS_SHORT_PT[0]} ${String(y).slice(2)}` : MONTHS_SHORT_PT[mo - 1]!
    const row: Row = { period: m.period, label, total: m.total / 100, invest: m.invest / 100 }
    for (const s of series) row[s.key] = partOf(m, s.key, series) / 100
    return row
  })
  const avg = rows.length ? rows.reduce((s, r) => s + r.total, 0) / rows.length : 0
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  // As fatias empilham de baixo para cima: destinos primeiro, "fica para ti" no topo.
  const stack = [...series.slice(1), series[0]!]

  return (
    <div className="flex flex-col gap-3">
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 22, right: 6, left: 0, bottom: 0 }} barCategoryGap={3}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={rows.length > 12 ? 2 : 0} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
            <YAxis width={58} tickLine={false} axisLine={false} tickFormatter={compact} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
            <Tooltip cursor={{ fill: 'var(--neutral-soft)' }} content={(p) => <MonthTooltip active={p.active} payload={p.payload as never} series={series} />} />
            {avg > 0 && (
              <ReferenceLine
                y={avg}
                stroke="var(--muted)"
                strokeDasharray="4 4"
                label={{ value: 'média', position: 'insideTopLeft', fill: 'var(--muted)', fontSize: 11 }}
              />
            )}
            {stack.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                stackId="recebido"
                fill={s.color}
                stroke="var(--surface)"
                strokeWidth={1.5}
                radius={i === stack.length - 1 ? [4, 4, 0, 0] : 0}
                maxBarSize={32}
                isAnimationActive={!reduceMotion}
              >
                {i === stack.length - 1 && (
                  <LabelList
                    dataKey="period"
                    content={(p) => {
                      const { x, y, width, value } = p as { x?: number | string; y?: number | string; width?: number | string; value?: unknown }
                      const row = rows.find((r) => r.period === value)
                      if (!row || value !== best || x === undefined || y === undefined || width === undefined) return null
                      return (
                        <text x={Number(x) + Number(width) / 2} y={Number(y) - 6} textAnchor="middle" fill="var(--ink)" fontSize={11} fontWeight={600}>
                          {euros.format(row.total)} €
                        </text>
                      )
                    }}
                  />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend series={series} />
    </div>
  )
}

/** Legenda com o total de cada fatia no período (a cor nunca é a única pista). */
function ChartLegend({ series }: { series: ChartSeries[] }) {
  return (
    <ul className="flex flex-col gap-1.5 px-2 text-sm" aria-label="Total de cada parte no período">
      {series.map((s, i) => (
        <li key={s.key} className={i === 1 ? 'flex items-center gap-2 border-t border-line pt-1.5' : 'flex items-center gap-2'}>
          <span aria-hidden className="size-3 shrink-0 rounded-sm" style={{ background: s.color }} />
          <span className="min-w-0 flex-1 text-muted">{s.name}</span>
          <Money cents={s.total} className="font-semibold" />
        </li>
      ))}
    </ul>
  )
}
