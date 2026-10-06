import { describe, expect, it } from 'vitest'
import { addRow, applyTotal, editRowAmount, removeRow, resplit, rowsForMode, rowsToInput, type EditorRow } from './installmentsEditor'

const keyGen = () => {
  let n = 0
  return () => `k${++n}`
}

describe('rowsForMode', () => {
  const paid = { paid: true, methodId: 'mbway' }
  const notPaid = { paid: false, methodId: 'mbway' }

  it('de uma vez: uma linha com o total, já paga na data do trabalho (sem data prevista)', () => {
    const rows = rowsForMode('single', 45000, '2026-10-10', [], keyGen(), paid)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ amount: 45000, dueDate: '', received: { date: '2026-10-10', methodId: 'mbway' } })
  })

  it('de uma vez, num trabalho futuro: fica pendente', () => {
    const rows = rowsForMode('single', 45000, '2026-12-10', [], keyGen(), notPaid)
    expect(rows[0]!.received).toBeUndefined()
  })

  it('2 vezes: a 1.ª paga na data do trabalho e a 2.ª pendente', () => {
    const rows = rowsForMode('two', 45001, '2026-10-10', [], keyGen(), paid)
    expect(rows.map((r) => [r.amount, r.dueDate, r.received?.date ?? null])).toEqual([
      [22500, '', '2026-10-10'],
      [22501, '', null],
    ])
  })

  it('2 vezes num trabalho futuro: as duas pendentes', () => {
    const rows = rowsForMode('two', 45000, '2026-12-10', [], keyGen(), notPaid)
    expect(rows.map((r) => !!r.received)).toEqual([false, false])
  })

  it('personalizado: mantém as linhas existentes e acerta a última ao total', () => {
    const existing: EditorRow[] = [
      { key: 'x', amount: 10000, dueDate: '' },
      { key: 'y', amount: 10000, dueDate: '' },
      { key: 'z', amount: 10000, dueDate: '' },
    ]
    const rows = rowsForMode('custom', 45000, '2026-10-10', existing, keyGen(), paid)
    expect(rows.map((r) => r.amount)).toEqual([10000, 10000, 25000])
  })

  it('nunca perde pagamentos já feitos ao mudar de modo (o resto fica pendente)', () => {
    const existing: EditorRow[] = [
      { key: 'x', id: 'i1', amount: 22500, dueDate: '2026-10-01', received: { date: '2026-10-01', methodId: 'mbway' } },
      { key: 'y', id: 'i2', amount: 22500, dueDate: '' },
    ]
    const rows = rowsForMode('single', 45000, '2026-10-10', existing, keyGen(), paid)
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

describe('resplit / addRow / removeRow', () => {
  it('resplit divide o que falta por igual pelas prestações por receber, mantendo datas e métodos', () => {
    const rows: EditorRow[] = [
      { key: 'r', amount: 10000, dueDate: '2026-10-01', received: { date: '2026-10-01', methodId: 'mbway' } },
      { key: 'a', amount: 0, dueDate: '2026-10-10', expectedMethodId: 'transf' },
      { key: 'b', amount: 0, dueDate: '' },
    ]
    const out = resplit(rows, 30001)
    expect(out.map((r) => r.amount)).toEqual([10000, 10000, 10001])
    expect(out[1]).toMatchObject({ key: 'a', dueDate: '2026-10-10', expectedMethodId: 'transf' })
  })

  it('addRow acrescenta uma prestação e volta a dividir por igual', () => {
    const rows: EditorRow[] = [
      { key: 'a', amount: 22500, dueDate: '' },
      { key: 'b', amount: 22500, dueDate: '' },
    ]
    const out = addRow(rows, 45000, () => 'c')
    expect(out.map((r) => [r.key, r.amount])).toEqual([
      ['a', 15000],
      ['b', 15000],
      ['c', 15000],
    ])
  })

  it('removeRow tira a prestação e a última acerta o total', () => {
    const rows: EditorRow[] = [
      { key: 'a', amount: 15000, dueDate: '' },
      { key: 'b', amount: 15000, dueDate: '' },
      { key: 'c', amount: 15000, dueDate: '' },
    ]
    expect(removeRow(rows, 'b', 45000).map((r) => [r.key, r.amount])).toEqual([
      ['a', 15000],
      ['c', 30000],
    ])
  })
})
