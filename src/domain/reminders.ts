import { addDays, atLocalHour, diffDays, formatDayMonth, toISODate, weekdayMon0 } from './dates'
import { isReceived } from './installments'
import { overdueDateOf } from './jobs'
import { formatMoney } from './money'
import { listOccurrences, reminderDates, type Occurrence } from './obligations'
import { payerLabel } from './payers'
import type { AppData, ISODate, Installment, Job } from './types'

export interface ReminderItem {
  kind: 'obligation' | 'overdue'
  title: string
  /** Texto quando é o único lembrete do dia. */
  detail: string
  /** Texto curto quando há vários lembretes no mesmo dia. */
  short: string
  route: string
}

/** Uma notificação planeada (no máximo uma por dia). */
export interface PlannedReminder {
  /** AAAAMMDD — estável, para poder cancelar/substituir. */
  id: number
  date: ISODate
  at: Date
  title: string
  body: string
  route: string
  items: ReminderItem[]
}

function relativeDue(day: ISODate, due: ISODate): string {
  const diff = diffDays(day, due)
  if (diff > 1) return `faltam ${diff} dias`
  if (diff === 1) return 'falta 1 dia'
  if (diff === 0) return 'é hoje o último dia'
  if (diff === -1) return 'o prazo passou ontem'
  return `o prazo passou há ${-diff} dias`
}

function obligationItem(o: Occurrence, day: ISODate): ReminderItem {
  return {
    kind: 'obligation',
    title: o.rule.title,
    detail: `Prazo: ${formatDayMonth(o.dueDate)} (${relativeDue(day, o.dueDate)})`,
    short: `${o.rule.title} (${formatDayMonth(o.dueDate)})`,
    route: '/obrigacoes',
  }
}

interface OverdueEntry {
  job: Job
  inst: Installment
  od: ISODate
}

function overdueItem(list: OverdueEntry[], data: AppData): ReminderItem {
  const total = formatMoney(list.reduce((s, e) => s + e.inst.amount, 0))
  if (list.length === 1) {
    const { job, inst, od } = list[0]!
    const money = formatMoney(inst.amount)
    return {
      kind: 'overdue',
      title: 'Pagamento em atraso',
      detail: `${job.title} — ${payerLabel(job, data.payers)}: ${money} (previsto ${formatDayMonth(od)})`,
      short: `${job.title}: ${money} em atraso`,
      route: '/trabalhos',
    }
  }
  const names = [...new Set(list.map((e) => e.job.title))]
  return {
    kind: 'overdue',
    title: `${list.length} pagamentos em atraso`,
    detail: `Total ${total}: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}`,
    short: `${list.length} pagamentos em atraso (${total})`,
    route: '/trabalhos',
  }
}

/**
 * Planeia as notificações dos próximos `horizonDays` dias:
 * - obrigações, com as regras de lembrete de cada uma (param quando marcadas);
 * - pagamentos em atraso: aviso no dia seguinte à data prevista + resumo às segundas-feiras.
 * Tudo o que calha no mesmo dia vai numa só notificação, à hora definida.
 */
export function planReminders(data: AppData, now: Date, horizonDays = 60): PlannedReminder[] {
  if (!data.settings.remindersEnabled) return []
  const today = toISODate(now)
  const end = addDays(today, horizonDays)
  const items = new Map<ISODate, ReminderItem[]>()
  const push = (d: ISODate, item: ReminderItem) => {
    const list = items.get(d)
    if (list) list.push(item)
    else items.set(d, [item])
  }

  // Obrigações (inclui ocorrências antigas por fazer, cujos lembretes continuam "até feito").
  for (const o of listOccurrences(data, addDays(today, -400), addDays(end, 120), today)) {
    for (const d of reminderDates(o, today, end)) push(d, obligationItem(o, d))
  }

  // Pagamentos em atraso.
  const pending: OverdueEntry[] = []
  for (const job of data.jobs) {
    for (const inst of job.installments) {
      if (!isReceived(inst)) pending.push({ job, inst, od: overdueDateOf(inst, job, data.settings.overdueDays) })
    }
  }
  for (let d = today; d <= end; d = addDays(d, 1)) {
    const isMonday = weekdayMon0(d) === 0
    const due = isMonday ? pending.filter((e) => e.od < d) : pending.filter((e) => addDays(e.od, 1) === d)
    if (due.length > 0) push(d, overdueItem(due, data))
  }

  const out: PlannedReminder[] = []
  for (const [date, list] of [...items.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const when = atLocalHour(date, data.settings.reminderHour)
    if (when.getTime() <= now.getTime()) continue
    const single = list.length === 1 ? list[0]! : undefined
    const routes = new Set(list.map((i) => i.route))
    out.push({
      id: Number(date.replaceAll('-', '')),
      date,
      at: when,
      title: single ? single.title : `${list.length} lembretes para hoje`,
      body: single ? single.detail : list.map((i) => i.short).join(' · '),
      route: routes.size === 1 ? [...routes][0]! : '/',
      items: list,
    })
  }
  return out
}
