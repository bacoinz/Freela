import { addDays, isoParts, makeDate, periodOf, periodParts, periodRange, startOfPeriod } from './dates'
import type { AppData, ISODate, ObligationKind, ObligationRecord, ObligationRule, ObligationSchedule } from './types'

export type OccurrenceState = 'done' | 'notApplicable' | 'overdue' | 'today' | 'upcoming'

/** Uma ocorrência concreta de uma obrigação (ex.: "Pagar SS — até 20/10/2026"). */
export interface Occurrence {
  rule: ObligationRule
  /** Prazo calculado pela regra (identifica a ocorrência). */
  originalDate: ISODate
  /** Prazo efetivo (pode ter sido alterado, ex.: prorrogação). */
  dueDate: ISODate
  record?: ObligationRecord
  state: OccurrenceState
}

/**
 * Prazos de referência para trabalhadores independentes (2026), com as regras de lembrete pedidas.
 * Editáveis na app. Se o prazo calhar a um fim de semana/feriado, passa para o dia útil seguinte —
 * aqui fica a data normal, para dar margem.
 */
export function defaultObligationRules(startDate: ISODate, newId: () => string): ObligationRule[] {
  return [
    {
      id: newId(),
      template: 'ss-pagamento',
      title: 'Pagar Segurança Social',
      kind: 'pagamento',
      schedule: { type: 'monthly', day: 20 },
      reminders: { type: 'daysOfMonth', days: [10, 15] },
      active: true,
      startDate,
      notes: 'Contribuições do mês anterior. Pode pagar-se entre o dia 10 e o dia 20.',
    },
    {
      id: newId(),
      template: 'ss-declaracao-trimestral',
      title: 'Declaração trimestral à Segurança Social',
      kind: 'declaracao',
      schedule: { type: 'months', months: [1, 4, 7, 10], day: 'last' },
      reminders: { type: 'repeat', everyDays: 5, from: { type: 'dueMonthStart' }, until: 'done', onDueDay: false },
      active: true,
      startDate,
      notes: 'Declara os rendimentos dos 3 meses anteriores, na Segurança Social Direta.',
    },
    {
      id: newId(),
      template: 'efatura',
      title: 'Validar faturas no e-Fatura',
      kind: 'outro',
      schedule: { type: 'yearly', month: 2, day: 'last' },
      reminders: { type: 'repeat', everyDays: 5, from: { type: 'dueMonthStart' }, until: 'due', onDueDay: false },
      active: true,
      startDate,
      notes: 'Validar as faturas pendentes e, com atividade aberta, indicar as despesas da atividade.',
    },
    {
      id: newId(),
      template: 'irs-entrega',
      title: 'Entregar a declaração de IRS',
      kind: 'declaracao',
      schedule: { type: 'yearly', month: 6, day: 30 },
      reminders: {
        type: 'repeat',
        everyDays: 7,
        from: { type: 'fixedDate', month: 4, day: 1 },
        until: 'due',
        onDueDay: false,
      },
      active: true,
      startDate,
      notes: 'Entrega de 1 de abril a 30 de junho, no Portal das Finanças.',
    },
    {
      id: newId(),
      template: 'irs-pagamento',
      title: 'Pagar IRS (se houver imposto a pagar)',
      kind: 'pagamento',
      schedule: { type: 'yearly', month: 8, day: 31 },
      reminders: { type: 'repeat', everyDays: 7, from: { type: 'dueMonthStart' }, until: 'due', onDueDay: true },
      active: true,
      startDate,
      notes: 'Se este ano não houver imposto a pagar, marca "Não se aplica".',
    },
    {
      id: newId(),
      template: 'irs-pagamentos-conta',
      title: 'Pagamento por conta de IRS',
      kind: 'pagamento',
      schedule: { type: 'months', months: [7, 9, 12], day: 20 },
      reminders: {
        type: 'repeat',
        everyDays: 7,
        from: { type: 'daysBefore', days: 7 },
        until: 'due',
        onDueDay: true,
      },
      active: false,
      startDate,
      notes: 'Só para quem tem pagamentos por conta definidos pelas Finanças.',
    },
  ]
}

/** Prazos nominais de uma regra entre `from` e `to` (inclusive). */
export function scheduleDatesBetween(schedule: ObligationSchedule, from: ISODate, to: ISODate): ISODate[] {
  const inRange = (d: ISODate) => d >= from && d <= to
  switch (schedule.type) {
    case 'once':
      return inRange(schedule.date) ? [schedule.date] : []
    case 'yearly': {
      const out: ISODate[] = []
      for (let y = isoParts(from)[0]; y <= isoParts(to)[0]; y++) {
        const d = makeDate(y, schedule.month, schedule.day)
        if (inRange(d)) out.push(d)
      }
      return out
    }
    case 'monthly':
    case 'months':
      return periodRange(periodOf(from), periodOf(to))
        .filter((p) => schedule.type === 'monthly' || schedule.months.includes(periodParts(p)[1]))
        .map((p) => {
          const [y, m] = periodParts(p)
          return makeDate(y, m, schedule.day)
        })
        .filter(inRange)
  }
}

function stateOf(dueDate: ISODate, record: ObligationRecord | undefined, today: ISODate): OccurrenceState {
  if (record?.status === 'done') return 'done'
  if (record?.status === 'notApplicable') return 'notApplicable'
  if (dueDate < today) return 'overdue'
  if (dueDate === today) return 'today'
  return 'upcoming'
}

/** Ocorrências (das regras ativas) com prazo efetivo entre `from` e `to`, por ordem de data. */
export function listOccurrences(data: AppData, from: ISODate, to: ISODate, today: ISODate): Occurrence[] {
  // Margem para apanhar ocorrências cuja data foi alterada para dentro do intervalo.
  const MARGIN = 120
  const out: Occurrence[] = []
  for (const rule of data.obligationRules) {
    if (!rule.active) continue
    for (const originalDate of scheduleDatesBetween(rule.schedule, addDays(from, -MARGIN), addDays(to, MARGIN))) {
      if (originalDate < rule.startDate) continue
      const record = data.obligationRecords.find((r) => r.ruleId === rule.id && r.originalDate === originalDate)
      const dueDate = record?.dueDateOverride ?? originalDate
      if (dueDate < from || dueDate > to) continue
      const occ: Occurrence = { rule, originalDate, dueDate, state: stateOf(dueDate, record, today) }
      if (record) occ.record = record
      out.push(occ)
    }
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.rule.title.localeCompare(b.rule.title))
}

/**
 * Dias em que se deve lembrar esta ocorrência, dentro da janela [from, to].
 * O início conta a partir do prazo original; o fim (e o "no próprio dia") usa o prazo efetivo.
 */
export function reminderDates(occ: Occurrence, from: ISODate, to: ISODate): ISODate[] {
  if (occ.state === 'done' || occ.state === 'notApplicable') return []
  const inWindow = (d: ISODate) => d >= from && d <= to
  const r = occ.rule.reminders
  const dates = new Set<ISODate>()

  if (r.type === 'daysOfMonth') {
    const [y, m] = isoParts(occ.originalDate)
    for (const day of r.days) dates.add(makeDate(y, m, day))
  } else {
    let start: ISODate
    if (r.from.type === 'dueMonthStart') start = startOfPeriod(periodOf(occ.originalDate))
    else if (r.from.type === 'fixedDate') start = makeDate(isoParts(occ.originalDate)[0], r.from.month, r.from.day)
    else start = addDays(occ.originalDate, -r.from.days)

    const end = r.until === 'due' ? occ.dueDate : to
    const step = Math.max(1, r.everyDays)
    for (let d = start; d <= end && d <= to; d = addDays(d, step)) dates.add(d)
    if (r.onDueDay) dates.add(occ.dueDate)
  }

  return [...dates].filter(inWindow).sort()
}

/** Texto do botão para marcar a ocorrência. */
export function actionLabel(kind: ObligationKind): string {
  return kind === 'pagamento' ? 'Pago' : kind === 'declaracao' ? 'Entregue' : 'Feito'
}
