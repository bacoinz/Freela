import { beforeEach, describe, expect, it } from 'vitest'
import {
  isInstallmentOverdue,
  jobStatus,
  nextPendingInstallment,
  overdueDateOf,
} from './jobs'
import { mkInst, mkJob, resetIds } from './testkit'

beforeEach(() => resetIds())

const TODAY = '2026-10-06'
const rec = (amount: number, date = '2026-10-01') => mkInst({ amount, receivedDate: date, methodId: 'mbway' })

describe('overdueDateOf / isInstallmentOverdue', () => {
  it('usa a data prevista da prestação', () => {
    const inst = mkInst({ dueDate: '2026-10-05' })
    const job = mkJob({ installments: [inst] })
    expect(overdueDateOf(inst, job, 30)).toBe('2026-10-05')
    expect(isInstallmentOverdue(inst, job, TODAY, 30)).toBe(true)
  })

  it('não está atrasada no próprio dia previsto', () => {
    const inst = mkInst({ dueDate: TODAY })
    expect(isInstallmentOverdue(inst, mkJob({ installments: [inst] }), TODAY, 30)).toBe(false)
  })

  it('sem data prevista, conta a data do trabalho + N dias', () => {
    const inst = mkInst()
    const job = mkJob({ workDate: '2026-09-01', installments: [inst] })
    expect(overdueDateOf(inst, job, 30)).toBe('2026-10-01')
    expect(isInstallmentOverdue(inst, job, TODAY, 30)).toBe(true)
    expect(isInstallmentOverdue(inst, job, TODAY, 40)).toBe(false)
  })

  it('uma prestação recebida nunca está atrasada', () => {
    const inst = rec(100)
    expect(isInstallmentOverdue({ ...inst, dueDate: '2020-01-01' }, mkJob({ installments: [inst] }), TODAY, 30)).toBe(false)
  })
})

describe('jobStatus', () => {
  it('recebido quando todas as prestações foram recebidas', () => {
    expect(jobStatus(mkJob({ installments: [rec(100), rec(200)] }), TODAY, 30)).toBe('received')
  })

  it('pendente quando nada foi recebido e não há atraso', () => {
    expect(jobStatus(mkJob({ installments: [mkInst({ dueDate: '2026-10-20' })] }), TODAY, 30)).toBe('pending')
  })

  it('parcial quando parte foi recebida e o resto não está atrasado', () => {
    const job = mkJob({ installments: [rec(100), mkInst({ dueDate: '2026-11-01' })] })
    expect(jobStatus(job, TODAY, 30)).toBe('partial')
  })

  it('atrasado tem prioridade sobre parcial', () => {
    const job = mkJob({ installments: [rec(100), mkInst({ dueDate: '2026-10-01' })] })
    expect(jobStatus(job, TODAY, 30)).toBe('overdue')
  })
})

describe('nextPendingInstallment', () => {
  it('devolve a primeira prestação por receber', () => {
    const a = rec(100)
    const b = mkInst({ amount: 200 })
    const c = mkInst({ amount: 300 })
    expect(nextPendingInstallment(mkJob({ installments: [a, b, c] }))?.id).toBe(b.id)
    expect(nextPendingInstallment(mkJob({ installments: [a] }))).toBeUndefined()
  })
})
