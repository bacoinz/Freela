import { addDays, addMonths, endOfPeriod, periodOf, startOfPeriod } from '../../domain/dates'
import { isReceived, jobTotal } from '../../domain/installments'
import { installmentInvest, isInstallmentOverdue, overdueDateOf } from '../../domain/jobs'
import { listOccurrences, type Occurrence } from '../../domain/obligations'
import { recurringAppliesTo, recurringDueDate } from '../../domain/recurring'
import type { AppData, Cents, ISODate, Installment, Job, Period } from '../../domain/types'

export interface PendingItem {
  job: Job
  /** Próxima prestação por receber (a mais antiga). */
  installment: Installment
  overdueDate: ISODate
  overdue: boolean
  /** Total que falta receber deste trabalho. */
  remaining: Cents
}

export interface FixedStatus {
  recurringId: string
  title: string
  /** Mês de trabalho a que o pagamento diz respeito. */
  period: Period
  amount: Cents
  dueDate: ISODate
  received: boolean
  jobId?: string
}

export interface MonthOverview {
  received: Cents
  invest: Cents
  kept: Cents
  statePaid: Cents
  pending: { total: Cents; count: number; overdueCount: number; overdueTotal: Cents; items: PendingItem[] }
  fixed: FixedStatus[]
  nextObligations: Occurrence[]
  recent: { job: Job; installment: Installment }[]
}

/** Tudo o que o ecrã Início mostra para um mês. */
export function monthOverview(data: AppData, period: Period, today: ISODate): MonthOverview {
  const from = startOfPeriod(period)
  const to = endOfPeriod(period)
  const od = data.settings.overdueDays

  let received = 0
  let invest = 0
  const recent: { job: Job; installment: Installment }[] = []
  const pendingItems: PendingItem[] = []
  let pendingTotal = 0
  let overdueTotal = 0

  for (const job of data.jobs) {
    let remaining = 0
    let next: Installment | undefined
    for (const inst of job.installments) {
      if (isReceived(inst)) {
        recent.push({ job, installment: inst })
        if (inst.receivedDate! >= from && inst.receivedDate! <= to) {
          received += inst.amount
          invest += installmentInvest(inst, job)
        }
        continue
      }
      remaining += inst.amount
      if (isInstallmentOverdue(inst, job, today, od)) overdueTotal += inst.amount
      if (!next || overdueDateOf(inst, job, od) < overdueDateOf(next, job, od)) next = inst
    }
    if (next) {
      pendingTotal += remaining
      pendingItems.push({
        job,
        installment: next,
        overdueDate: overdueDateOf(next, job, od),
        overdue: isInstallmentOverdue(next, job, today, od),
        remaining,
      })
    }
  }
  pendingItems.sort((a, b) => a.overdueDate.localeCompare(b.overdueDate))
  recent.sort((a, b) => b.installment.receivedDate!.localeCompare(a.installment.receivedDate!))

  let statePaid = 0
  for (const r of data.obligationRecords) {
    const d = r.date ?? r.originalDate
    if (r.status === 'done' && r.amountPaid && d >= from && d <= to) statePaid += r.amountPaid
  }

  const fixed: FixedStatus[] = []
  for (const rec of data.recurring) {
    // O pagamento que chega neste mês: o do próprio mês ou, se é pago no mês seguinte, o do mês anterior.
    const work = rec.payMonth === 'next' ? addMonths(period, -1) : period
    const job = data.jobs.find((j) => j.recurringId === rec.id && j.period === work)
    if (job) {
      fixed.push({
        recurringId: rec.id,
        title: rec.title,
        period: work,
        amount: jobTotal(job),
        dueDate: job.installments[0]?.dueDate ?? job.workDate,
        received: job.installments.every(isReceived),
        jobId: job.id,
      })
    } else if (work > periodOf(today) && recurringAppliesTo(rec, work)) {
      fixed.push({ recurringId: rec.id, title: rec.title, period: work, amount: rec.amount, dueDate: recurringDueDate(rec, work), received: false })
    }
  }

  const nextObligations = listOccurrences(data, addDays(today, -365), addDays(today, 30), today).filter(
    (o) => o.state === 'overdue' || o.state === 'today' || o.state === 'upcoming',
  )

  return {
    received,
    invest,
    kept: received - invest,
    statePaid,
    pending: {
      total: pendingTotal,
      count: pendingItems.length,
      overdueCount: pendingItems.filter((p) => p.overdue).length,
      overdueTotal,
      items: pendingItems,
    },
    fixed,
    nextObligations,
    recent: recent.slice(0, 5),
  }
}
