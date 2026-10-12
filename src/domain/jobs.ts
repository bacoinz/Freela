import { addDays } from './dates'
import { isReceived } from './installments'
import type { ISODate, Installment, Job } from './types'

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

export function nextPendingInstallment(job: Job): Installment | undefined {
  return job.installments.find((i) => !isReceived(i))
}

export const STATUS_LABEL: Record<JobStatus, string> = {
  received: 'Recebido',
  overdue: 'Atrasado',
  partial: 'Parcial',
  pending: 'Pendente',
}
