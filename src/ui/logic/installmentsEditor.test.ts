import { describe, expect, it } from 'vitest'
import { applyTotal, editRowAmount, rowsForMode, rowsToInput, type EditorRow } from './installmentsEditor'

const keyGen = () => {
  let n = 0
  return () => `k${++n}`
}

describe('rowsForMode', () => {
  it('pagamento único: uma linha com o total, prevista na data do trabalho', () => {
    const rows = rowsForMode('single', 45000, '2026-10-10', [], keyGen())
    expect(rows.map((r) => [r.amount, r.dueDate])).toEqual([[45000, '2026-10-10']])
  })

  it('2 vezes: metade no início (data do trabalho) e metade no fim (sem data)', () => {
    const rows = rowsForMode('two', 45001, '2026-10-10', [], keyGen())
    expect(rows.map((r) => [r.amount, r.dueDate])).toEqual([
      [22500, '2026-10-10'],
      [22501, ''],
    ])
  })

  it('personalizado: mantém as linhas existentes e acerta a última ao total', () => {
    const existing: EditorRow[] = [
      { key: 'x', amount: 10000, dueDate: '2026-10-01' },
      { key: 'y', amount: 10000, dueDate: '2026-11-01' },
      { key: 'z', amount: 10000, dueDate: '2026-12-01' },
    ]
    const rows = rowsForMode('custom', 45000, '2026-10-10', existing, keyGen())
    expect(rows.map((r) => r.amount)).toEqual([10000, 10000, 25000])
  })

  it('nunca perde prestações já recebidas ao mudar de modo', () => {
    const existing: EditorRow[] = [
      { key: 'x', id: 'i1', amount: 22500, dueDate: '2026-10-01', received: { date: '2026-10-01', methodId: 'mbway' } },
      { key: 'y', id: 'i2', amount: 22500, dueDate: '' },
    ]
    const rows = rowsForMode('single', 45000, '2026-10-10', existing, keyGen())
    expect(rows.map((r) => [r.id, r.amount, !!r.received])).toEqual([
      ['i1', 22500, true],
      [undefined, 22500, false],
    ])
  })
})

describe('editRowAmount / applyTotal', () => {
  const rows = (): EditorRow[] => [
    { key: 'a', amount: 22500, dueDate: '' },
    { key: 'b', amount: 22500, dueDate: '' },
  ]

  it('editar uma prestação recalcula a última para manter o total', () => {
    expect(editRowAmount(rows(), 'a', 15000, 45000).map((r) => r.amount)).toEqual([15000, 30000])
  })

  it('editar a última muda o total (devolvido à parte)', () => {
    const out = editRowAmount(rows(), 'b', 30000, 45000)
    expect(out.map((r) => r.amount)).toEqual([22500, 30000])
  })

  it('mudar o total acerta a última prestação por receber', () => {
    expect(applyTotal(rows(), 50000).map((r) => r.amount)).toEqual([22500, 27500])
  })
})

describe('rowsToInput', () => {
  it('converte para o formato das operações (datas vazias ficam sem data)', () => {
    const out = rowsToInput([
      { key: 'a', id: 'i1', amount: 100, dueDate: '2026-10-01', expectedMethodId: 'mbway' },
      { key: 'b', amount: 200, dueDate: '', received: { date: '2026-10-02', methodId: 'transf' } },
    ])
    expect(out).toEqual([
      { id: 'i1', amount: 100, dueDate: '2026-10-01', expectedMethodId: 'mbway' },
      { amount: 200, received: { date: '2026-10-02', methodId: 'transf' } },
    ])
  })
})
