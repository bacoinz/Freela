import { addMonths, makeDate, periodOf, periodParts, periodRange } from './dates'
import type { AppData, Cents, ISODate, Installment, Job, OpsContext, Period, RecurringIncome } from './types'

/** Ocorrência futura de um rendimento fixo (ainda não criada como trabalho). */
export interface VirtualRecurring {
  recurring: RecurringIncome
  period: Period
  dueDate: ISODate
  amount: Cents
}

/** Data prevista do pagamento do mês de trabalho `period` (no próprio mês ou no seguinte). */
export function recurringDueDate(rec: RecurringIncome, period: Period): ISODate {
  return recurringWorkDate(rec, rec.payMonth === 'next' ? addMonths(period, 1) : period)
}

/** Data do trabalho de um mês: o dia definido, dentro do próprio mês de trabalho. */
export function recurringWorkDate(rec: RecurringIncome, period: Period): ISODate {
  const [y, m] = periodParts(period)
  return makeDate(y, m, rec.dayOfMonth)
}

/** O mês de trabalho `period` conta? (rendimento ativo, já começado, mês escolhido e não saltado) */
export function recurringAppliesTo(rec: RecurringIncome, period: Period): boolean {
  const [, m] = periodParts(period)
  return rec.active && period >= rec.startPeriod && rec.months.includes(m) && !rec.skippedPeriods.includes(period)
}

function existingKeys(data: AppData): Set<string> {
  return new Set(data.jobs.filter((j) => j.recurringId && j.period).map((j) => `${j.recurringId}|${j.period}`))
}

/**
 * Trabalhos "a receber" que faltam criar para os rendimentos fixos:
 * de `startPeriod` até ao mês atual, só nos meses ativos, sem duplicar nem repor meses saltados.
 */
export function generateRecurringJobs(data: AppData, ctx: OpsContext): Job[] {
  const current = periodOf(ctx.today)
  const existing = existingKeys(data)
  const out: Job[] = []
  for (const rec of data.recurring) {
    for (const period of periodRange(rec.startPeriod, current)) {
      if (!recurringAppliesTo(rec, period) || existing.has(`${rec.id}|${period}`)) continue
      const due = recurringDueDate(rec, period)
      const inst: Installment = { id: ctx.newId(), amount: rec.amount, dueDate: due }
      if (rec.methodId) inst.expectedMethodId = rec.methodId
      const now = ctx.nowISO()
      out.push({
        id: ctx.newId(),
        title: rec.title,
        categoryId: rec.categoryId,
        payerId: rec.payerId,
        workDate: recurringWorkDate(rec, period),
        installments: [inst],
        recurringId: rec.id,
        period,
        createdAt: now,
        updatedAt: now,
      })
    }
  }
  return out
}

/**
 * Meses de trabalho futuros dos rendimentos fixos (depois do mês atual), para mostrar como "previsto".
 * Atenção: com pagamento no mês seguinte, `dueDate` cai no mês a seguir a `period`.
 */
export function virtualRecurring(data: AppData, today: ISODate, untilPeriod: Period): VirtualRecurring[] {
  const existing = existingKeys(data)
  const from = addMonths(periodOf(today), 1)
  const out: VirtualRecurring[] = []
  for (const rec of data.recurring) {
    for (const period of periodRange(from, untilPeriod)) {
      if (!recurringAppliesTo(rec, period) || existing.has(`${rec.id}|${period}`)) continue
      out.push({ recurring: rec, period, dueDate: recurringDueDate(rec, period), amount: rec.amount })
    }
  }
  return out
}
