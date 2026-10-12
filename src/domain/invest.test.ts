import { beforeEach, describe, expect, it } from 'vitest'
import {
  defaultPlan,
  installmentInvest,
  installmentParts,
  investOverview,
  jobInvestDone,
  jobInvestExpected,
  jobInvestPending,
  jobInvestReceived,
  pendingInvestments,
  planFor,
  splitInvest,
  validatePlan,
} from './invest'
import { mkData, mkInst, mkJob, resetIds } from './testkit'
import type { InvestDestination, InvestPlan } from './types'

beforeEach(() => resetIds())

const TODAY = '2026-11-10'
const dest = (id: string, pct: number): InvestDestination => ({ id, name: id, pct })
/** 15% (20/80) até outubro; 20% (50/50) desde novembro. */
const PLANS: InvestPlan[] = [defaultPlan(15), { from: '2026-11', pct: 20, destinations: [dest('a', 50), dest('b', 50)] }]
const got = (amount: number, date: string) => mkInst({ amount, receivedDate: date, methodId: 'mbway' })

describe('planFor', () => {
  it('usa o último plano que já começou nesse mês', () => {
    expect(planFor(PLANS, '2026-10').pct).toBe(15)
    expect(planFor(PLANS, '2026-11').pct).toBe(20)
    expect(planFor(PLANS, '2027-03').pct).toBe(20)
  })

  it('o plano por defeito é 15%: 20% conta poupança e 80% bitcoin', () => {
    expect(defaultPlan(15)).toEqual({
      from: '2000-01',
      pct: 15,
      destinations: [
        { id: 'poupanca', name: 'Conta poupança', pct: 20 },
        { id: 'bitcoin', name: 'Bitcoin', pct: 80 },
      ],
    })
  })
})

describe('splitInvest', () => {
  it('divide pelas % e a soma dá sempre o total', () => {
    const plan = defaultPlan(15)
    expect(splitInvest(6750, plan.destinations).map((p) => p.amount)).toEqual([1350, 5400])
    expect(splitInvest(1, plan.destinations).map((p) => p.amount)).toEqual([0, 1])
    const three = [dest('x', 33.3), dest('y', 33.3), dest('z', 33.4)]
    const parts = splitInvest(1000, three)
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(1000)
    expect(parts.every((p) => p.amount >= 333 && p.amount <= 334)).toBe(true)
  })

  it('guarda o nome do destino em cada parte', () => {
    expect(splitInvest(6750, defaultPlan(15).destinations)[0]).toEqual({ destinationId: 'poupanca', name: 'Conta poupança', amount: 1350 })
  })
})

describe('% por mês de recebimento', () => {
  it('cada pagamento usa a % do mês em que foi recebido; por receber, a atual', () => {
    expect(installmentInvest(got(10000, '2026-10-20'), PLANS, TODAY)).toBe(1500)
    expect(installmentInvest(got(10000, '2026-11-02'), PLANS, TODAY)).toBe(2000)
    expect(installmentInvest(mkInst({ amount: 10000 }), PLANS, TODAY)).toBe(2000)
  })

  it('arredonda por prestação', () => {
    expect(installmentInvest(got(22550, '2026-10-20'), PLANS, TODAY)).toBe(3383)
  })

  it('um trabalho recebido em duas vezes, antes e depois da mudança, usa as duas %', () => {
    const job = mkJob({ installments: [got(22500, '2026-10-20'), got(22500, '2026-11-05')] })
    expect(jobInvestReceived(job, PLANS, TODAY)).toBe(3375 + 4500)
  })

  it('divide cada pagamento pelos destinos do seu mês', () => {
    expect(installmentParts(got(45000, '2026-10-20'), PLANS, TODAY).map((p) => [p.destinationId, p.amount])).toEqual([
      ['poupanca', 1350],
      ['bitcoin', 5400],
    ])
    expect(installmentParts(got(45000, '2026-11-02'), PLANS, TODAY).map((p) => [p.destinationId, p.amount])).toEqual([
      ['a', 4500],
      ['b', 4500],
    ])
  })

  it('o que já foi investido fica como foi marcado (fotografia), mesmo que o plano mude', () => {
    const inst = { ...got(10000, '2026-11-02'), invested: { date: '2026-11-03', parts: [{ destinationId: 'poupanca', name: 'Conta poupança', amount: 300 }, { destinationId: 'bitcoin', name: 'Bitcoin', amount: 1200 }] } }
    expect(installmentInvest(inst, PLANS, TODAY)).toBe(1500)
    expect(installmentParts(inst, PLANS, TODAY).map((p) => p.amount)).toEqual([300, 1200])
  })

  it('separa o investido, o por investir e o previsto de um trabalho', () => {
    const invested = { ...got(10000, '2026-10-02'), invested: { date: '2026-10-03', parts: [{ destinationId: 'poupanca', name: 'Conta poupança', amount: 1500 }] } }
    const job = mkJob({ installments: [invested, got(10000, '2026-10-20'), mkInst({ amount: 10000 })] })
    expect(jobInvestDone(job, PLANS, TODAY)).toBe(1500)
    expect(jobInvestPending(job, PLANS, TODAY)).toBe(1500)
    expect(jobInvestExpected(job, PLANS, TODAY)).toBe(2000)
  })
})

describe('pendingInvestments / investOverview', () => {
  function data() {
    const d = mkData({
      jobs: [
        mkJob({ id: 'out', title: 'Casamento', installments: [got(45000, '2026-10-20')] }),
        mkJob({ id: 'nov', title: 'Concerto', installments: [got(10000, '2026-11-02'), mkInst({ amount: 10000 })] }),
        mkJob({
          id: 'feito',
          title: 'Aula',
          installments: [{ ...got(20000, '2026-10-05'), invested: { date: '2026-10-06', parts: [{ destinationId: 'poupanca', name: 'Conta poupança', amount: 600 }, { destinationId: 'bitcoin', name: 'Bitcoin', amount: 2400 }] } }],
        }),
      ],
    })
    d.settings.investPlans = PLANS
    return d
  }

  it('lista o que falta investir, por mês de recebimento (o mais recente primeiro)', () => {
    const months = pendingInvestments(data(), TODAY)
    expect(months.map((m) => [m.period, m.total, m.items.map((i) => i.job.id)])).toEqual([
      ['2026-11', 2000, ['nov']],
      ['2026-10', 6750, ['out']],
    ])
  })

  it('resume o por investir por destino e lista o histórico dos investidos', () => {
    const o = investOverview(data(), TODAY)
    expect(o.pendingTotal).toBe(8750)
    expect(o.pendingParts.map((p) => [p.destinationId, p.amount])).toEqual([
      ['a', 1000],
      ['b', 1000],
      ['poupanca', 1350],
      ['bitcoin', 5400],
    ])
    expect(o.invested.map((r) => r.job.id)).toEqual(['feito'])
  })
})

describe('validatePlan', () => {
  it('aceita destinos que somam 100%', () => {
    expect(() => validatePlan(15, [dest('a', 20), dest('b', 80)])).not.toThrow()
    expect(() => validatePlan(15, [dest('a', 33.3), dest('b', 33.3), dest('c', 33.4)])).not.toThrow()
  })

  it('explica o que está mal', () => {
    expect(() => validatePlan(120, [dest('a', 100)])).toThrow(/entre 0 e 100/)
    expect(() => validatePlan(15, [])).toThrow(/pelo menos um destino/)
    expect(() => validatePlan(15, [{ id: 'a', name: '  ', pct: 100 }])).toThrow(/nome/)
    expect(() => validatePlan(15, [dest('a', 20), dest('b', 70)])).toThrow(/somam 90%.*faltam 10%/)
    expect(() => validatePlan(15, [dest('a', 30), dest('b', 80)])).toThrow(/somam 110%.*sobram 10%/)
  })
})
