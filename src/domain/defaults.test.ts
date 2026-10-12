import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultData } from './defaults'
import { defaultPlan } from './invest'
import { mkCtx, resetIds } from './testkit'

beforeEach(() => resetIds())

describe('createDefaultData', () => {
  it('traz categorias, métodos, prazos do Estado e definições por defeito', () => {
    const d = createDefaultData(mkCtx('2026-10-06'))
    expect(d.schemaVersion).toBe(1)
    expect(d.categories.map((c) => c.name)).toEqual(['Música', 'Outro'])
    expect(d.methods.map((m) => m.name)).toEqual(['Transferência bancária', 'MB WAY', 'Revolut', 'Dinheiro'])
    expect(d.obligationRules).toHaveLength(6)
    expect(d.obligationRules.every((r) => r.startDate === '2026-10-06')).toBe(true)
    expect(d.jobs).toEqual([])
    expect(d.payers).toEqual([])
    expect(d.recurring).toEqual([])
    expect(d.settings.investPlans).toEqual([defaultPlan(15)])
    expect(d.settings).toMatchObject({
      overdueDays: 30,
      remindersEnabled: true,
      reminderHour: 10,
      calendarColorMode: 'status',
      lockEnabled: false,
    })
  })

  it('os ids são únicos', () => {
    const d = createDefaultData(mkCtx())
    const ids = [...d.categories, ...d.methods, ...d.obligationRules].map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
