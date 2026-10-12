import { beforeEach, describe, expect, it } from 'vitest'
import { defaultPlan, planFor } from './invest'
import { markInvested, setInvestPlan, undoInvested, undoReceive, updateJob } from './ops'
import { mkCtx, mkData, mkInst, mkJob, resetIds } from './testkit'
import type { AppData } from './types'

beforeEach(() => resetIds())

const nov = () => mkCtx('2026-11-10')
const got = (id: string, amount: number, date: string) => mkInst({ id, amount, receivedDate: date, methodId: 'mbway' })

describe('setInvestPlan', () => {
  it('uma mudança conta a partir do mês atual; os meses anteriores mantêm o que tinham', () => {
    const out = setInvestPlan(mkData(), { pct: 20 }, nov())
    const plans = out.settings.investPlans
    expect(plans.map((p) => [p.from, p.pct])).toEqual([
      ['2000-01', 15],
      ['2026-11', 20],
    ])
    expect(planFor(plans, '2026-10').pct).toBe(15)
    expect(planFor(plans, '2026-11').destinations).toEqual(defaultPlan().destinations)
  })

  it('mudar outra vez no mesmo mês atualiza esse mês (sem entradas repetidas)', () => {
    let d = setInvestPlan(mkData(), { pct: 20 }, nov())
    d = setInvestPlan(d, { destinations: [{ id: 'poupanca', name: 'Poupança', where: ' CGD ', pct: 30 }, { id: 'btc', name: 'Bitcoin', pct: 70 }] }, nov())
    expect(d.settings.investPlans).toHaveLength(2)
    expect(d.settings.investPlans[1]).toEqual({
      from: '2026-11',
      pct: 20,
      destinations: [
        { id: 'poupanca', name: 'Poupança', where: 'CGD', pct: 30 },
        { id: 'btc', name: 'Bitcoin', pct: 70 },
      ],
    })
  })

  it('voltar a deixar igual ao mês anterior não guarda uma entrada a mais', () => {
    let d = setInvestPlan(mkData(), { pct: 20 }, nov())
    d = setInvestPlan(d, { pct: 15 }, nov())
    expect(d.settings.investPlans.map((p) => p.from)).toEqual(['2000-01'])
  })

  it('dá ids aos destinos novos e valida', () => {
    const d = setInvestPlan(mkData(), { destinations: [{ id: '', name: 'Ações', pct: 100 }] }, nov())
    expect(d.settings.investPlans[1]!.destinations[0]!.id).toMatch(/^id\d+$/)
    expect(() => setInvestPlan(mkData(), { destinations: [{ id: 'a', name: 'A', pct: 50 }] }, nov())).toThrow(/faltam 50%/)
  })
})

describe('markInvested / undoInvested', () => {
  function data(): AppData {
    return mkData({
      jobs: [mkJob({ id: 'j', installments: [got('i1', 22500, '2026-10-20'), got('i2', 22500, '2026-11-05'), mkInst({ id: 'i3', amount: 10000 })] })],
    })
  }

  it('marca com a data de hoje e guarda quanto foi para cada destino (pelo plano do mês do recebimento)', () => {
    let d = setInvestPlan(data(), { pct: 20 }, nov())
    d = markInvested(d, [{ jobId: 'j', installmentId: 'i1' }, { jobId: 'j', installmentId: 'i2' }], nov())
    const [a, b] = d.jobs[0]!.installments
    expect(a!.invested).toEqual({
      date: '2026-11-10',
      parts: [
        { destinationId: 'poupanca', name: 'Conta poupança', amount: 675 },
        { destinationId: 'bitcoin', name: 'Bitcoin', amount: 2700 },
      ],
    })
    expect(b!.invested!.parts.map((p) => p.amount)).toEqual([900, 3600])
  })

  it('não marca pagamentos por receber nem volta a marcar os já investidos', () => {
    let d = markInvested(data(), [{ jobId: 'j', installmentId: 'i1' }], nov())
    const first = d.jobs[0]!.installments[0]!.invested
    d = markInvested(d, [{ jobId: 'j', installmentId: 'i1' }, { jobId: 'j', installmentId: 'i3' }], mkCtx('2026-12-01'))
    expect(d.jobs[0]!.installments[0]!.invested).toEqual(first)
    expect(d.jobs[0]!.installments[2]!.invested).toBeUndefined()
  })

  it('anular tira a marca', () => {
    const d = undoInvested(markInvested(data(), [{ jobId: 'j', installmentId: 'i1' }], nov()), 'j', 'i1', nov())
    expect(d.jobs[0]!.installments[0]!.invested).toBeUndefined()
  })

  it('anular o recebimento também tira a marca de investido', () => {
    const d = undoReceive(markInvested(data(), [{ jobId: 'j', installmentId: 'i1' }], nov()), 'j', 'i1', nov())
    expect(d.jobs[0]!.installments[0]).not.toHaveProperty('invested')
  })

  it('editar o trabalho conserva a marca se o pagamento continua recebido com o mesmo valor', () => {
    const d = markInvested(data(), [{ jobId: 'j', installmentId: 'i1' }, { jobId: 'j', installmentId: 'i2' }], nov())
    const input = {
      title: 'Concerto',
      categoryId: 'cat-musica',
      payer: { kind: 'oneoff' as const, name: 'Bar X' },
      workDate: '2026-10-01',
      installments: [
        { id: 'i1', amount: 22500, received: { date: '2026-10-20', methodId: 'mbway' } },
        { id: 'i2', amount: 30000, received: { date: '2026-11-05', methodId: 'mbway' } },
      ],
    }
    const out = updateJob(d, 'j', input, nov()).jobs[0]!.installments
    expect(out[0]!.invested).toEqual(d.jobs[0]!.installments[0]!.invested)
    expect(out[1]!.invested).toBeUndefined() // o valor mudou: volta a ficar por investir
  })
})
