import { beforeEach, describe, expect, it } from 'vitest'
import { defaultObligationRules } from './obligations'
import {
  addJob,
  applyRecurring,
  deleteJob,
  duplicateJob,
  markOccurrence,
  promoteOneOff,
  receive,
  removeMethod,
  removeObligationRule,
  removePayer,
  setOccurrenceDueDate,
  undoReceive,
  unmarkOccurrence,
  updateJob,
  upsertRecurring,
  type JobInput,
} from './ops'
import { PAYER_PALETTE } from './payers'
import { mkCtx, mkData, mkInst, mkJob, mkRecurring, newId, resetIds } from './testkit'

beforeEach(() => resetIds())

const ctx = () => mkCtx('2026-10-06')
const base = (p: Partial<JobInput> = {}): JobInput => ({
  title: 'Casamento Silva',
  categoryId: 'cat-musica',
  payer: { kind: 'oneoff', name: '  Família Silva ' },
  workDate: '2026-10-10',
  investPct: 15,
  installments: [{ amount: 22500, dueDate: '2026-10-10' }, { amount: 22500, dueDate: '2026-10-30' }],
  ...p,
})

describe('addJob', () => {
  it('cria um trabalho com pagador avulso', () => {
    const { data, id } = addJob(mkData(), base(), ctx())
    const job = data.jobs.find((j) => j.id === id)!
    expect(job).toMatchObject({ title: 'Casamento Silva', payerName: 'Família Silva', workDate: '2026-10-10', investPct: 15 })
    expect(job.payerId).toBeUndefined()
    expect(job.installments.map((i) => i.amount)).toEqual([22500, 22500])
    expect(job.createdAt).toBe('2026-10-06T12:00:00.000Z')
    expect(data.payers).toEqual([])
  })

  it('guarda um pagador novo com a próxima cor da paleta', () => {
    const { data, id } = addJob(mkData(), base({ payer: { kind: 'new', name: 'Hot Clube' } }), ctx())
    expect(data.payers).toHaveLength(1)
    expect(data.payers[0]).toMatchObject({ name: 'Hot Clube', color: PAYER_PALETTE[0] })
    expect(data.jobs.find((j) => j.id === id)!.payerId).toBe(data.payers[0]!.id)
  })

  it('reaproveita um pagador guardado com o mesmo nome em vez de duplicar', () => {
    const start = mkData({ payers: [{ id: 'p1', name: 'Hot Clube', color: '#000' }] })
    const { data, id } = addJob(start, base({ payer: { kind: 'new', name: 'hot clube' } }), ctx())
    expect(data.payers).toHaveLength(1)
    expect(data.jobs.find((j) => j.id === id)!.payerId).toBe('p1')
  })

  it('regista prestações já recebidas', () => {
    const { data, id } = addJob(
      mkData(),
      base({ installments: [{ amount: 22500, received: { date: '2026-10-06', methodId: 'mbway' } }, { amount: 22500 }] }),
      ctx(),
    )
    const job = data.jobs.find((j) => j.id === id)!
    expect(job.installments[0]).toMatchObject({ receivedDate: '2026-10-06', methodId: 'mbway' })
    expect(job.installments[1]!.receivedDate).toBeUndefined()
  })

  it('valida os dados', () => {
    expect(() => addJob(mkData(), base({ title: '  ' }), ctx())).toThrow(/descrição/)
    expect(() => addJob(mkData(), base({ installments: [] }), ctx())).toThrow(/prestação/)
    expect(() => addJob(mkData(), base({ installments: [{ amount: 0 }] }), ctx())).toThrow(/maior do que zero/)
    expect(() => addJob(mkData(), base({ payer: { kind: 'oneoff', name: ' ' } }), ctx())).toThrow(/quem paga/)
    expect(() => addJob(mkData(), base({ categoryId: 'nao-existe' }), ctx())).toThrow(/categoria/)
  })
})

describe('updateJob', () => {
  it('altera campos e prestações (mantém ids, remove e acrescenta)', () => {
    const start = addJob(mkData(), base(), ctx())
    const job = start.data.jobs[0]!
    const [a] = job.installments
    const data = updateJob(
      start.data,
      job.id,
      base({
        title: 'Casamento Silva (igreja)',
        installments: [{ id: a!.id, amount: 30000, received: { date: '2026-10-10', methodId: 'transf' } }, { amount: 20000 }],
      }),
      mkCtx('2026-10-07'),
    )
    const out = data.jobs[0]!
    expect(out.title).toBe('Casamento Silva (igreja)')
    expect(out.installments[0]).toMatchObject({ id: a!.id, amount: 30000, receivedDate: '2026-10-10', methodId: 'transf' })
    expect(out.installments[1]!.id).not.toBe(job.installments[1]!.id)
    expect(out.installments).toHaveLength(2)
    expect(out.createdAt).toBe(job.createdAt)
    expect(out.updatedAt).toBe('2026-10-07T12:00:00.000Z')
  })
})

describe('deleteJob / rendimentos fixos', () => {
  it('ao eliminar com "saltar este mês", o mês não volta a ser criado', () => {
    let data = mkData({ recurring: [mkRecurring()] })
    data = applyRecurring(data, ctx())
    expect(data.jobs).toHaveLength(1)
    const job = data.jobs[0]!
    data = deleteJob(data, job.id, { skipRecurringPeriod: true })
    expect(data.jobs).toHaveLength(0)
    expect(data.recurring[0]!.skippedPeriods).toEqual(['2026-10'])
    expect(applyRecurring(data, ctx()).jobs).toHaveLength(0)
  })

  it('applyRecurring devolve o mesmo objeto quando não há nada a criar', () => {
    const data = mkData()
    expect(applyRecurring(data, ctx())).toBe(data)
  })

  it('upsertRecurring cria e atualiza', () => {
    const { id: _id, ...fields } = mkRecurring()
    const start = mkData({ payers: [{ id: 'p-escola', name: 'Escola X', color: '#000' }] })
    expect(() => upsertRecurring(mkData(), fields, ctx())).toThrow(/quem paga/)
    const created = upsertRecurring(start, fields, ctx())
    expect(created.data.recurring).toHaveLength(1)
    const updated = upsertRecurring(created.data, { ...fields, id: created.id, amount: 65000 }, ctx())
    expect(updated.data.recurring).toHaveLength(1)
    expect(updated.data.recurring[0]).toMatchObject({ id: created.id, amount: 65000 })
  })
})

describe('duplicateJob', () => {
  it('cria uma cópia por receber, com data de hoje e datas previstas deslocadas', () => {
    const original = mkJob({
      workDate: '2026-09-01',
      recurringId: 'rec1',
      period: '2026-09',
      installments: [
        mkInst({ amount: 100, dueDate: '2026-09-01', receivedDate: '2026-09-02', methodId: 'mbway' }),
        mkInst({ amount: 200, dueDate: '2026-09-11' }),
      ],
    })
    const { data, id } = duplicateJob(mkData({ jobs: [original] }), original.id, ctx())
    const copy = data.jobs.find((j) => j.id === id)!
    expect(copy.workDate).toBe('2026-10-06')
    expect(copy.installments.map((i) => [i.amount, i.dueDate, i.receivedDate, i.expectedMethodId])).toEqual([
      [100, '2026-10-06', undefined, 'mbway'],
      [200, '2026-10-16', undefined, undefined],
    ])
    expect(copy.recurringId).toBeUndefined()
    expect(copy.period).toBeUndefined()
    expect(data.jobs).toHaveLength(2)
  })
})

describe('receive / undoReceive', () => {
  it('marca e anula o recebimento de uma prestação', () => {
    const job = mkJob({ installments: [mkInst({ id: 'a', amount: 22500 })] })
    let data = receive(mkData({ jobs: [job] }), job.id, 'a', { amount: 20000, date: '2026-10-06', methodId: 'mbway' }, ctx())
    expect(data.jobs[0]!.installments.map((i) => [i.amount, i.receivedDate])).toEqual([
      [20000, '2026-10-06'],
      [2500, undefined],
    ])
    data = undoReceive(data, job.id, 'a', ctx())
    expect(data.jobs[0]!.installments[0]!.receivedDate).toBeUndefined()
  })
})

describe('pagadores, categorias e métodos', () => {
  it('apaga um pagador sem uso, arquiva se estiver em uso', () => {
    const data = mkData({
      payers: [
        { id: 'p1', name: 'A', color: '#1' },
        { id: 'p2', name: 'B', color: '#2' },
      ],
      jobs: [mkJob({ payerId: 'p2', payerName: undefined })],
    })
    expect(removePayer(data, 'p1').payers.map((p) => p.id)).toEqual(['p2'])
    expect(removePayer(data, 'p2').payers.find((p) => p.id === 'p2')!.archived).toBe(true)
  })

  it('transforma um pagador avulso em guardado e atualiza os trabalhos com esse nome', () => {
    const data = mkData({
      jobs: [mkJob({ payerName: 'Bar Azul' }), mkJob({ payerName: 'bar  azul' }), mkJob({ payerName: 'Outro' })],
    })
    const { data: out, id } = promoteOneOff(data, 'Bar Azul', ctx())
    expect(out.payers).toEqual([{ id, name: 'Bar Azul', color: PAYER_PALETTE[0] }])
    expect(out.jobs.map((j) => [j.payerId, j.payerName])).toEqual([
      [id, undefined],
      [id, undefined],
      [undefined, 'Outro'],
    ])
  })

  it('arquiva um método em uso', () => {
    const data = mkData({ jobs: [mkJob({ installments: [mkInst({ receivedDate: '2026-10-01', methodId: 'revolut' })] })] })
    expect(removeMethod(data, 'revolut').methods.find((m) => m.id === 'revolut')!.archived).toBe(true)
    expect(removeMethod(data, 'dinheiro').methods.find((m) => m.id === 'dinheiro')).toBeUndefined()
  })
})

describe('obrigações', () => {
  const withRules = () => mkData({ obligationRules: defaultObligationRules('2026-10-06', newId) })

  it('marca como feito, anula e altera a data', () => {
    let data = withRules()
    const ss = data.obligationRules[0]!
    data = markOccurrence(data, ss.id, '2026-10-20', 'done', { date: '2026-10-12', amountPaid: 12000 })
    expect(data.obligationRecords).toEqual([
      { ruleId: ss.id, originalDate: '2026-10-20', status: 'done', date: '2026-10-12', amountPaid: 12000 },
    ])
    data = setOccurrenceDueDate(data, ss.id, '2026-10-20', '2026-10-22')
    expect(data.obligationRecords[0]).toMatchObject({ status: 'done', dueDateOverride: '2026-10-22' })
    data = unmarkOccurrence(data, ss.id, '2026-10-20')
    expect(data.obligationRecords).toEqual([{ ruleId: ss.id, originalDate: '2026-10-20', dueDateOverride: '2026-10-22' }])
    data = setOccurrenceDueDate(data, ss.id, '2026-10-20', undefined)
    expect(data.obligationRecords).toEqual([])
  })

  it('apaga uma regra sem histórico; com histórico, só a desativa', () => {
    let data = withRules()
    const [ss, tri] = data.obligationRules
    data = markOccurrence(data, ss!.id, '2026-10-20', 'done', { date: '2026-10-12' })
    data = removeObligationRule(data, ss!.id)
    expect(data.obligationRules.find((r) => r.id === ss!.id)!.active).toBe(false)
    data = removeObligationRule(data, tri!.id)
    expect(data.obligationRules.find((r) => r.id === tri!.id)).toBeUndefined()
  })
})
