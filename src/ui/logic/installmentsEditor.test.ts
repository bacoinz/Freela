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

  it('de uma vez num trabalho novo: o total escrito depois vai para o pagamento, mesmo já pago', () => {
    const rows = rowsForMode('single', 0, '2026-10-10', [], keyGen(), paid)
    expect(resplit(rows, 45000)).toMatchObject([{ amount: 45000, received: { date: '2026-10-10', methodId: 'mbway' } }])
  })

  it('2 vezes → de uma vez num trabalho novo: volta a ser um só pagamento, com o total', () => {
    const k = keyGen()
    const two = rowsForMode('two', 45000, '2026-10-10', rowsForMode('single', 45000, '2026-10-10', [], k, paid), k, paid)
    const back = rowsForMode('single', 45000, '2026-10-10', two, k, paid)
    expect(back).toHaveLength(1)
    expect(back[0]).toMatchObject({ amount: 45000, received: { date: '2026-10-10', methodId: 'mbway' } })
  })

  it('de uma vez → 2 vezes: divide o total, e o 1.º pagamento mantém o estado que tinha', () => {
    const k = keyGen()
    const single = rowsForMode('single', 45000, '2026-10-10', [], k, notPaid)
    const two = rowsForMode('two', 45000, '2026-10-10', single, k, paid)
    expect(two.map((r) => [r.amount, !!r.received])).toEqual([
      [22500, false],
      [22500, false],
    ])
  })

  it('de uma vez → personalizado: não acrescenta um pagamento a zero', () => {
    const k = keyGen()
    const single = rowsForMode('single', 45000, '2026-10-10', [], k, paid)
    const custom = rowsForMode('custom', 45000, '2026-10-10', single, k, paid)
    expect(custom.map((r) => [r.amount, !!r.received])).toEqual([[45000, true]])
  })

  it('num trabalho já guardado, o pagamento recebido nunca se perde ao mudar de modo', () => {
    const existing: EditorRow[] = [
      { key: 'x', id: 'i1', amount: 22500, dueDate: '2026-10-01', received: { date: '2026-10-01', methodId: 'mbway' } },
      { key: 'y', id: 'i2', amount: 22500, dueDate: '' },
    ]
    const two = rowsForMode('two', 45000, '2026-10-10', existing, keyGen(), paid)
    expect(two.map((r) => [r.id, r.amount, !!r.received])).toEqual([
      ['i1', 22500, true],
      ['i2', 22500, false],
    ])
    // "De uma vez" = um só pagamento: o que já foi recebido fica, agora com o total.
    const single = rowsForMode('single', 45000, '2026-10-10', existing, keyGen(), paid)
    expect(single.map((r) => [r.id, r.amount, !!r.received])).toEqual([['i1', 45000, true]])
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

  it('se todos os pagamentos já estavam recebidos, o último acerta o total', () => {
    const got = (id: string): EditorRow => ({ key: id, id, amount: 22500, dueDate: '', received: { date: '2026-10-01', methodId: 'mbway' } })
    expect(applyTotal([got('a'), got('b')], 50000).map((r) => r.amount)).toEqual([22500, 27500])
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
  it('resplit mantém os pagamentos já guardados como recebidos e divide o resto por igual, mantendo datas e métodos', () => {
    const rows: EditorRow[] = [
      { key: 'r', id: 'i0', amount: 10000, dueDate: '2026-10-01', received: { date: '2026-10-01', methodId: 'mbway' } },
      { key: 'a', amount: 0, dueDate: '2026-10-10', expectedMethodId: 'transf' },
      { key: 'b', amount: 0, dueDate: '' },
    ]
    const out = resplit(rows, 30001)
    expect(out.map((r) => r.amount)).toEqual([10000, 10000, 10001])
    expect(out[1]).toMatchObject({ key: 'a', dueDate: '2026-10-10', expectedMethodId: 'transf' })
  })

  it('resplit também divide pagamentos novos marcados como pagos (ainda não foram guardados)', () => {
    const rows: EditorRow[] = [
      { key: 'a', amount: 0, dueDate: '', received: { date: '2026-10-10', methodId: 'mbway' } },
      { key: 'b', amount: 0, dueDate: '' },
    ]
    expect(resplit(rows, 45000).map((r) => r.amount)).toEqual([22500, 22500])
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
