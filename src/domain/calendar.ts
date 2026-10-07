import { addDays, endOfPeriod, periodOf, startOfPeriod, weekdayMon0 } from './dates'
import { isReceived } from './installments'
import { isInstallmentOverdue } from './jobs'
import { listOccurrences, type Occurrence, type OccurrenceState } from './obligations'
import { NEUTRAL_COLOR, payerColor, payerLabel } from './payers'
import { virtualRecurring } from './recurring'
import type { AppData, Cents, ISODate, Period } from './types'

export type CalendarEvent =
  | {
      kind: 'received'
      date: ISODate
      jobId: string
      installmentId: string
      amount: Cents
      title: string
      payer: string
      color: string
      methodId?: string
    }
  | {
      kind: 'expected'
      date: ISODate
      jobId?: string
      installmentId?: string
      recurringId?: string
      amount: Cents
      title: string
      payer: string
      color: string
      overdue: boolean
      /** Mês futuro de um rendimento fixo (ainda não criado). */
      virtual: boolean
    }
  | { kind: 'obligation'; date: ISODate; occurrence: Occurrence; state: OccurrenceState; title: string }

export interface MonthSummary {
  received: Cents
  expected: Cents
  obligationsPending: number
  obligationsDone: number
}

/** Semanas do mês (segunda a domingo), com os dias dos meses vizinhos a completar. */
export function monthGrid(period: Period): ISODate[][] {
  const start = startOfPeriod(period)
  const end = endOfPeriod(period)
  const first = addDays(start, -weekdayMon0(start))
  const last = addDays(end, 6 - weekdayMon0(end))
  const weeks: ISODate[][] = []
  for (let d = first; d <= last; d = addDays(d, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)))
  }
  return weeks
}

/** Eventos de cada dia do mês: recebido, previsto receber e obrigações. */
export function calendarEvents(data: AppData, period: Period, today: ISODate): Record<ISODate, CalendarEvent[]> {
  const start = startOfPeriod(period)
  const end = endOfPeriod(period)
  const inMonth = (d: ISODate | undefined): d is ISODate => d !== undefined && d >= start && d <= end
  const out: Record<ISODate, CalendarEvent[]> = {}
  const add = (e: CalendarEvent) => (out[e.date] ??= []).push(e)

  for (const job of data.jobs) {
    const payer = payerLabel(job, data.payers)
    const color = payerColor(job, data.payers)
    for (const inst of job.installments) {
      if (isReceived(inst)) {
        if (!inMonth(inst.receivedDate)) continue
        const e: CalendarEvent = {
          kind: 'received',
          date: inst.receivedDate,
          jobId: job.id,
          installmentId: inst.id,
          amount: inst.amount,
          title: job.title,
          payer,
          color,
        }
        if (inst.methodId) e.methodId = inst.methodId
        add(e)
      } else if (inMonth(inst.dueDate)) {
        add({
          kind: 'expected',
          date: inst.dueDate,
          jobId: job.id,
          installmentId: inst.id,
          amount: inst.amount,
          title: job.title,
          payer,
          color,
          overdue: isInstallmentOverdue(inst, job, today, data.settings.overdueDays),
          virtual: false,
        })
      }
    }
  }

  if (period > periodOf(today)) {
    for (const v of virtualRecurring(data, today, period)) {
      if (periodOf(v.dueDate) !== period) continue // conta o mês em que o pagamento chega
      const p = data.payers.find((x) => x.id === v.recurring.payerId)
      add({
        kind: 'expected',
        date: v.dueDate,
        recurringId: v.recurring.id,
        amount: v.amount,
        title: v.recurring.title,
        payer: p?.name ?? '',
        color: p?.color ?? NEUTRAL_COLOR,
        overdue: false,
        virtual: true,
      })
    }
  }

  for (const o of listOccurrences(data, start, end, today)) {
    add({ kind: 'obligation', date: o.dueDate, occurrence: o, state: o.state, title: o.rule.title })
  }

  const order = { received: 0, expected: 1, obligation: 2 } as const
  for (const list of Object.values(out)) list.sort((a, b) => order[a.kind] - order[b.kind])
  return out
}

export function monthSummary(events: Record<ISODate, CalendarEvent[]>): MonthSummary {
  const s: MonthSummary = { received: 0, expected: 0, obligationsPending: 0, obligationsDone: 0 }
  for (const list of Object.values(events)) {
    for (const e of list) {
      if (e.kind === 'received') s.received += e.amount
      else if (e.kind === 'expected') s.expected += e.amount
      else if (e.state === 'done' || e.state === 'notApplicable') s.obligationsDone++
      else s.obligationsPending++
    }
  }
  return s
}
