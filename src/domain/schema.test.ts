import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultData } from './defaults'
import { makeBackup, parseAppData } from './schema'
import { mkCtx, mkInst, mkJob, mkRecurring, resetIds } from './testkit'

beforeEach(() => resetIds())

function sample() {
  const d = createDefaultData(mkCtx('2026-10-06'))
  d.payers.push({ id: 'p1', name: 'Hot Clube', color: '#6366f1' })
  d.jobs.push(
    mkJob({
      payerId: 'p1',
      payerName: undefined,
      notes: 'Levar baixo',
      installments: [mkInst({ amount: 22500, receivedDate: '2026-10-02', methodId: d.methods[1]!.id }), mkInst({ amount: 22500, dueDate: '2026-11-01' })],
    }),
  )
  d.obligationRecords.push({ ruleId: d.obligationRules[0]!.id, originalDate: '2026-10-20', status: 'done', date: '2026-10-12', amountPaid: 12000 })
  return d
}

describe('parseAppData', () => {
  it('aceita dados válidos sem os alterar', () => {
    const d = sample()
    expect(parseAppData(JSON.parse(JSON.stringify(d)))).toEqual(d)
  })

  it('guarda o mês do pagamento dos rendimentos fixos (e aceita dados antigos sem ele)', () => {
    const d = sample()
    d.recurring.push(mkRecurring({ payerId: 'p1', payMonth: 'next' }), mkRecurring({ id: 'rec2', payerId: 'p1' }))
    const back = parseAppData(JSON.parse(JSON.stringify(d)))
    expect(back.recurring.map((r) => r.payMonth)).toEqual(['next', undefined])
  })

  it('aceita o formato de cópia de segurança exportado', () => {
    const d = sample()
    const backup = JSON.parse(JSON.stringify(makeBackup(d, '2026-10-06T12:00:00.000Z')))
    expect(backup.app).toBe('freela')
    expect(parseAppData(backup)).toEqual(d)
  })

  it('aceita cópias antigas (de quando a app se chamava "Ganhos")', () => {
    const d = sample()
    const old = JSON.parse(JSON.stringify({ app: 'ganhos', schemaVersion: 1, exportedAt: '2026-10-06T12:00:00.000Z', data: d }))
    expect(parseAppData(old)).toEqual(d)
  })

  it('completa definições em falta com os valores por defeito', () => {
    const d = JSON.parse(JSON.stringify(sample()))
    delete d.settings.calendarColorMode
    delete d.settings.reminderHour
    const out = parseAppData(d)
    expect(out.settings.calendarColorMode).toBe('status')
    expect(out.settings.reminderHour).toBe(10)
  })

  it('rejeita ficheiros que não são da app', () => {
    expect(() => parseAppData({ foo: 1 })).toThrow(/não parece ser uma cópia de segurança da app Freela/)
    expect(() => parseAppData(null)).toThrow(/não parece ser uma cópia de segurança/)
  })

  it('rejeita dados estragados com uma mensagem clara', () => {
    const d = JSON.parse(JSON.stringify(sample()))
    d.jobs[0].installments[0].amount = 'muito'
    expect(() => parseAppData(d)).toThrow(/ficheiro tem dados inválidos/)
    const d2 = JSON.parse(JSON.stringify(sample()))
    d2.jobs[0].workDate = '06/10/2026'
    expect(() => parseAppData(d2)).toThrow(/ficheiro tem dados inválidos/)
  })

  it('rejeita versões mais recentes da app', () => {
    const d = JSON.parse(JSON.stringify(sample()))
    d.schemaVersion = 99
    expect(() => parseAppData(d)).toThrow(/versão mais recente/)
  })
})
