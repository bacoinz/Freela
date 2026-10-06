import { describe, expect, it } from 'vitest'
import { defaultObligationRules } from '../../domain/obligations'
import { ruleToForm, formToRule } from './ruleForm'

let n = 0
const rules = defaultObligationRules('2026-10-06', () => `r${++n}`)
const t = (tpl: string) => rules.find((r) => r.template === tpl)!

describe('ruleToForm / formToRule', () => {
  it.each(['ss-pagamento', 'ss-declaracao-trimestral', 'efatura', 'irs-entrega', 'irs-pagamento', 'irs-pagamentos-conta'])(
    'o modelo %s volta igual depois de passar pelo formulário',
    (tpl) => {
      const rule = t(tpl)
      const out = formToRule(ruleToForm(rule, '2026-10-06'))
      expect(out).toEqual({ schedule: rule.schedule, reminders: rule.reminders })
    },
  )

  it('um prazo novo começa como anual, com lembrete semanal até ao prazo', () => {
    const f = ruleToForm(undefined, '2026-10-06')
    expect(f).toMatchObject({ title: '', kind: 'pagamento', schedType: 'yearly', remType: 'repeat', until: 'due', active: true })
    expect(formToRule(f)).toEqual({
      schedule: { type: 'yearly', month: 1, day: 20 },
      reminders: { type: 'repeat', everyDays: 7, from: { type: 'daysBefore', days: 7 }, until: 'due', onDueDay: true },
    })
  })

  it('lê os dias dos lembretes escritos à mão', () => {
    const f = { ...ruleToForm(t('ss-pagamento'), '2026-10-06'), days: '15; 10 , 15' }
    expect(formToRule(f)).toMatchObject({ reminders: { type: 'daysOfMonth', days: [10, 15] } })
  })

  it('devolve mensagens de erro claras', () => {
    const base = ruleToForm(t('ss-pagamento'), '2026-10-06')
    expect(formToRule({ ...base, days: 'dez' })).toMatch(/dias dos lembretes/)
    expect(formToRule({ ...base, days: '40' })).toMatch(/dias dos lembretes/)
    const months = ruleToForm(t('ss-declaracao-trimestral'), '2026-10-06')
    expect(formToRule({ ...months, months: [] })).toMatch(/pelo menos um mês/)
    const rep = ruleToForm(t('irs-entrega'), '2026-10-06')
    expect(formToRule({ ...rep, everyDays: '0' })).toMatch(/intervalo/)
    expect(formToRule({ ...rep, fromDay: '32' })).toMatch(/dia de início/)
  })
})
