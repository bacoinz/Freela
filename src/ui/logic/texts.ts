import { MONTHS_PT, MONTHS_SHORT_PT, formatDateLong } from '../../domain/dates'
import type { DayOfMonth, ObligationRule, ObligationSchedule } from '../../domain/types'

/** "10 e 15", "1, 6 e 11". */
function joinPT(items: (string | number)[]): string {
  const s = items.map(String)
  return s.length <= 1 ? (s[0] ?? '') : `${s.slice(0, -1).join(', ')} e ${s.at(-1)}`
}

const dayText = (d: DayOfMonth) => (d === 'last' ? 'último dia' : `dia ${d}`)

/** Meses ativos: "todos os meses", "set–jul" (intervalo), "jan, abr, jul, out". */
export function monthsText(months: number[]): string {
  const set = [...new Set(months)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b)
  if (set.length === 0) return 'nenhum mês'
  if (set.length === 12) return 'todos os meses'
  if (set.length >= 3) {
    // Intervalo contínuo (pode dar a volta ao ano, ex.: set–jul).
    for (const start of set) {
      const run = Array.from({ length: set.length }, (_, i) => ((start - 1 + i) % 12) + 1)
      if (run.every((m) => set.includes(m))) {
        return `${MONTHS_SHORT_PT[start - 1]}–${MONTHS_SHORT_PT[run.at(-1)! - 1]}`
      }
    }
  }
  return set.map((m) => MONTHS_SHORT_PT[m - 1]).join(', ')
}

/** Quando é o prazo: "Todos os meses, dia 20". */
export function scheduleText(s: ObligationSchedule): string {
  switch (s.type) {
    case 'monthly':
      return `Todos os meses, ${dayText(s.day)}`
    case 'months':
      return s.day === 'last' ? `Último dia de ${monthsText(s.months)}` : `Dia ${s.day} de ${monthsText(s.months)}`
    case 'yearly':
      return s.day === 'last'
        ? `Todos os anos, último dia de ${MONTHS_PT[s.month - 1]}`
        : `Todos os anos, ${s.day} de ${MONTHS_PT[s.month - 1]}`
    case 'once':
      return `Só uma vez, ${formatDateLong(s.date)}`
  }
}

/** Como lembra: "Nos dias 10 e 15 do mês". */
export function reminderText(rule: ObligationRule): string {
  const r = rule.reminders
  if (r.type === 'daysOfMonth') {
    const days = [...r.days].sort((a, b) => a - b)
    return days.length === 1 ? `No dia ${days[0]} do mês` : `Nos dias ${joinPT(days)} do mês`
  }
  const every = r.everyDays === 7 ? 'Todas as semanas' : r.everyDays === 1 ? 'Todos os dias' : `De ${r.everyDays} em ${r.everyDays} dias`
  const from =
    r.from.type === 'dueMonthStart'
      ? 'desde o início do mês'
      : r.from.type === 'fixedDate'
        ? `desde ${r.from.day} de ${MONTHS_PT[r.from.month - 1]}`
        : `desde ${r.from.days} ${r.from.days === 1 ? 'dia' : 'dias'} antes`
  const until = r.until === 'done' ? 'até marcares como feito' : 'até ao prazo'
  return `${every} ${from}, ${until}${r.onDueDay ? ' e no próprio dia' : ''}`
}

/** Nome de cada prestação no formulário e no detalhe. */
export function installmentLabel(index: number, count: number): string {
  if (count === 1) return 'Pagamento'
  if (count === 2) return index === 0 ? '1.ª prestação (início)' : '2.ª prestação (fim)'
  return `${index + 1}.ª prestação`
}
