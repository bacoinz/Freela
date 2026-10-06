import { addDays } from '../../domain/dates'
import type { Cents, DayOfMonth, ISODate, ObligationKind, ObligationRule, ObligationSchedule, ReminderRule } from '../../domain/types'

export type SchedType = ObligationSchedule['type']
export type FromType = 'dueMonthStart' | 'fixedDate' | 'daysBefore'

/** Estado do formulário de um prazo (texto tal como está nos campos). */
export interface RuleForm {
  title: string
  kind: ObligationKind
  schedType: SchedType
  /** Número do dia ou 'last'. */
  day: string
  months: number[]
  month: number
  date: ISODate
  defaultAmount: Cents | null
  remType: ReminderRule['type']
  /** Ex.: "10, 15". */
  days: string
  everyDays: string
  fromType: FromType
  fromMonth: number
  fromDay: string
  fromDays: string
  until: 'due' | 'done'
  onDueDay: boolean
  active: boolean
  notes: string
}

/** Preenche o formulário a partir de uma regra (ou valores por defeito para um prazo novo). */
export function ruleToForm(r: ObligationRule | undefined, today: ISODate): RuleForm {
  const s = r?.schedule
  const rem = r?.reminders
  return {
    title: r?.title ?? '',
    kind: r?.kind ?? 'pagamento',
    schedType: s?.type ?? 'yearly',
    day: s && 'day' in s ? String(s.day) : '20',
    months: s?.type === 'months' ? s.months : [1, 4, 7, 10],
    month: s?.type === 'yearly' ? s.month : 1,
    date: s?.type === 'once' ? s.date : addDays(today, 30),
    defaultAmount: r?.defaultAmount ?? null,
    remType: rem?.type ?? 'repeat',
    days: rem?.type === 'daysOfMonth' ? rem.days.join(', ') : '10, 15',
    everyDays: rem?.type === 'repeat' ? String(rem.everyDays) : '7',
    fromType: rem?.type === 'repeat' ? rem.from.type : 'daysBefore',
    fromMonth: rem?.type === 'repeat' && rem.from.type === 'fixedDate' ? rem.from.month : 1,
    fromDay: rem?.type === 'repeat' && rem.from.type === 'fixedDate' ? String(rem.from.day) : '1',
    fromDays: rem?.type === 'repeat' && rem.from.type === 'daysBefore' ? String(rem.from.days) : '7',
    until: rem?.type === 'repeat' ? rem.until : 'due',
    onDueDay: rem?.type === 'repeat' ? rem.onDueDay : true,
    active: r?.active ?? true,
    notes: r?.notes ?? '',
  }
}

const int = (s: string, min: number, max: number): number | null => {
  const t = s.trim()
  const n = Number(t)
  return t !== '' && Number.isInteger(n) && n >= min && n <= max ? n : null
}

/** Constrói o prazo e os lembretes a partir do formulário, ou devolve a mensagem de erro. */
export function formToRule(f: RuleForm): { schedule: ObligationSchedule; reminders: ReminderRule } | string {
  const day: DayOfMonth | null = f.day === 'last' ? 'last' : int(f.day, 1, 31)
  let schedule: ObligationSchedule
  if (f.schedType === 'once') schedule = { type: 'once', date: f.date }
  else if (day === null) return 'O dia do prazo tem de estar entre 1 e 31.'
  else if (f.schedType === 'monthly') schedule = { type: 'monthly', day }
  else if (f.schedType === 'months') {
    if (f.months.length === 0) return 'Escolhe pelo menos um mês.'
    schedule = { type: 'months', months: [...f.months].sort((a, b) => a - b), day }
  } else schedule = { type: 'yearly', month: f.month, day }

  let reminders: ReminderRule
  if (f.remType === 'daysOfMonth') {
    const days = f.days
      .split(/[,;\s]+/)
      .filter(Boolean)
      .map((d) => int(d, 1, 31))
    if (days.length === 0 || days.some((d) => d === null)) return 'Escreve os dias dos lembretes separados por vírgulas (ex.: 10, 15).'
    reminders = { type: 'daysOfMonth', days: [...new Set(days as number[])].sort((a, b) => a - b) }
  } else {
    const every = int(f.everyDays, 1, 365)
    if (every === null) return 'O intervalo dos lembretes tem de ser um nº de dias (1 a 365).'
    let from: Extract<ReminderRule, { type: 'repeat' }>['from']
    if (f.fromType === 'dueMonthStart') from = { type: 'dueMonthStart' }
    else if (f.fromType === 'fixedDate') {
      const d = int(f.fromDay, 1, 31)
      if (d === null) return 'O dia de início dos lembretes tem de estar entre 1 e 31.'
      from = { type: 'fixedDate', month: f.fromMonth, day: d }
    } else {
      const d = int(f.fromDays, 0, 365)
      if (d === null) return 'Os dias de antecedência têm de ser um número (0 a 365).'
      from = { type: 'daysBefore', days: d }
    }
    reminders = { type: 'repeat', everyDays: every, from, until: f.until, onDueDay: f.onDueDay }
  }
  return { schedule, reminders }
}
