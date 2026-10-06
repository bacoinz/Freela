import { beforeEach, describe, expect, it } from 'vitest'
import { defaultObligationRules } from './obligations'
import {
  addCategory,
  addMethod,
  removeCategory,
  removeRecurring,
  updateCategory,
  updateMethod,
  updatePayer,
  updateSettings,
  upsertObligationRule,
} from './ops'
import { mkCtx, mkData, mkJob, mkRecurring, newId, resetIds } from './testkit'

beforeEach(() => resetIds())
const ctx = () => mkCtx('2026-10-06')

describe('updatePayer', () => {
  it('muda nome e cor, e pode desarquivar', () => {
    const data = mkData({ payers: [{ id: 'p1', name: 'A', color: '#1', archived: true }] })
    const out = updatePayer(data, 'p1', { name: '  Hot   Clube ', color: '#2', archived: false })
    expect(out.payers).toEqual([{ id: 'p1', name: 'Hot Clube', color: '#2' }])
  })

  it('não deixa o nome vazio', () => {
    const data = mkData({ payers: [{ id: 'p1', name: 'A', color: '#1' }] })
    expect(() => updatePayer(data, 'p1', { name: ' ' })).toThrow(/nome/)
  })
})

describe('categorias', () => {
  it('cria, altera e remove (arquiva se estiver em uso)', () => {
    const { data, id } = addCategory(mkData(), ' Aulas ', '#0ea5e9', ctx())
    expect(data.categories.at(-1)).toEqual({ id, name: 'Aulas', color: '#0ea5e9' })
    const renamed = updateCategory(data, id, { name: 'Aulas particulares' })
    expect(renamed.categories.at(-1)!.name).toBe('Aulas particulares')
    expect(removeCategory(renamed, id).categories.some((c) => c.id === id)).toBe(false)
    const used = { ...renamed, jobs: [mkJob({ categoryId: id })] }
    expect(removeCategory(used, id).categories.find((c) => c.id === id)!.archived).toBe(true)
  })

  it('não deixa remover a última categoria ativa', () => {
    const data = mkData({ categories: [{ id: 'c1', name: 'Música', color: '#1' }] })
    expect(() => removeCategory(data, 'c1')).toThrow(/pelo menos uma/)
  })
})

describe('métodos', () => {
  it('cria e altera', () => {
    const { data, id } = addMethod(mkData(), 'PayPal', ctx())
    expect(data.methods.at(-1)).toEqual({ id, name: 'PayPal' })
    expect(updateMethod(data, id, { name: 'PayPal (pessoal)' }).methods.at(-1)!.name).toBe('PayPal (pessoal)')
    expect(() => addMethod(mkData(), '  ', ctx())).toThrow(/nome/)
  })
})

describe('removeRecurring', () => {
  it('apaga o rendimento fixo mas mantém os trabalhos já criados', () => {
    const data = mkData({ recurring: [mkRecurring()], jobs: [mkJob({ recurringId: 'rec1', period: '2026-10' })] })
    const out = removeRecurring(data, 'rec1')
    expect(out.recurring).toEqual([])
    expect(out.jobs).toHaveLength(1)
  })
})

describe('upsertObligationRule', () => {
  it('cria um prazo personalizado e atualiza um existente', () => {
    const data = mkData({ obligationRules: defaultObligationRules('2026-10-06', newId) })
    const { data: d1, id } = upsertObligationRule(
      data,
      {
        title: 'Seguro do instrumento',
        kind: 'pagamento',
        schedule: { type: 'yearly', month: 3, day: 15 },
        reminders: { type: 'repeat', everyDays: 7, from: { type: 'daysBefore', days: 14 }, until: 'due', onDueDay: true },
        active: true,
        startDate: '2026-10-06',
      },
      ctx(),
    )
    expect(d1.obligationRules).toHaveLength(7)
    const ss = d1.obligationRules[0]!
    const d2 = upsertObligationRule(d1, { ...ss, reminders: { type: 'daysOfMonth', days: [12, 18] } }, ctx())
    expect(d2.id).toBe(ss.id)
    expect(d2.data.obligationRules[0]!.reminders).toEqual({ type: 'daysOfMonth', days: [12, 18] })
    expect(d2.data.obligationRules.find((r) => r.id === id)!.title).toBe('Seguro do instrumento')
  })

  it('não aceita título vazio', () => {
    const rule = defaultObligationRules('2026-10-06', newId)[0]!
    expect(() => upsertObligationRule(mkData(), { ...rule, title: ' ' }, ctx())).toThrow(/descrição/)
  })
})

describe('updateSettings', () => {
  it('altera definições validando os valores', () => {
    const out = updateSettings(mkData(), { investPct: 20, reminderHour: 9 })
    expect(out.settings).toMatchObject({ investPct: 20, reminderHour: 9, overdueDays: 30 })
    expect(() => updateSettings(mkData(), { investPct: 120 })).toThrow(/0 e 100/)
    expect(() => updateSettings(mkData(), { reminderHour: 24 })).toThrow(/hora/)
    expect(() => updateSettings(mkData(), { overdueDays: -1 })).toThrow(/dias/)
  })
})
