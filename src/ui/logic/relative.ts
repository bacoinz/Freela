import { diffDays } from '../../domain/dates'
import type { ISODate } from '../../domain/types'

/** Texto para um prazo: "hoje", "amanhã", "faltam 3 dias", "atrasado há 2 dias". */
export function dueLabel(today: ISODate, due: ISODate): string {
  const d = diffDays(today, due)
  if (d === 0) return 'hoje'
  if (d === 1) return 'amanhã'
  if (d > 1) return `faltam ${d} dias`
  return d === -1 ? 'atrasado há 1 dia' : `atrasado há ${-d} dias`
}

/** Texto para uma data passada: "hoje", "ontem", "há 5 dias". */
export function sinceLabel(today: ISODate, date: ISODate): string {
  const d = diffDays(date, today)
  if (d === 0) return 'hoje'
  if (d === 1) return 'ontem'
  if (d > 1) return `há ${d} dias`
  return d === -1 ? 'amanhã' : `daqui a ${-d} dias`
}
