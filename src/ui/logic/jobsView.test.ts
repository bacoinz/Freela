import { beforeEach, describe, expect, it } from 'vitest'
import { mkData, mkInst, mkJob, resetIds } from '../../domain/testkit'
import { filterJobs, groupByMonth } from './jobsView'

beforeEach(() => resetIds())
const TODAY = '2026-10-06'

function data() {
  return mkData({
    payers: [{ id: 'p1', name: 'Hot Clube', color: '#6366f1' }],
    jobs: [
      mkJob({ id: 'a', title: 'Concerto Jazz', payerId: 'p1', payerName: undefined, workDate: '2026-10-02', installments: [mkInst({ amount: 15000, dueDate: '2026-10-20' })] }),
      mkJob({ id: 'b', title: 'Casamento', payerName: 'Família Silva', workDate: '2026-09-20', notes: 'Igreja de São Roque', installments: [mkInst({ amount: 22500, receivedDate: '2026-09-20', methodId: 'mbway' }), mkInst({ amount: 22500, dueDate: '2026-10-01' })] }),
      mkJob({ id: 'c', title: 'Gravação EP', categoryId: 'cat-outro', payerName: 'Banda X', workDate: '2026-08-10', installments: [mkInst({ amount: 30000, receivedDate: '2026-08-15', methodId: 'transf' })] }),
      mkJob({ id: 'd', title: 'Aulas', payerName: 'Escola', workDate: '2025-12-01', installments: [mkInst({ amount: 60000, receivedDate: '2025-12-05', methodId: 'transf' })] }),
    ],
  })
}

describe('filterJobs', () => {
  it('"A receber": só trabalhos com valores por receber, os mais atrasados primeiro', () => {
    expect(filterJobs(data(), { tab: 'receber' }, TODAY).map((j) => j.id)).toEqual(['b', 'a'])
  })

  it('"Todos": por data do trabalho, mais recentes primeiro', () => {
    expect(filterJobs(data(), { tab: 'todos' }, TODAY).map((j) => j.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('pesquisa no título, pagador e notas, sem acentos', () => {
    const d = data()
    expect(filterJobs(d, { tab: 'todos', query: 'sao roque' }, TODAY).map((j) => j.id)).toEqual(['b'])
    expect(filterJobs(d, { tab: 'todos', query: 'hot' }, TODAY).map((j) => j.id)).toEqual(['a'])
    expect(filterJobs(d, { tab: 'todos', query: 'GRAVACAO' }, TODAY).map((j) => j.id)).toEqual(['c'])
  })

  it('filtra por categoria, pagador, método e ano', () => {
    const d = data()
    expect(filterJobs(d, { tab: 'todos', categoryId: 'cat-outro' }, TODAY).map((j) => j.id)).toEqual(['c'])
    expect(filterJobs(d, { tab: 'todos', payerKey: 'id:p1' }, TODAY).map((j) => j.id)).toEqual(['a'])
    expect(filterJobs(d, { tab: 'todos', methodId: 'transf' }, TODAY).map((j) => j.id)).toEqual(['c', 'd'])
    expect(filterJobs(d, { tab: 'todos', year: 2025 }, TODAY).map((j) => j.id)).toEqual(['d'])
  })
})

describe('groupByMonth', () => {
  it('agrupa por mês do trabalho com total e recebido', () => {
    const jobs = filterJobs(data(), { tab: 'todos' }, TODAY)
    const groups = groupByMonth(jobs)
    expect(groups.map((g) => [g.period, g.total, g.received, g.jobs.length])).toEqual([
      ['2026-10', 15000, 0, 1],
      ['2026-09', 45000, 22500, 1],
      ['2026-08', 30000, 30000, 1],
      ['2025-12', 60000, 60000, 1],
    ])
  })
})
