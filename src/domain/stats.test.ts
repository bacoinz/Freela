import { beforeEach, describe, expect, it } from 'vitest'
import { computeStats, presetRange, statsYears } from './stats'
import { mkData, mkInst, mkJob, resetIds } from './testkit'
import type { AppData } from './types'

beforeEach(() => resetIds())

const TODAY = '2026-10-06'
const rec = (amount: number, date: string, methodId: string) => mkInst({ amount, receivedDate: date, methodId, dueDate: date })

function sample(): AppData {
  return mkData({
    payers: [
      { id: 'pA', name: 'Hot Clube', color: '#6366f1' },
      { id: 'pE', name: 'Escola X', color: '#10b981' },
    ],
    obligationRecords: [
      { ruleId: 'r-ss', originalDate: '2026-09-20', status: 'done', date: '2026-09-15', amountPaid: 12000 },
      { ruleId: 'r-ss', originalDate: '2026-10-20', status: 'done', date: '2026-10-12', amountPaid: 12000 },
    ],
    jobs: [
      mkJob({ id: 'j1', payerId: 'pA', payerName: undefined, workDate: '2026-01-02', installments: [rec(10000, '2026-01-12', 'mbway')] }),
      mkJob({ id: 'j2', payerName: 'Bar Azul', categoryId: 'cat-outro', workDate: '2026-03-10', installments: [rec(30000, '2026-03-15', 'transf')] }),
      mkJob({ id: 'j3', payerId: 'pA', payerName: undefined, workDate: '2026-03-01', installments: [rec(5000, '2026-03-31', 'dinheiro')] }),
      mkJob({
        id: 'j4',
        payerId: 'pE',
        payerName: undefined,
        workDate: '2026-10-05',
        recurringId: 'rec1',
        period: '2026-10',
        installments: [rec(60000, '2026-10-05', 'transf')],
      }),
      mkJob({ id: 'old', payerName: 'Bar Azul', workDate: '2025-10-01', installments: [rec(20000, '2025-10-03', 'mbway')] }),
      mkJob({
        id: 'p1',
        title: 'Casamento',
        payerName: 'Família Silva',
        workDate: '2026-09-20',
        installments: [rec(22500, '2026-09-20', 'mbway'), mkInst({ amount: 22500, dueDate: '2026-10-01' })],
      }),
      mkJob({ id: 'p2', payerId: 'pA', payerName: undefined, workDate: '2026-10-02', installments: [mkInst({ amount: 10000, dueDate: '2026-11-01' })] }),
    ],
  })
}

describe('presetRange', () => {
  it('calcula os períodos: um ano, últimos 12 meses e tudo', () => {
    const data = sample()
    expect(presetRange({ kind: 'year', year: 2026 }, data, TODAY)).toEqual({ from: '2026-01-01', to: TODAY })
    expect(presetRange({ kind: 'year', year: 2025 }, data, TODAY)).toEqual({ from: '2025-01-01', to: '2025-12-31' })
    expect(presetRange({ kind: 'year', year: 2027 }, data, TODAY)).toEqual({ from: '2027-01-01', to: '2027-12-31' })
    expect(presetRange({ kind: 'last12' }, data, TODAY)).toEqual({ from: '2025-11-01', to: TODAY })
    expect(presetRange({ kind: 'all' }, data, TODAY)).toEqual({ from: '2025-10-03', to: TODAY })
  })
})

describe('statsYears', () => {
  it('do primeiro ano com dados até ao ano seguinte ao atual (no máximo 3)', () => {
    expect(statsYears(mkData(), TODAY)).toEqual([2026, 2027])
    expect(statsYears(sample(), TODAY)).toEqual([2025, 2026, 2027])
    const old = mkData({ jobs: [mkJob({ installments: [rec(100, '2022-03-01', 'mbway')] })] })
    expect(statsYears(old, TODAY)).toEqual([2025, 2026, 2027])
  })
})

describe('computeStats (este ano)', () => {
  const s = () => computeStats(sample(), presetRange({ kind: 'year', year: 2026 }, sample(), TODAY), TODAY)

  it('resumo: total, média mensal, trabalhos, valor médio e investimento', () => {
    const { summary } = s()
    // 100 + 300 + 50 + 600 + 225 (1.ª prestação do casamento) = 1275 €
    expect(summary.total).toBe(127500)
    expect(summary.months).toBe(10)
    expect(summary.monthlyAvg).toBe(12750)
    expect(summary.jobsCount).toBe(5)
    expect(summary.avgPerJob).toBe(25500)
    expect(summary.invest).toBe(1500 + 4500 + 750 + 9000 + 3375)
    expect(summary.fixed).toBe(60000)
    expect(summary.variable).toBe(67500)
  })

  it('compara com o mesmo período do ano anterior', () => {
    const { summary } = s()
    expect(summary.prevTotal).toBe(20000)
    expect(summary.deltaPct).toBeCloseTo(537.5)
  })

  it('melhor e pior mês contam meses a 0 € (o pior empatado é o mais antigo)', () => {
    const { best, worst, monthly } = s()
    expect(monthly.map((m) => m.period)).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10',
    ])
    expect(best?.period).toBe('2026-10')
    expect(best?.total).toBe(60000)
    expect(worst?.period).toBe('2026-02')
    expect(worst?.total).toBe(0)
    expect(monthly[2]!.byCategory).toEqual({ 'cat-outro': 30000, 'cat-musica': 5000 })
  })

  it('por método, ordenado do que rende mais', () => {
    const { byMethod } = s()
    expect(byMethod.map((b) => [b.key, b.total, b.count])).toEqual([
      ['transf', 90000, 2],
      ['mbway', 32500, 2],
      ['dinheiro', 5000, 1],
    ])
    expect(byMethod[0]!.label).toBe('Transferência bancária')
    expect(byMethod[0]!.pct).toBeCloseTo(70.588, 2)
  })

  it('por categoria', () => {
    const { byCategory } = s()
    expect(byCategory.map((b) => [b.key, b.total])).toEqual([
      ['cat-musica', 97500],
      ['cat-outro', 30000],
    ])
  })

  it('por pagador: total, trabalhos, média, dias até pagar e quanto deve', () => {
    const { byPayer } = s()
    const hot = byPayer.find((p) => p.key === 'id:pA')!
    expect(hot).toMatchObject({ label: 'Hot Clube', color: '#6366f1', total: 15000, jobs: 2, avgPerJob: 7500, avgDaysToPay: 20, owed: 10000 })
    const silva = byPayer.find((p) => p.key === 'name:familia silva')!
    expect(silva).toMatchObject({ total: 22500, owed: 22500 })
    expect(silva.avgDaysToPay).toBeUndefined() // ainda não pagou tudo
    expect(byPayer[0]!.key).toBe('id:pE') // 600 € — o maior
  })

  it('investimento acumulado, previsto e pago ao Estado', () => {
    const st = s()
    expect(st.investAllTime).toBe(1500 + 4500 + 750 + 9000 + 3375 + 3000)
    expect(st.investExpected).toBe(3375 + 1500)
    expect(st.investDone).toBe(0)
    expect(st.investPending).toBe(st.investAllTime)
    expect(st.statePaid.total).toBe(12000) // só o de setembro está no período
  })

  it('separa o já investido do que falta investir', () => {
    const d = sample()
    const job = d.jobs.find((j) => j.installments.some((i) => i.receivedDate))!
    const inst = job.installments.find((i) => i.receivedDate)!
    inst.invested = { date: TODAY, parts: [{ destinationId: 'poupanca', name: 'Conta poupança', amount: 999 }] }
    const st = computeStats(d, presetRange({ kind: 'all' }, d, TODAY), TODAY)
    expect(st.investDone).toBe(999)
    expect(st.investDone + st.investPending).toBe(st.investAllTime)
  })

  it('já investido em cada destino, desde o início', () => {
    const d = sample()
    const [a, b] = d.jobs.flatMap((j) => j.installments.filter((i) => i.receivedDate))
    a!.invested = { date: TODAY, parts: [{ destinationId: 'poupanca', name: 'Conta poupança', amount: 300 }, { destinationId: 'bitcoin', name: 'Bitcoin', amount: 1200 }] }
    b!.invested = { date: TODAY, parts: [{ destinationId: 'poupanca', name: 'Poupança', amount: 100 }, { destinationId: 'acoes', name: 'Ações', amount: 50 }] }
    const st = computeStats(d, presetRange({ kind: 'all' }, d, TODAY), TODAY)
    expect(st.investDoneParts.map((p) => [p.name, p.amount])).toEqual([
      ['Poupança', 400],
      ['Bitcoin', 1200],
      ['Ações', 50],
    ])
    expect(st.statePaid.byPeriod['2026-09']).toBe(12000)
  })

  it('pendentes: total, atrasados e o mais antigo', () => {
    const { pending } = s()
    expect(pending).toMatchObject({ total: 32500, count: 2, overdueTotal: 22500, overdueCount: 1 })
    expect(pending.oldest?.jobId).toBe('p1')
  })
})

describe('computeStats sem dados', () => {
  it('não rebenta', () => {
    const data = mkData()
    const st = computeStats(data, presetRange({ kind: 'all' }, data, TODAY), TODAY)
    expect(st.summary.total).toBe(0)
    expect(st.summary.avgPerJob).toBe(0)
    expect(st.summary.deltaPct).toBeUndefined()
    expect(st.byMethod).toEqual([])
  })
})
