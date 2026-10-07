import { beforeEach, describe, expect, it } from 'vitest'
import { generateRecurringJobs, recurringDueDate, virtualRecurring } from './recurring'
import { mkCtx, mkData, mkJob, mkRecurring, resetIds } from './testkit'

beforeEach(() => resetIds())

describe('recurringDueDate', () => {
  it('usa o dia definido, limitado ao fim do mês', () => {
    expect(recurringDueDate(mkRecurring({ dayOfMonth: 5 }), '2026-10')).toBe('2026-10-05')
    expect(recurringDueDate(mkRecurring({ dayOfMonth: 31 }), '2027-02')).toBe('2027-02-28')
  })

  it('pago no mês seguinte: o trabalho de setembro é pago em outubro', () => {
    const rec = mkRecurring({ dayOfMonth: 15, payMonth: 'next' })
    expect(recurringDueDate(rec, '2026-09')).toBe('2026-10-15')
    expect(recurringDueDate(rec, '2026-12')).toBe('2027-01-15')
    expect(recurringDueDate(mkRecurring({ dayOfMonth: 31, payMonth: 'next' }), '2027-01')).toBe('2027-02-28')
  })
})

describe('generateRecurringJobs', () => {
  it('cria o trabalho do mês atual como "a receber"', () => {
    const data = mkData({ recurring: [mkRecurring()] })
    const out = generateRecurringJobs(data, mkCtx('2026-10-06'))
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      title: 'Aulas — Escola de Música X',
      categoryId: 'cat-musica',
      payerId: 'p-escola',
      workDate: '2026-10-05',
      investPct: 15,
      recurringId: 'rec1',
      period: '2026-10',
    })
    expect(out[0]!.installments).toHaveLength(1)
    expect(out[0]!.installments[0]).toMatchObject({ amount: 60000, dueDate: '2026-10-05', expectedMethodId: 'transf' })
    expect(out[0]!.installments[0]!.receivedDate).toBeUndefined()
  })

  it('cria também os meses em falta desde o início', () => {
    const data = mkData({ recurring: [mkRecurring({ startPeriod: '2026-08' })] })
    const out = generateRecurringJobs(data, mkCtx('2026-10-06'))
    expect(out.map((j) => j.period)).toEqual(['2026-08', '2026-09', '2026-10'])
  })

  it('cria o mês atual mesmo antes do dia previsto', () => {
    const data = mkData({ recurring: [mkRecurring({ dayOfMonth: 25 })] })
    expect(generateRecurringJobs(data, mkCtx('2026-10-06')).map((j) => j.period)).toEqual(['2026-10'])
  })

  it('não duplica meses que já existem', () => {
    const existing = mkJob({ recurringId: 'rec1', period: '2026-09' })
    const data = mkData({ recurring: [mkRecurring({ startPeriod: '2026-09' })], jobs: [existing] })
    expect(generateRecurringJobs(data, mkCtx('2026-10-06')).map((j) => j.period)).toEqual(['2026-10'])
  })

  it('respeita meses saltados, meses ativos e rendimentos pausados', () => {
    const data = mkData({
      recurring: [
        mkRecurring({ id: 'a', startPeriod: '2026-07', months: [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7] }),
        mkRecurring({ id: 'b', startPeriod: '2026-09', skippedPeriods: ['2026-09'] }),
        mkRecurring({ id: 'c', active: false }),
      ],
    })
    const out = generateRecurringJobs(data, mkCtx('2026-10-06'))
    expect(out.map((j) => `${j.recurringId}:${j.period}`)).toEqual(['a:2026-07', 'a:2026-09', 'a:2026-10', 'b:2026-10'])
  })

  it('usa a % própria do rendimento se existir', () => {
    const data = mkData({ recurring: [mkRecurring({ investPct: 10 })] })
    expect(generateRecurringJobs(data, mkCtx('2026-10-06'))[0]!.investPct).toBe(10)
  })

  it('pago no mês seguinte: o trabalho fica no mês de trabalho e o pagamento previsto no mês a seguir', () => {
    const data = mkData({ recurring: [mkRecurring({ dayOfMonth: 15, payMonth: 'next', startPeriod: '2026-09' })] })
    const out = generateRecurringJobs(data, mkCtx('2026-10-06'))
    expect(out.map((j) => [j.period, j.workDate, j.installments[0]!.dueDate])).toEqual([
      ['2026-09', '2026-09-15', '2026-10-15'],
      ['2026-10', '2026-10-15', '2026-11-15'],
    ])
  })

  it('não cria nada se o início for no futuro', () => {
    const data = mkData({ recurring: [mkRecurring({ startPeriod: '2026-11' })] })
    expect(generateRecurringJobs(data, mkCtx('2026-10-06'))).toEqual([])
  })
})

describe('virtualRecurring', () => {
  it('prevê os meses futuros (ainda não criados) para o calendário', () => {
    const data = mkData({ recurring: [mkRecurring({ months: [9, 10, 12], skippedPeriods: ['2027-09'] })] })
    const out = virtualRecurring(data, '2026-10-06', '2027-10')
    expect(out.map((v) => v.dueDate)).toEqual(['2026-12-05', '2027-10-05'])
    expect(out[0]).toMatchObject({ amount: 60000, period: '2026-12' })
    expect(out[0]!.recurring.id).toBe('rec1')
  })

  it('não prevê meses antes do início', () => {
    const data = mkData({ recurring: [mkRecurring({ startPeriod: '2027-01' })] })
    expect(virtualRecurring(data, '2026-10-06', '2027-02').map((v) => v.period)).toEqual(['2027-01', '2027-02'])
  })

  it('pago no mês seguinte: a data prevista fica no mês a seguir ao de trabalho', () => {
    const data = mkData({ recurring: [mkRecurring({ dayOfMonth: 15, payMonth: 'next', months: [11, 12] })] })
    expect(virtualRecurring(data, '2026-10-06', '2026-12').map((v) => [v.period, v.dueDate])).toEqual([
      ['2026-11', '2026-12-15'],
      ['2026-12', '2027-01-15'],
    ])
  })
})
