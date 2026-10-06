import { describe, expect, it } from 'vitest'
import { defaultObligationRules } from '../../domain/obligations'
import { installmentLabel, monthsText, reminderText, scheduleText } from './texts'

let n = 0
const rules = () => defaultObligationRules('2026-10-06', () => `r${++n}`)
const t = (tpl: string) => rules().find((r) => r.template === tpl)!

describe('monthsText', () => {
  it('descreve os meses ativos', () => {
    expect(monthsText([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe('todos os meses')
    expect(monthsText([9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7])).toBe('set–jul')
    expect(monthsText([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12])).toBe('set–jul')
    expect(monthsText([1, 4, 7, 10])).toBe('jan, abr, jul, out')
    expect(monthsText([3, 4, 5])).toBe('mar–mai')
    expect(monthsText([])).toBe('nenhum mês')
  })
})

describe('scheduleText', () => {
  it('descreve quando é o prazo', () => {
    expect(scheduleText(t('ss-pagamento').schedule)).toBe('Todos os meses, dia 20')
    expect(scheduleText(t('ss-declaracao-trimestral').schedule)).toBe('Último dia de jan, abr, jul, out')
    expect(scheduleText(t('efatura').schedule)).toBe('Todos os anos, último dia de fevereiro')
    expect(scheduleText(t('irs-entrega').schedule)).toBe('Todos os anos, 30 de junho')
    expect(scheduleText({ type: 'once', date: '2026-11-03' })).toBe('Só uma vez, 3 de novembro de 2026')
  })
})

describe('reminderText', () => {
  it('descreve as regras de lembrete', () => {
    expect(reminderText(t('ss-pagamento'))).toBe('Nos dias 10 e 15 do mês')
    expect(reminderText(t('ss-declaracao-trimestral'))).toBe('De 5 em 5 dias desde o início do mês, até marcares como feito')
    expect(reminderText(t('efatura'))).toBe('De 5 em 5 dias desde o início do mês, até ao prazo')
    expect(reminderText(t('irs-entrega'))).toBe('Todas as semanas desde 1 de abril, até ao prazo')
    expect(reminderText(t('irs-pagamento'))).toBe('Todas as semanas desde o início do mês, até ao prazo e no próprio dia')
    expect(reminderText(t('irs-pagamentos-conta'))).toBe('Todas as semanas desde 7 dias antes, até ao prazo e no próprio dia')
  })
})

describe('installmentLabel', () => {
  it('nomeia as prestações', () => {
    expect(installmentLabel(0, 1)).toBe('Pagamento')
    expect(installmentLabel(0, 2)).toBe('1.ª prestação (início)')
    expect(installmentLabel(1, 2)).toBe('2.ª prestação (fim)')
    expect(installmentLabel(2, 4)).toBe('3.ª prestação')
  })
})
