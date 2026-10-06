import { beforeEach, describe, expect, it } from 'vitest'
import { defaultObligationRules } from '../../domain/obligations'
import { mkData, mkInst, mkJob, mkRecurring, newId, resetIds } from '../../domain/testkit'
import { monthOverview } from './home'

beforeEach(() => resetIds())
const TODAY = '2026-10-06'

describe('monthOverview', () => {
  function data() {
    const d = mkData({
      payers: [{ id: 'p-escola', name: 'Escola X', color: '#10b981' }],
      recurring: [mkRecurring({ payerId: 'p-escola' })],
      obligationRules: defaultObligationRules(TODAY, newId),
      jobs: [
        mkJob({ id: 'fix', recurringId: 'rec1', period: '2026-10', payerId: 'p-escola', payerName: undefined, workDate: '2026-10-05', installments: [mkInst({ amount: 60000, dueDate: '2026-10-05' })] }),
        mkJob({ id: 'a', workDate: '2026-10-01', installments: [mkInst({ amount: 20000, receivedDate: '2026-10-02', methodId: 'mbway' })] }),
        mkJob({ id: 'b', workDate: '2026-09-20', installments: [mkInst({ amount: 22500, receivedDate: '2026-09-21', methodId: 'mbway' }), mkInst({ amount: 22500, dueDate: '2026-10-01' })] }),
        mkJob({ id: 'c', workDate: '2026-10-03', installments: [mkInst({ amount: 10000, dueDate: '2026-10-25' })] }),
      ],
    })
    d.obligationRecords.push({ ruleId: d.obligationRules[0]!.id, originalDate: '2026-10-20', status: 'done', date: '2026-10-04', amountPaid: 12000 })
    return d
  }

  it('resume o mês: recebido, para investir, fica para ti e pago ao Estado', () => {
    const o = monthOverview(data(), '2026-10', TODAY)
    expect(o.received).toBe(20000)
    expect(o.invest).toBe(3000)
    expect(o.kept).toBe(17000)
    expect(o.statePaid).toBe(12000)
  })

  it('lista o que falta receber (atrasados primeiro) com totais', () => {
    const o = monthOverview(data(), '2026-10', TODAY)
    expect(o.pending.total).toBe(60000 + 22500 + 10000)
    expect(o.pending.overdueCount).toBe(2)
    expect(o.pending.items.map((i) => i.job.id)).toEqual(['b', 'fix', 'c'])
    expect(o.pending.items[0]!.installment.amount).toBe(22500)
  })

  it('mostra os rendimentos fixos do mês e o seu estado', () => {
    const o = monthOverview(data(), '2026-10', TODAY)
    expect(o.fixed).toEqual([expect.objectContaining({ title: 'Aulas — Escola de Música X', amount: 60000, dueDate: '2026-10-05', received: false, jobId: 'fix' })])
  })

  it('próximos prazos dos 30 dias seguintes ainda por fazer', () => {
    const o = monthOverview(data(), '2026-10', TODAY)
    expect(o.nextObligations.map((x) => `${x.rule.template}@${x.dueDate}`)).toEqual(['ss-declaracao-trimestral@2026-10-31'])
  })

  it('últimos recebimentos', () => {
    const o = monthOverview(data(), '2026-10', TODAY)
    expect(o.recent.map((r) => [r.job.id, r.installment.receivedDate])).toEqual([
      ['a', '2026-10-02'],
      ['b', '2026-09-21'],
    ])
  })
})
