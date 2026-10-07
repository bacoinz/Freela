import { beforeEach, describe, expect, it } from 'vitest'
import { calendarEvents, monthGrid, monthSummary } from './calendar'
import { defaultObligationRules } from './obligations'
import { NEUTRAL_COLOR } from './payers'
import { mkData, mkInst, mkJob, mkRecurring, newId, resetIds } from './testkit'

beforeEach(() => resetIds())

const TODAY = '2026-10-06'

describe('monthGrid', () => {
  it('começa à segunda-feira e inclui dias dos meses vizinhos', () => {
    const weeks = monthGrid('2026-10')
    expect(weeks).toHaveLength(5)
    expect(weeks[0]![0]).toBe('2026-09-28')
    expect(weeks[0]![3]).toBe('2026-10-01')
    expect(weeks[4]![6]).toBe('2026-11-01')
    expect(weeks.every((w) => w.length === 7)).toBe(true)
  })

  it('fevereiro de 2027 ocupa 4 semanas certinhas', () => {
    const weeks = monthGrid('2027-02')
    expect(weeks).toHaveLength(4)
    expect(weeks[0]![0]).toBe('2027-02-01')
    expect(weeks[3]![6]).toBe('2027-02-28')
  })
})

describe('calendarEvents', () => {
  const escola = { id: 'p-escola', name: 'Escola X', color: '#6366f1' }

  it('mostra recebimentos, previstos (com atraso) e obrigações nos dias certos', () => {
    const jobA = mkJob({
      title: 'Casamento',
      payerName: 'Família Silva',
      installments: [
        mkInst({ id: 'i1', amount: 22500, dueDate: '2026-10-01', receivedDate: '2026-10-02', methodId: 'mbway' }),
        mkInst({ id: 'i2', amount: 22500, dueDate: '2026-10-25' }),
      ],
    })
    const jobB = mkJob({ title: 'Gravação', payerId: 'p-escola', payerName: undefined, installments: [mkInst({ id: 'i3', amount: 5000, dueDate: '2026-10-03' })] })
    const data = mkData({ jobs: [jobA, jobB], payers: [escola], obligationRules: defaultObligationRules(TODAY, newId) })
    const ev = calendarEvents(data, '2026-10', TODAY)

    expect(ev['2026-10-02']).toEqual([
      expect.objectContaining({ kind: 'received', amount: 22500, title: 'Casamento', color: NEUTRAL_COLOR, installmentId: 'i1' }),
    ])
    expect(ev['2026-10-25']).toEqual([expect.objectContaining({ kind: 'expected', amount: 22500, overdue: false, virtual: false })])
    expect(ev['2026-10-03']).toEqual([expect.objectContaining({ kind: 'expected', overdue: true, color: '#6366f1' })])
    expect(ev['2026-10-20']).toEqual([expect.objectContaining({ kind: 'obligation', state: 'upcoming', title: 'Pagar Segurança Social' })])
    expect(ev['2026-10-31']).toEqual([expect.objectContaining({ kind: 'obligation', title: 'Declaração trimestral à Segurança Social' })])
    expect(ev['2026-10-01']).toBeUndefined()
  })

  it('mostra os rendimentos fixos dos meses futuros como previstos', () => {
    const data = mkData({ payers: [escola], recurring: [mkRecurring({ payerId: 'p-escola' })] })
    const ev = calendarEvents(data, '2026-12', TODAY)
    expect(ev['2026-12-05']).toEqual([
      expect.objectContaining({ kind: 'expected', virtual: true, amount: 60000, color: '#6366f1', title: 'Aulas — Escola de Música X' }),
    ])
  })

  it('rendimento pago no mês seguinte: o previsto aparece no mês em que o pagamento chega', () => {
    const data = mkData({ payers: [escola], recurring: [mkRecurring({ payerId: 'p-escola', dayOfMonth: 15, payMonth: 'next' })] })
    // O mês de trabalho de novembro é pago a 15 de dezembro; em novembro não chega nada previsto.
    expect(calendarEvents(data, '2026-12', TODAY)['2026-12-15']).toEqual([expect.objectContaining({ kind: 'expected', virtual: true, amount: 60000 })])
    expect(calendarEvents(data, '2026-11', TODAY)['2026-11-15']).toBeUndefined()
  })
})

describe('monthSummary', () => {
  it('soma recebido e previsto e conta obrigações por fazer', () => {
    const data = mkData({
      obligationRules: defaultObligationRules(TODAY, newId),
      jobs: [
        mkJob({
          installments: [
            mkInst({ amount: 10000, receivedDate: '2026-10-02', methodId: 'mbway' }),
            mkInst({ amount: 5000, dueDate: '2026-10-25' }),
          ],
        }),
      ],
    })
    const s = monthSummary(calendarEvents(data, '2026-10', TODAY))
    expect(s).toEqual({ received: 10000, expected: 5000, obligationsPending: 2, obligationsDone: 0 })
  })
})
