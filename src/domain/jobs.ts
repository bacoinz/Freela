import { addDays } from './dates'
import { isReceived } from './installments'
import { percentOf } from './money'
import type { Cents, ISODate, Installment, Job } from './types'

export type JobStatus = 'received' | 'overdue' | 'partial' | 'pending'

/** Data a partir da qual a prestação conta como atrasada (no dia seguinte). */
export function overdueDateOf(inst: Installment, job: Job, overdueDays: number): ISODate {
  return inst.dueDate ?? addDays(job.workDate, overdueDays)
}

export function isInstallmentOverdue(inst: Installment, job: Job, today: ISODate, overdueDays: number): boolean {
  return !isReceived(inst) && today > overdueDateOf(inst, job, overdueDays)
}

/** recebido → atrasado → parcial → pendente (por esta ordem de prioridade). */
export function jobStatus(job: Job, today: ISODate, overdueDays: number): JobStatus {
  const pending = job.installments.filter((i) => !isReceived(i))
  if (pending.length === 0) return 'received'
  if (pending.some((i) => isInstallmentOverdue(i, job, today, overdueDays))) return 'overdue'
  if (pending.length < job.installments.length) return 'partial'
  return 'pending'
}

/** Parte de uma prestação que vai para investimento (a % do trabalho). */
export function installmentInvest(inst: Installment, job: Job): Cents {
  return percentOf(inst.amount, job.investPct)
}

/** Investimento calculado sobre o que já foi recebido. */
export function jobInvested(job: Job): Cents {
  return job.installments.reduce((s, i) => (isReceived(i) ? s + installmentInvest(i, job) : s), 0)
}

/** Investimento previsto sobre o que ainda falta receber. */
export function jobInvestExpected(job: Job): Cents {
  return job.installments.reduce((s, i) => (isReceived(i) ? s : s + installmentInvest(i, job)), 0)
}

export function nextPendingInstallment(job: Job): Installment | undefined {
  return job.installments.find((i) => !isReceived(i))
}

export const STATUS_LABEL: Record<JobStatus, string> = {
  received: 'Recebido',
  overdue: 'Atrasado',
  partial: 'Parcial',
  pending: 'Pendente',
}
