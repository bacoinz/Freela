import type { ReactNode } from 'react'
import { formatMoney } from '../../domain/money'
import type { Breakdown } from '../../domain/stats'
import type { Cents } from '../../domain/types'
import { Badge } from '../components/Status'

const pctFmt = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 })

/** Barras horizontais (uma cor); a identidade vai no marcador ao lado do nome. */
export function BreakdownList({ items, leading, topLabel }: { items: Breakdown[]; leading?: (b: Breakdown) => ReactNode; topLabel?: string }) {
  const max = Math.max(1, ...items.map((i) => i.total))
  return (
    <ul className="flex flex-col gap-3.5 px-4 py-4">
      {items.map((b, i) => (
        <li key={b.key} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              {leading?.(b)}
              <span className="truncate font-medium">{b.label}</span>
              {i === 0 && topLabel && items.length > 1 && <Badge tone="info">{topLabel}</Badge>}
            </span>
            <span className="tnum shrink-0 text-muted">
              <span className="font-semibold text-ink">{formatMoney(b.total)}</span> · {pctFmt.format(b.pct)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-soft" aria-hidden>
            <div className="h-full rounded-full bg-chart-1" style={{ width: `${(b.total / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Proporção de duas partes (ex.: fixo vs variável) — medidor com rótulos. */
export function SplitMeter({ a, b, aLabel, bLabel }: { a: Cents; b: Cents; aLabel: string; bLabel: string }) {
  const total = a + b
  const pa = total ? (a / total) * 100 : 0
  return (
    <div className="flex flex-col gap-2.5 px-4 py-4">
      <div
        role="img"
        aria-label={`${aLabel} ${pctFmt.format(pa)}%, ${bLabel} ${pctFmt.format(100 - pa)}%`}
        className="flex h-3 overflow-hidden rounded-full bg-primary-soft"
      >
        <div className="h-full rounded-full bg-chart-1" style={{ width: `${pa}%` }} />
      </div>
      <div className="flex justify-between gap-3 text-sm">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-chart-1" />
          {aLabel} <span className="tnum font-semibold">{formatMoney(a)}</span>
          <span className="text-muted">({pctFmt.format(pa)}%)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-primary-soft ring-1 ring-inset ring-line" />
          {bLabel} <span className="tnum font-semibold">{formatMoney(b)}</span>
        </span>
      </div>
    </div>
  )
}
