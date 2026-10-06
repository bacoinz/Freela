import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  daysInMonth,
  diffDays,
  endOfPeriod,
  formatDateShort,
  formatDayMonth,
  formatPeriodPT,
  makeDate,
  periodOf,
  periodRange,
  startOfPeriod,
  toISODate,
  weekdayMon0,
  atLocalHour,
} from './dates'

describe('toISODate', () => {
  it('usa a data local', () => {
    expect(toISODate(new Date(2026, 9, 6, 23, 59))).toBe('2026-10-06')
    expect(toISODate(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01')
  })
})

describe('addDays / diffDays', () => {
  it('soma dias atravessando meses e anos', () => {
    expect(addDays('2026-10-06', 1)).toBe('2026-10-07')
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
  })

  it('conta dias entre datas (sem problemas com a hora de verão)', () => {
    expect(diffDays('2026-10-01', '2026-10-31')).toBe(30)
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2)
    expect(diffDays('2026-10-31', '2026-10-01')).toBe(-30)
  })
})

describe('meses', () => {
  it('sabe quantos dias tem cada mês', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(daysInMonth(2026, 4)).toBe(30)
    expect(daysInMonth(2026, 12)).toBe(31)
  })

  it('cria datas com dia limitado ao fim do mês', () => {
    expect(makeDate(2026, 2, 31)).toBe('2026-02-28')
    expect(makeDate(2026, 4, 'last')).toBe('2026-04-30')
    expect(makeDate(2026, 10, 5)).toBe('2026-10-05')
  })

  it('trabalha com períodos AAAA-MM', () => {
    expect(periodOf('2026-10-06')).toBe('2026-10')
    expect(addMonths('2026-11', 2)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(periodRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
    expect(periodRange('2026-05', '2026-04')).toEqual([])
    expect(startOfPeriod('2026-02')).toBe('2026-02-01')
    expect(endOfPeriod('2026-02')).toBe('2026-02-28')
  })
})

describe('formatação em PT', () => {
  it('formata meses e datas', () => {
    expect(formatPeriodPT('2026-10')).toBe('outubro de 2026')
    expect(formatDateShort('2026-10-06')).toBe('06/10/2026')
    expect(formatDayMonth('2026-10-06')).toBe('6 out')
  })
})

describe('weekdayMon0', () => {
  it('devolve 0 para segunda e 6 para domingo', () => {
    expect(weekdayMon0('2026-10-05')).toBe(0) // segunda
    expect(weekdayMon0('2026-10-11')).toBe(6) // domingo
  })
})

describe('atLocalHour', () => {
  it('cria a data/hora local de um dia', () => {
    const d = atLocalHour('2026-10-11', 10)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(9)
    expect(d.getDate()).toBe(11)
    expect(d.getHours()).toBe(10)
    expect(d.getMinutes()).toBe(0)
  })
})
