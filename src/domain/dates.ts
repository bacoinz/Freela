import type { DayOfMonth, ISODate, Period } from './types'

// Todas as contas de dias são feitas em UTC sobre datas 'AAAA-MM-DD',
// para não haver surpresas com a mudança de hora.

const DAY_MS = 86_400_000

const pad2 = (n: number) => String(n).padStart(2, '0')

function parts(iso: ISODate): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return [y, m, d]
}

function toUTC(iso: ISODate): number {
  const [y, m, d] = parts(iso)
  return Date.UTC(y, m - 1, d)
}

function fromUTC(ms: number): ISODate {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/** Data local de um objeto Date → 'AAAA-MM-DD'. */
export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now)
}

export function addDays(iso: ISODate, n: number): ISODate {
  return fromUTC(toUTC(iso) + n * DAY_MS)
}

/** Nº de dias de `a` até `b` (positivo se `b` for depois). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS)
}

/** `month` de 1 a 12. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Cria uma data; o dia é limitado ao fim do mês ('last' = último dia). */
export function makeDate(year: number, month: number, day: DayOfMonth): ISODate {
  const last = daysInMonth(year, month)
  const d = day === 'last' ? last : Math.min(Math.max(1, day), last)
  return `${year}-${pad2(month)}-${pad2(d)}`
}

export function periodOf(iso: ISODate): Period {
  return iso.slice(0, 7)
}

export function periodParts(p: Period): [number, number] {
  const [y, m] = p.split('-').map(Number) as [number, number]
  return [y, m]
}

export function addMonths(p: Period, n: number): Period {
  const [y, m] = periodParts(p)
  const idx = y * 12 + (m - 1) + n
  return `${Math.floor(idx / 12)}-${pad2((idx % 12) + 1)}`
}

/** Lista de meses de `from` a `to`, inclusive. */
export function periodRange(from: Period, to: Period): Period[] {
  const out: Period[] = []
  for (let p = from; p <= to; p = addMonths(p, 1)) out.push(p)
  return out
}

export function startOfPeriod(p: Period): ISODate {
  return `${p}-01`
}

export function endOfPeriod(p: Period): ISODate {
  const [y, m] = periodParts(p)
  return makeDate(y, m, 'last')
}

export const MONTHS_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const

export const MONTHS_SHORT_PT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const

export const WEEKDAYS_SHORT_PT = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'] as const

/** '2026-10' → 'outubro de 2026'. */
export function formatPeriodPT(p: Period): string {
  const [y, m] = periodParts(p)
  return `${MONTHS_PT[m - 1]} de ${y}`
}

/** '2026-10' → 'out 2026'. */
export function formatPeriodShort(p: Period): string {
  const [y, m] = periodParts(p)
  return `${MONTHS_SHORT_PT[m - 1]} ${y}`
}

/** '2026-10-06' → '06/10/2026'. */
export function formatDateShort(iso: ISODate): string {
  const [y, m, d] = parts(iso)
  return `${pad2(d)}/${pad2(m)}/${y}`
}

/** '2026-10-06' → '6 out'. */
export function formatDayMonth(iso: ISODate): string {
  const [, m, d] = parts(iso)
  return `${d} ${MONTHS_SHORT_PT[m - 1]}`
}

/** '2026-10-06' → '6 de outubro de 2026'. */
export function formatDateLong(iso: ISODate): string {
  const [y, m, d] = parts(iso)
  return `${d} de ${MONTHS_PT[m - 1]} de ${y}`
}

/** 0 = segunda … 6 = domingo. */
export function weekdayMon0(iso: ISODate): number {
  const dow = new Date(toUTC(iso)).getUTCDay() // 0 = domingo
  return (dow + 6) % 7
}

/** Date local desse dia à hora indicada (ex.: 10:00). */
export function atLocalHour(iso: ISODate, hour: number): Date {
  const [y, m, d] = parts(iso)
  return new Date(y, m - 1, d, hour, 0, 0, 0)
}

export function isoParts(iso: ISODate): [number, number, number] {
  return parts(iso)
}
