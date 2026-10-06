import { periodOf } from '../../domain/dates'
import { isReceived, jobTotal, paidAmount, remainingAmount } from '../../domain/installments'
import { overdueDateOf } from '../../domain/jobs'
import { normalizeName, payerKey, payerLabel } from '../../domain/payers'
import type { AppData, Cents, ISODate, Job, Period } from '../../domain/types'

export interface JobFilters {
  /** "A receber" (com valores em falta) ou "Todos". */
  tab: 'receber' | 'todos'
  query?: string
  categoryId?: string
  payerKey?: string
  methodId?: string
  year?: number
}

export interface MonthGroup {
  period: Period
  total: Cents
  received: Cents
  jobs: Job[]
}

/** Data de atraso mais antiga entre as prestações por receber. */
function earliestOverdue(job: Job, overdueDays: number): ISODate {
  const dates = job.installments.filter((i) => !isReceived(i)).map((i) => overdueDateOf(i, job, overdueDays))
  return dates.sort()[0] ?? '9999-12-31'
}

export function filterJobs(data: AppData, f: JobFilters, _today: ISODate): Job[] {
  const q = f.query ? normalizeName(f.query) : ''
  const out = data.jobs.filter((job) => {
    if (f.tab === 'receber' && remainingAmount(job) <= 0) return false
    if (f.categoryId && job.categoryId !== f.categoryId) return false
    if (f.payerKey && payerKey(job) !== f.payerKey) return false
    if (f.methodId && !job.installments.some((i) => i.methodId === f.methodId || i.expectedMethodId === f.methodId)) return false
    if (f.year && Number(job.workDate.slice(0, 4)) !== f.year) return false
    if (q) {
      const hay = normalizeName(`${job.title} ${payerLabel(job, data.payers)} ${job.notes ?? ''}`)
      if (!hay.includes(q)) return false
    }
    return true
  })
  if (f.tab === 'receber') {
    const od = data.settings.overdueDays
    return out.sort((a, b) => earliestOverdue(a, od).localeCompare(earliestOverdue(b, od)) || b.workDate.localeCompare(a.workDate))
  }
  return out.sort((a, b) => b.workDate.localeCompare(a.workDate) || b.createdAt.localeCompare(a.createdAt))
}

/** Agrupa (pela ordem recebida) por mês da data do trabalho. */
export function groupByMonth(jobs: Job[]): MonthGroup[] {
  const groups: MonthGroup[] = []
  for (const job of jobs) {
    const period = periodOf(job.workDate)
    let g = groups.find((x) => x.period === period)
    if (!g) {
      g = { period, total: 0, received: 0, jobs: [] }
      groups.push(g)
    }
    g.total += jobTotal(job)
    g.received += paidAmount(job)
    g.jobs.push(job)
  }
  return groups
}
