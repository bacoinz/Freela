import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatPeriodPT, MONTHS_SHORT_PT, periodParts } from '../../domain/dates'
import { formatMoney } from '../../domain/money'
import type { Period } from '../../domain/types'
import type { MonthTotal } from '../../domain/stats'

interface Row {
  period: Period
  label: string
  value: number
}

const nf = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 })
const euros = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 })
/** Eixo: 0, 500, 1 mil, 1,5 mil… (euros) */
const compact = (v: number) => (v >= 1000 ? `${nf.format(v / 1000)} mil` : nf.format(v))

function MonthTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload: Row }> }) {
  const row = active ? payload?.[0]?.payload : undefined
  if (!row) return null
  return (
    <div className="rounded-xl bg-ink px-3 py-2 text-sm text-bg shadow-float">
      <div className="font-semibold first-letter:uppercase">{formatPeriodPT(row.period)}</div>
      <div className="tnum">{formatMoney(Math.round(row.value * 100))}</div>
    </div>
  )
}

/** Recebido por mês (uma série), com linha da média e o melhor mês identificado. */
export function MonthlyChart({ months, best }: { months: MonthTotal[]; best?: Period }) {
  const rows: Row[] = months.map((m) => {
    const [y, mo] = periodParts(m.period)
    const label = months.length > 12 && mo === 1 ? `${MONTHS_SHORT_PT[0]} ${String(y).slice(2)}` : MONTHS_SHORT_PT[mo - 1]!
    return { period: m.period, label, value: m.total / 100 }
  })
  const avg = rows.length ? rows.reduce((s, r) => s + r.value, 0) / rows.length : 0
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  return (
    <div className="h-[230px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 22, right: 6, left: 0, bottom: 0 }} barCategoryGap={3}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={rows.length > 12 ? 2 : 0}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
          />
          <YAxis width={58} tickLine={false} axisLine={false} tickFormatter={compact} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
          <Tooltip cursor={{ fill: 'var(--neutral-soft)' }} content={(p) => <MonthTooltip active={p.active} payload={p.payload as never} />} />
          {avg > 0 && (
            <ReferenceLine
              y={avg}
              stroke="var(--muted)"
              strokeDasharray="4 4"
              label={{ value: 'média', position: 'insideTopLeft', fill: 'var(--muted)', fontSize: 11 }}
            />
          )}
          <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={!reduceMotion}>
            <LabelList
              dataKey="period"
              content={(p) => {
                const { x, y, width, value } = p as { x?: number | string; y?: number | string; width?: number | string; value?: unknown }
                const row = rows.find((r) => r.period === value)
                if (!row || value !== best || x === undefined || y === undefined || width === undefined) return null
                return (
                  <text x={Number(x) + Number(width) / 2} y={Number(y) - 6} textAnchor="middle" fill="var(--ink)" fontSize={11} fontWeight={600}>
                    {euros.format(row.value)} €
                  </text>
                )
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
