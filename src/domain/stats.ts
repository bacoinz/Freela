import { addMonths, diffDays, isoParts, makeDate, periodOf, periodRange, startOfPeriod } from './dates'
import { isReceived, remainingAmount } from './installments'
import { installmentInvest, installmentParts, jobInvestDone, jobInvestExpected, jobInvestPending, planFor, sumParts } from './invest'
import { isInstallmentOverdue, overdueDateOf } from './jobs'
import { NEUTRAL_COLOR, payerColor, payerKey, payerLabel } from './payers'
import type { AppData, Cents, ISODate, Period, InvestPart } from './types'

/** Período das estatísticas: um ano, os últimos 12 meses ou tudo. */
export type StatsPreset = { kind: 'year'; year: number } | { kind: 'last12' } | { kind: 'all' }

export interface DateRange {
  from: ISODate
  to: ISODate
}

/** Um pagamento recebido (prestação), com o contexto do trabalho. */
export interface ReceivedEntry {
  date: ISODate
  amount: Cents
  invest: Cents
  /** Quanto do investimento vai para cada destino. */
  parts: InvestPart[]
  methodId: string
  categoryId: string
  payerKey: string
  jobId: string
  recurring: boolean
}

/** Uma fatia do investimento nos gráficos: destinos com o mesmo nome contam juntos. */
export interface InvestSeries {
  key: string
  name: string
  total: Cents
}

export const investKey = (name: string) => name.trim().toLocaleLowerCase('pt-PT')

export interface MonthTotal {
  period: Period
  total: Cents
  invest: Cents
  /** Investimento do mês por destino (chave: `investKey` do nome). */
  investParts: Record<string, Cents>
  byCategory: Record<string, Cents>
}

export interface Breakdown {
  key: string
  label: string
  color?: string
  total: Cents
  count: number
  pct: number
}

export interface PayerStat {
  key: string
  label: string
  color: string
  total: Cents
  jobs: number
  avgPerJob: Cents
  /** Média de dias entre o trabalho e o último pagamento (trabalhos pagos no período). */
  avgDaysToPay?: number
  /** Quanto deve neste momento (independentemente do período). */
  owed: Cents
}

export interface StatsSummary {
  total: Cents
  months: number
  monthlyAvg: Cents
  jobsCount: number
  avgPerJob: Cents
  invest: Cents
  fixed: Cents
  variable: Cents
  prevTotal: Cents
  deltaPct?: number
}

export interface PendingSummary {
  total: Cents
  count: number
  overdueTotal: Cents
  overdueCount: number
  oldest?: { jobId: string; installmentId: string; overdueDate: ISODate; amount: Cents }
}

export interface Stats {
  range: DateRange
  summary: StatsSummary
  monthly: MonthTotal[]
  /** Destinos do investimento no período (os do plano atual primeiro), com o total de cada um. */
  investSeries: InvestSeries[]
  best?: MonthTotal
  worst?: MonthTotal
  byMethod: Breakdown[]
  byCategory: Breakdown[]
  byPayer: PayerStat[]
  investAllTime: Cents
  /** Já marcado como investido (desde o início). */
  investDone: Cents
  /** Já investido em cada destino (desde o início; fica o nome mais recente). */
  investDoneParts: InvestPart[]
  /** Recebido mas ainda por investir (desde o início). */
  investPending: Cents
  investExpected: Cents
  statePaid: { total: Cents; byPeriod: Record<Period, Cents> }
  pending: PendingSummary
}

/** Todos os pagamentos recebidos, por ordem de data. */
export function receivedEntries(data: AppData): ReceivedEntry[] {
  const out: ReceivedEntry[] = []
  for (const job of data.jobs) {
    for (const inst of job.installments) {
      if (!isReceived(inst)) continue
      out.push({
        date: inst.receivedDate!,
        amount: inst.amount,
        invest: installmentInvest(inst, data.settings.investPlans, inst.receivedDate!),
        parts: installmentParts(inst, data.settings.investPlans, inst.receivedDate!),
        methodId: inst.methodId ?? '',
        categoryId: job.categoryId,
        payerKey: payerKey(job),
        jobId: job.id,
        recurring: job.recurringId !== undefined,
      })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export function presetRange(preset: StatsPreset, data: AppData, today: ISODate): DateRange {
  const [y] = isoParts(today)
  switch (preset.kind) {
    case 'year':
      // O ano atual vai até hoje; os outros anos são completos.
      return { from: `${preset.year}-01-01`, to: preset.year === y ? today : `${preset.year}-12-31` }
    case 'last12':
      return { from: startOfPeriod(addMonths(periodOf(today), -11)), to: today }
    case 'all': {
      const first = receivedEntries(data)[0]?.date
      return { from: first && first < today ? first : today, to: today }
    }
  }
}

/** Anos a mostrar: do primeiro ano com recebimentos até ao ano seguinte ao atual (no máximo 3). */
export function statsYears(data: AppData, today: ISODate): number[] {
  const [y] = isoParts(today)
  const first = receivedEntries(data)[0]?.date
  const from = Math.max(Math.min(first ? isoParts(first)[0] : y, y), y - 1)
  const years: number[] = []
  for (let year = from; year <= y + 1; year++) years.push(year)
  return years
}

const inRange = (d: ISODate, r: DateRange) => d >= r.from && d <= r.to

/** O mesmo intervalo, um ano antes (29/02 passa a 28/02). */
function previousYear(r: DateRange): DateRange {
  const shift = (d: ISODate) => {
    const [y, m, day] = isoParts(d)
    return makeDate(y - 1, m, day)
  }
  return { from: shift(r.from), to: shift(r.to) }
}

function breakdown(
  entries: ReceivedEntry[],
  keyOf: (e: ReceivedEntry) => string,
  labelOf: (key: string) => string,
  colorOf?: (key: string) => string | undefined,
): Breakdown[] {
  const total = entries.reduce((s, e) => s + e.amount, 0)
  const map = new Map<string, { total: Cents; count: number }>()
  for (const e of entries) {
    const k = keyOf(e)
    const cur = map.get(k) ?? { total: 0, count: 0 }
    cur.total += e.amount
    cur.count++
    map.set(k, cur)
  }
  return [...map.entries()]
    .map(([key, v]) => {
      const b: Breakdown = { key, label: labelOf(key), total: v.total, count: v.count, pct: total ? (v.total / total) * 100 : 0 }
      const color = colorOf?.(key)
      if (color) b.color = color
      return b
    })
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
}

function payerStats(data: AppData, inPeriod: ReceivedEntry[], range: DateRange): PayerStat[] {
  const byKey = new Map<string, PayerStat & { jobIds: Set<string>; days: number[] }>()
  const get = (key: string, label: string, color: string) => {
    let s = byKey.get(key)
    if (!s) {
      s = { key, label, color, total: 0, jobs: 0, avgPerJob: 0, owed: 0, jobIds: new Set(), days: [] }
      byKey.set(key, s)
    }
    return s
  }
  const jobsById = new Map(data.jobs.map((j) => [j.id, j]))

  for (const e of inPeriod) {
    const job = jobsById.get(e.jobId)!
    const s = get(e.payerKey, payerLabel(job, data.payers), payerColor(job, data.payers))
    s.total += e.amount
    s.jobIds.add(e.jobId)
  }
  for (const job of data.jobs) {
    const owed = remainingAmount(job)
    const key = payerKey(job)
    if (owed > 0) get(key, payerLabel(job, data.payers), payerColor(job, data.payers)).owed += owed
    if (owed === 0 && job.installments.length > 0) {
      const last = job.installments.map((i) => i.receivedDate!).sort().at(-1)!
      if (inRange(last, range)) byKey.get(key)?.days.push(Math.max(0, diffDays(job.workDate, last)))
    }
  }

  return [...byKey.values()]
    .map(({ jobIds, days, ...s }) => {
      const out: PayerStat = { ...s, jobs: jobIds.size, avgPerJob: jobIds.size ? Math.round(s.total / jobIds.size) : 0 }
      if (days.length) out.avgDaysToPay = Math.round(days.reduce((a, b) => a + b, 0) / days.length)
      return out
    })
    .sort((a, b) => b.total - a.total || b.owed - a.owed || a.label.localeCompare(b.label))
}

function pendingSummary(data: AppData, today: ISODate): PendingSummary {
  const s: PendingSummary = { total: 0, count: 0, overdueTotal: 0, overdueCount: 0 }
  for (const job of data.jobs) {
    const remaining = remainingAmount(job)
    if (remaining <= 0) continue
    s.total += remaining
    s.count++
    let jobOverdue = false
    for (const inst of job.installments) {
      if (isReceived(inst)) continue
      const od = overdueDateOf(inst, job, data.settings.overdueDays)
      if (isInstallmentOverdue(inst, job, today, data.settings.overdueDays)) {
        s.overdueTotal += inst.amount
        jobOverdue = true
      }
      if (!s.oldest || od < s.oldest.overdueDate) {
        s.oldest = { jobId: job.id, installmentId: inst.id, overdueDate: od, amount: inst.amount }
      }
    }
    if (jobOverdue) s.overdueCount++
  }
  return s
}

/** Estatísticas do período (base: pagamentos recebidos, pela data em que foram recebidos). */
export function computeStats(data: AppData, range: DateRange, today: ISODate): Stats {
  const all = receivedEntries(data)
  const plans = data.settings.investPlans
  const entries = all.filter((e) => inRange(e.date, range))
  const total = entries.reduce((s, e) => s + e.amount, 0)

  const monthly: MonthTotal[] = periodRange(periodOf(range.from), periodOf(range.to)).map((period) => ({
    period,
    total: 0,
    invest: 0,
    investParts: {},
    byCategory: {},
  }))
  const monthIdx = new Map(monthly.map((m, i) => [m.period, i]))
  for (const e of entries) {
    const m = monthly[monthIdx.get(periodOf(e.date))!]!
    m.total += e.amount
    m.invest += e.invest
    m.byCategory[e.categoryId] = (m.byCategory[e.categoryId] ?? 0) + e.amount
  }

  // Fatias do investimento: os destinos do plano atual primeiro; o nome que fica é o do plano atual ou o mais recente.
  const series = new Map<string, InvestSeries>()
  for (const dest of planFor(plans, periodOf(today)).destinations) series.set(investKey(dest.name), { key: investKey(dest.name), name: dest.name, total: 0 })
  const current = new Set(series.keys())
  for (const e of entries) {
    const m = monthly[monthIdx.get(periodOf(e.date))!]!
    for (const p of e.parts) {
      const key = investKey(p.name)
      const sr = series.get(key) ?? { key, name: p.name, total: 0 }
      if (!current.has(key)) sr.name = p.name
      sr.total += p.amount
      series.set(key, sr)
      m.investParts[key] = (m.investParts[key] ?? 0) + p.amount
    }
  }
  let best: MonthTotal | undefined
  let worst: MonthTotal | undefined
  for (const m of monthly) {
    if (!best || m.total > best.total) best = m
    if (!worst || m.total < worst.total) worst = m
  }

  const prev = previousYear(range)
  const prevTotal = all.filter((e) => inRange(e.date, prev)).reduce((s, e) => s + e.amount, 0)
  const jobsCount = new Set(entries.map((e) => e.jobId)).size
  const fixed = entries.filter((e) => e.recurring).reduce((s, e) => s + e.amount, 0)

  const summary: StatsSummary = {
    total,
    months: monthly.length,
    monthlyAvg: monthly.length ? Math.round(total / monthly.length) : 0,
    jobsCount,
    avgPerJob: jobsCount ? Math.round(total / jobsCount) : 0,
    invest: entries.reduce((s, e) => s + e.invest, 0),
    fixed,
    variable: total - fixed,
    prevTotal,
  }
  if (prevTotal > 0) summary.deltaPct = ((total - prevTotal) / prevTotal) * 100

  const methodName = (id: string) => data.methods.find((m) => m.id === id)?.name ?? 'Sem método'
  const category = (id: string) => data.categories.find((c) => c.id === id)

  const statePaid = { total: 0, byPeriod: {} as Record<Period, Cents> }
  for (const r of data.obligationRecords) {
    if (r.status !== 'done' || !r.amountPaid) continue
    const d = r.date ?? r.originalDate
    if (!inRange(d, range)) continue
    statePaid.total += r.amountPaid
    statePaid.byPeriod[periodOf(d)] = (statePaid.byPeriod[periodOf(d)] ?? 0) + r.amountPaid
  }

  const stats: Stats = {
    range,
    summary,
    monthly,
    investSeries: [...series.values()].filter((x) => x.total > 0),
    byMethod: breakdown(entries, (e) => e.methodId, methodName),
    byCategory: breakdown(
      entries,
      (e) => e.categoryId,
      (k) => category(k)?.name ?? 'Sem categoria',
      (k) => category(k)?.color ?? NEUTRAL_COLOR,
    ),
    byPayer: payerStats(data, entries, range),
    investAllTime: all.filter((e) => e.date <= today).reduce((s, e) => s + e.invest, 0),
    investDone: data.jobs.reduce((s, j) => s + jobInvestDone(j, plans, today), 0),
    investDoneParts: sumParts(data.jobs.flatMap((j) => j.installments.flatMap((i) => (i.invested ? [i.invested.parts] : [])))),
    investPending: data.jobs.reduce((s, j) => s + jobInvestPending(j, plans, today), 0),
    investExpected: data.jobs.reduce((s, j) => s + jobInvestExpected(j, plans, today), 0),
    statePaid,
    pending: pendingSummary(data, today),
  }
  if (best) stats.best = best
  if (worst) stats.worst = worst
  return stats
}
