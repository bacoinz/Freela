// Investimento: a % de cada pagamento recebido e a sua divisão pelos destinos (ex.: poupança, bitcoin).
// A % e a divisão vêm do plano do mês em que o pagamento é recebido; o que já foi investido fica como foi marcado.
import { periodOf } from './dates'
import { isReceived } from './installments'
import { percentOf } from './money'
import type { AppData, Cents, ISODate, Installment, InvestDestination, InvestPart, InvestPlan, Job, Period } from './types'

/** Mês do primeiro plano (vale para tudo o que veio antes de qualquer mudança). */
export const FIRST_PLAN_PERIOD = '2000-01'

export function defaultPlan(pct = 15): InvestPlan {
  return {
    from: FIRST_PLAN_PERIOD,
    pct,
    destinations: [
      { id: 'poupanca', name: 'Conta poupança', pct: 20 },
      { id: 'bitcoin', name: 'Bitcoin', pct: 80 },
    ],
  }
}

/** Plano em vigor num mês: o último que já tinha começado. */
export function planFor(plans: InvestPlan[], period: Period): InvestPlan {
  let out = plans[0] ?? defaultPlan()
  for (const p of plans) if (p.from <= period) out = p
  return out
}

export function currentPlan(data: AppData, today: ISODate): InvestPlan {
  return planFor(data.settings.investPlans, periodOf(today))
}

/** Plano que conta para um pagamento: o do mês em que foi recebido (por receber: o atual). */
export function installmentPlan(inst: Installment, plans: InvestPlan[], today: ISODate): InvestPlan {
  return planFor(plans, periodOf(inst.receivedDate ?? today))
}

const sumAmounts = (parts: InvestPart[]) => parts.reduce((s, p) => s + p.amount, 0)

/** Parte do pagamento que vai para investimento. */
export function installmentInvest(inst: Installment, plans: InvestPlan[], today: ISODate): Cents {
  if (inst.invested) return sumAmounts(inst.invested.parts)
  return percentOf(inst.amount, installmentPlan(inst, plans, today).pct)
}

/** Divide um valor pelos destinos (ao cêntimo; a soma dá sempre o total). */
export function splitInvest(amount: Cents, destinations: InvestDestination[]): InvestPart[] {
  const exact = destinations.map((d) => (amount * d.pct) / 100)
  const base = exact.map((v) => Math.floor(v + 1e-9))
  let rest = amount - base.reduce((s, v) => s + v, 0)
  const byFraction = exact.map((v, i) => [v - base[i]!, i] as const).sort((a, b) => b[0] - a[0] || b[1] - a[1])
  for (let k = 0; rest > 0 && k < byFraction.length; k++, rest--) base[byFraction[k]![1]]!++
  return destinations.map((d, i) => ({ destinationId: d.id, name: d.name, amount: base[i]! }))
}

/** Quanto do pagamento vai para cada destino (a fotografia, se já foi investido). */
export function installmentParts(inst: Installment, plans: InvestPlan[], today: ISODate): InvestPart[] {
  if (inst.invested) return inst.invested.parts
  const plan = installmentPlan(inst, plans, today)
  return splitInvest(percentOf(inst.amount, plan.pct), plan.destinations)
}

/** Junta partes por destino (fica o nome mais recente). */
export function sumParts(lists: InvestPart[][]): InvestPart[] {
  const out = new Map<string, InvestPart>()
  for (const list of lists) {
    for (const p of list) {
      const cur = out.get(p.destinationId)
      out.set(p.destinationId, { destinationId: p.destinationId, name: p.name, amount: (cur?.amount ?? 0) + p.amount })
    }
  }
  return [...out.values()]
}

const sumInvest = (job: Job, plans: InvestPlan[], today: ISODate, keep: (i: Installment) => boolean) =>
  job.installments.reduce((s, i) => (keep(i) ? s + installmentInvest(i, plans, today) : s), 0)

/** Investimento sobre o que já foi recebido (investido ou não). */
export const jobInvestReceived = (job: Job, plans: InvestPlan[], today: ISODate) => sumInvest(job, plans, today, isReceived)
/** Investimento previsto sobre o que ainda falta receber. */
export const jobInvestExpected = (job: Job, plans: InvestPlan[], today: ISODate) => sumInvest(job, plans, today, (i) => !isReceived(i))
/** Já investido. */
export const jobInvestDone = (job: Job, plans: InvestPlan[], today: ISODate) => sumInvest(job, plans, today, (i) => !!i.invested)
/** Recebido mas ainda por investir. */
export const jobInvestPending = (job: Job, plans: InvestPlan[], today: ISODate) =>
  sumInvest(job, plans, today, (i) => isReceived(i) && !i.invested)

/** Quanto do trabalho vai para cada destino (recebido e previsto). */
export function jobParts(job: Job, plans: InvestPlan[], today: ISODate): InvestPart[] {
  return sumParts(job.installments.map((i) => installmentParts(i, plans, today)))
}

export interface PendingInvestItem {
  job: Job
  installment: Installment
  amount: Cents
  parts: InvestPart[]
}

export interface PendingInvestMonth {
  period: Period
  total: Cents
  items: PendingInvestItem[]
}

/** Pagamentos recebidos ainda por investir, por mês de recebimento (o mais recente primeiro). */
export function pendingInvestments(data: AppData, today: ISODate): PendingInvestMonth[] {
  const plans = data.settings.investPlans
  const items: PendingInvestItem[] = []
  for (const job of data.jobs) {
    for (const inst of job.installments) {
      if (!isReceived(inst) || inst.invested) continue
      const amount = installmentInvest(inst, plans, today)
      if (amount > 0) items.push({ job, installment: inst, amount, parts: installmentParts(inst, plans, today) })
    }
  }
  items.sort((a, b) => b.installment.receivedDate!.localeCompare(a.installment.receivedDate!))
  const months: PendingInvestMonth[] = []
  for (const item of items) {
    const period = periodOf(item.installment.receivedDate!)
    let m = months.find((x) => x.period === period)
    if (!m) {
      m = { period, total: 0, items: [] }
      months.push(m)
    }
    m.total += item.amount
    m.items.push(item)
  }
  return months
}

export interface InvestOverview {
  pendingTotal: Cents
  pendingParts: InvestPart[]
  months: PendingInvestMonth[]
  investedTotal: Cents
  investedParts: InvestPart[]
  /** Últimos pagamentos marcados como investidos. */
  recent: { job: Job; installment: Installment }[]
}

export function investOverview(data: AppData, today: ISODate): InvestOverview {
  const months = pendingInvestments(data, today)
  const all = months.flatMap((m) => m.items)
  const invested = data.jobs.flatMap((job) => job.installments.filter((i) => i.invested).map((installment) => ({ job, installment })))
  invested.sort(
    (a, b) =>
      b.installment.invested!.date.localeCompare(a.installment.invested!.date) ||
      (b.installment.receivedDate ?? '').localeCompare(a.installment.receivedDate ?? ''),
  )
  const investedParts = sumParts(invested.map((x) => x.installment.invested!.parts))
  return {
    pendingTotal: all.reduce((s, i) => s + i.amount, 0),
    pendingParts: sumParts(all.map((i) => i.parts)),
    months,
    investedTotal: sumAmounts(investedParts),
    investedParts,
    recent: invested.slice(0, 10),
  }
}

/** "12,5" a partir de 12.5 (arredondado a 2 casas). */
export function pctText(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

/** Valida a % e os destinos de um plano (lança um erro em PT a dizer o que corrigir). */
export function validatePlan(pct: number, destinations: InvestDestination[]): void {
  const okPct = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100
  if (!okPct(pct)) throw new Error('A percentagem para investir tem de estar entre 0 e 100.')
  if (destinations.length === 0) throw new Error('Tem de haver pelo menos um destino.')
  if (destinations.length > 10) throw new Error('No máximo 10 destinos.')
  if (destinations.some((d) => !d.name.trim())) throw new Error('Cada destino tem de ter um nome.')
  if (destinations.some((d) => !okPct(d.pct))) throw new Error('A % de cada destino tem de estar entre 0 e 100.')
  const sum = Math.round(destinations.reduce((s, d) => s + d.pct, 0) * 100) / 100
  if (sum !== 100) {
    const diff = Math.abs(100 - sum)
    throw new Error(`As % dos destinos somam ${pctText(sum)}% — ${sum < 100 ? 'faltam' : 'sobram'} ${pctText(diff)}%.`)
  }
}

/** Dois planos com a mesma % e os mesmos destinos (ignora o mês). */
export function samePlan(a: InvestPlan, b: InvestPlan): boolean {
  return (
    a.pct === b.pct &&
    a.destinations.length === b.destinations.length &&
    a.destinations.every((d, i) => {
      const o = b.destinations[i]!
      return d.id === o.id && d.name === o.name && (d.where ?? '') === (o.where ?? '') && d.pct === o.pct
    })
  )
}
