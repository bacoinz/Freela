import { beforeEach, describe, expect, it } from 'vitest'
import {
  jobTotal,
  lastFromTotal,
  paidAmount,
  paidCount,
  receiveInstallment,
  remainingAmount,
  splitEven,
  undoInstallment,
} from './installments'
import { mkInst, mkJob, newId, resetIds } from './testkit'

beforeEach(() => resetIds())

describe('splitEven', () => {
  it('divide em partes iguais', () => {
    expect(splitEven(45000, 2)).toEqual([22500, 22500])
    expect(splitEven(60000, 3)).toEqual([20000, 20000, 20000])
  })

  it('o cêntimo que sobra vai para a última prestação', () => {
    expect(splitEven(45001, 2)).toEqual([22500, 22501])
    expect(splitEven(10000, 3)).toEqual([3333, 3333, 3334])
  })

  it('com 1 prestação devolve o total', () => {
    expect(splitEven(12345, 1)).toEqual([12345])
  })
})

describe('lastFromTotal', () => {
  it('a última prestação é o total menos as outras', () => {
    expect(lastFromTotal(45000, [15000])).toBe(30000)
    expect(lastFromTotal(45000, [15000, 10000])).toBe(20000)
  })
})

describe('totais de um trabalho', () => {
  it('soma prestações, recebido, falta e contagem', () => {
    const job = mkJob({
      installments: [
        mkInst({ amount: 22500, receivedDate: '2026-10-01', methodId: 'mbway' }),
        mkInst({ amount: 22500 }),
      ],
    })
    expect(jobTotal(job)).toBe(45000)
    expect(paidAmount(job)).toBe(22500)
    expect(remainingAmount(job)).toBe(22500)
    expect(paidCount(job)).toBe(1)
  })
})

describe('receiveInstallment', () => {
  const receipt = { date: '2026-10-06', methodId: 'mbway' }

  it('marca a prestação como recebida quando o valor é o previsto', () => {
    const job = mkJob({ installments: [mkInst({ id: 'a', amount: 22500 }), mkInst({ id: 'b', amount: 22500 })] })
    const out = receiveInstallment(job, 'a', { ...receipt, amount: 22500 }, newId)
    expect(out.installments).toHaveLength(2)
    expect(out.installments[0]).toMatchObject({ id: 'a', amount: 22500, receivedDate: '2026-10-06', methodId: 'mbway' })
    expect(out.installments[1]!.receivedDate).toBeUndefined()
    expect(jobTotal(out)).toBe(45000)
  })

  it('se receber menos, o resto passa a ser uma nova prestação pendente logo a seguir', () => {
    const job = mkJob({
      installments: [
        mkInst({ id: 'a', amount: 22500, dueDate: '2026-10-01', expectedMethodId: 'transf' }),
        mkInst({ id: 'b', amount: 22500, dueDate: '2026-11-01' }),
      ],
    })
    const out = receiveInstallment(job, 'a', { ...receipt, amount: 20000 }, newId)
    expect(out.installments.map((i) => i.amount)).toEqual([20000, 2500, 22500])
    expect(out.installments[0]!.receivedDate).toBe('2026-10-06')
    expect(out.installments[1]).toMatchObject({ amount: 2500, dueDate: '2026-10-01', expectedMethodId: 'transf' })
    expect(out.installments[1]!.receivedDate).toBeUndefined()
    expect(jobTotal(out)).toBe(45000)
  })

  it('se receber mais, as prestações seguintes baixam e o total mantém-se', () => {
    const job = mkJob({ installments: [mkInst({ id: 'a', amount: 22500 }), mkInst({ id: 'b', amount: 22500 })] })
    const out = receiveInstallment(job, 'a', { ...receipt, amount: 25000 }, newId)
    expect(out.installments.map((i) => i.amount)).toEqual([25000, 20000])
    expect(jobTotal(out)).toBe(45000)
  })

  it('o excesso pode eliminar prestações seguintes e passar para a outra', () => {
    const job = mkJob({
      installments: [
        mkInst({ id: 'a', amount: 10000 }),
        mkInst({ id: 'b', amount: 5000 }),
        mkInst({ id: 'c', amount: 10000 }),
      ],
    })
    const out = receiveInstallment(job, 'a', { ...receipt, amount: 18000 }, newId)
    expect(out.installments.map((i) => [i.id, i.amount])).toEqual([
      ['a', 18000],
      ['c', 7000],
    ])
    expect(jobTotal(out)).toBe(25000)
  })

  it('sem prestações pendentes para baixar, o total sobe', () => {
    const job = mkJob({ installments: [mkInst({ id: 'a', amount: 22500 })] })
    const out = receiveInstallment(job, 'a', { ...receipt, amount: 25000 }, newId)
    expect(jobTotal(out)).toBe(25000)
  })

  it('recusa valores não positivos e prestações já recebidas', () => {
    const job = mkJob({ installments: [mkInst({ id: 'a', amount: 100, receivedDate: '2026-10-01', methodId: 'x' })] })
    expect(() => receiveInstallment(job, 'a', { ...receipt, amount: 100 }, newId)).toThrow(/já foi recebida/)
    const job2 = mkJob({ installments: [mkInst({ id: 'a', amount: 100 })] })
    expect(() => receiveInstallment(job2, 'a', { ...receipt, amount: 0 }, newId)).toThrow(/maior do que zero/)
  })
})

describe('undoInstallment', () => {
  it('volta a pôr a prestação como pendente', () => {
    const job = mkJob({ installments: [mkInst({ id: 'a', amount: 100, receivedDate: '2026-10-01', methodId: 'x' })] })
    const out = undoInstallment(job, 'a')
    expect(out.installments[0]!.receivedDate).toBeUndefined()
    expect(out.installments[0]!.methodId).toBeUndefined()
    expect(out.installments[0]!.amount).toBe(100)
  })
})
