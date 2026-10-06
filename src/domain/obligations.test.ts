import { beforeEach, describe, expect, it } from 'vitest'
import {
  actionLabel,
  defaultObligationRules,
  listOccurrences,
  reminderDates,
  scheduleDatesBetween,
  type Occurrence,
} from './obligations'
import { mkData, newId, resetIds } from './testkit'
import type { ObligationRule } from './types'

beforeEach(() => resetIds())

const TODAY = '2026-10-06'
const rules = () => defaultObligationRules(TODAY, newId)
const byTemplate = (t: string) => rules().find((r) => r.template === t)!

/** Ocorrência simples para testar lembretes. */
function occ(rule: ObligationRule, originalDate: string, extra: Partial<Occurrence> = {}): Occurrence {
  return { rule, originalDate, dueDate: originalDate, state: 'upcoming', ...extra }
}

describe('modelos pré-carregados', () => {
  it('tem os 6 prazos, com os pagamentos por conta desligados', () => {
    const r = rules()
    expect(r.map((x) => [x.template, x.active])).toEqual([
      ['ss-pagamento', true],
      ['ss-declaracao-trimestral', true],
      ['efatura', true],
      ['irs-entrega', true],
      ['irs-pagamento', true],
      ['irs-pagamentos-conta', false],
    ])
    expect(r.every((x) => x.startDate === TODAY)).toBe(true)
  })
})

describe('scheduleDatesBetween', () => {
  it('SS: dia 20 de cada mês', () => {
    expect(scheduleDatesBetween(byTemplate('ss-pagamento').schedule, '2026-10-01', '2026-12-31')).toEqual([
      '2026-10-20',
      '2026-11-20',
      '2026-12-20',
    ])
  })

  it('declaração trimestral: último dia de janeiro, abril, julho e outubro', () => {
    expect(scheduleDatesBetween(byTemplate('ss-declaracao-trimestral').schedule, '2026-10-01', '2027-07-31')).toEqual([
      '2026-10-31',
      '2027-01-31',
      '2027-04-30',
      '2027-07-31',
    ])
  })

  it('e-Fatura: último dia de fevereiro (incluindo anos bissextos)', () => {
    expect(scheduleDatesBetween(byTemplate('efatura').schedule, '2027-01-01', '2028-12-31')).toEqual([
      '2027-02-28',
      '2028-02-29',
    ])
  })

  it('IRS: entrega a 30 de junho e pagamento a 31 de agosto', () => {
    expect(scheduleDatesBetween(byTemplate('irs-entrega').schedule, '2027-01-01', '2027-12-31')).toEqual(['2027-06-30'])
    expect(scheduleDatesBetween(byTemplate('irs-pagamento').schedule, '2027-01-01', '2027-12-31')).toEqual(['2027-08-31'])
  })

  it('pagamentos por conta: 20 de julho, setembro e dezembro', () => {
    expect(scheduleDatesBetween(byTemplate('irs-pagamentos-conta').schedule, '2027-01-01', '2027-12-31')).toEqual([
      '2027-07-20',
      '2027-09-20',
      '2027-12-20',
    ])
  })

  it('prazo único', () => {
    expect(scheduleDatesBetween({ type: 'once', date: '2026-11-03' }, '2026-10-01', '2026-12-31')).toEqual(['2026-11-03'])
    expect(scheduleDatesBetween({ type: 'once', date: '2027-11-03' }, '2026-10-01', '2026-12-31')).toEqual([])
  })
})

describe('listOccurrences', () => {
  it('ignora ocorrências antes da data de início e regras desligadas', () => {
    const data = mkData({ obligationRules: rules() })
    const out = listOccurrences(data, '2026-01-01', '2026-12-31', TODAY)
    expect(out.map((o) => `${o.rule.template}@${o.dueDate}`)).toEqual([
      'ss-pagamento@2026-10-20',
      'ss-declaracao-trimestral@2026-10-31',
      'ss-pagamento@2026-11-20',
      'ss-pagamento@2026-12-20',
    ])
    expect(out.every((o) => o.state === 'upcoming')).toBe(true)
  })

  it('aplica o registo: feito, não se aplica e data alterada', () => {
    const r = rules()
    const ss = r.find((x) => x.template === 'ss-pagamento')!
    const tri = r.find((x) => x.template === 'ss-declaracao-trimestral')!
    const data = mkData({
      obligationRules: r,
      obligationRecords: [
        { ruleId: ss.id, originalDate: '2026-10-20', status: 'done', date: '2026-10-12', amountPaid: 12000 },
        { ruleId: ss.id, originalDate: '2026-11-20', status: 'notApplicable' },
        { ruleId: tri.id, originalDate: '2026-10-31', dueDateOverride: '2026-11-15' },
      ],
    })
    const out = listOccurrences(data, '2026-10-01', '2026-11-30', TODAY)
    expect(out.map((o) => `${o.rule.template}@${o.dueDate}:${o.state}`)).toEqual([
      'ss-pagamento@2026-10-20:done',
      'ss-declaracao-trimestral@2026-11-15:upcoming',
      'ss-pagamento@2026-11-20:notApplicable',
    ])
    expect(out[0]!.record?.amountPaid).toBe(12000)
  })

  it('marca como atrasada ou hoje', () => {
    const r = rules()
    const data = mkData({ obligationRules: r.map((x) => ({ ...x, startDate: '2026-01-01' })) })
    const out = listOccurrences(data, '2026-09-01', '2026-10-31', '2026-10-20')
    const states = Object.fromEntries(out.map((o) => [`${o.rule.template}@${o.dueDate}`, o.state]))
    expect(states['ss-pagamento@2026-09-20']).toBe('overdue')
    expect(states['ss-pagamento@2026-10-20']).toBe('today')
    expect(states['ss-declaracao-trimestral@2026-10-31']).toBe('upcoming')
  })
})

describe('reminderDates — as regras pedidas', () => {
  it('SS: lembra nos dias 10 e 15 do mês', () => {
    expect(reminderDates(occ(byTemplate('ss-pagamento'), '2026-10-20'), TODAY, '2026-12-31')).toEqual([
      '2026-10-10',
      '2026-10-15',
    ])
  })

  it('não lembra ocorrências feitas ou que não se aplicam', () => {
    const ss = byTemplate('ss-pagamento')
    expect(reminderDates(occ(ss, '2026-10-20', { state: 'done' }), TODAY, '2026-12-31')).toEqual([])
    expect(reminderDates(occ(ss, '2026-10-20', { state: 'notApplicable' }), TODAY, '2026-12-31')).toEqual([])
  })

  it('declaração trimestral: de 5 em 5 dias desde o dia 1, continua depois do prazo até estar feita', () => {
    const out = reminderDates(occ(byTemplate('ss-declaracao-trimestral'), '2026-10-31'), TODAY, '2026-11-20')
    expect(out).toEqual(['2026-10-06', '2026-10-11', '2026-10-16', '2026-10-21', '2026-10-26', '2026-10-31', '2026-11-05', '2026-11-10', '2026-11-15', '2026-11-20'])
  })

  it('e-Fatura: de 5 em 5 dias só durante fevereiro', () => {
    const out = reminderDates(occ(byTemplate('efatura'), '2027-02-28'), '2027-01-01', '2027-04-30')
    expect(out).toEqual(['2027-02-01', '2027-02-06', '2027-02-11', '2027-02-16', '2027-02-21', '2027-02-26'])
  })

  it('e-Fatura com prazo prorrogado: começa em fevereiro e acaba no novo prazo', () => {
    const out = reminderDates(
      occ(byTemplate('efatura'), '2027-02-28', { dueDate: '2027-03-10' }),
      '2027-01-01',
      '2027-04-30',
    )
    expect(out).toEqual(['2027-02-01', '2027-02-06', '2027-02-11', '2027-02-16', '2027-02-21', '2027-02-26', '2027-03-03', '2027-03-08'])
  })

  it('entrega do IRS: 1 vez por semana de 1 de abril até 30 de junho', () => {
    const out = reminderDates(occ(byTemplate('irs-entrega'), '2027-06-30'), '2027-01-01', '2027-12-31')
    expect(out[0]).toBe('2027-04-01')
    expect(out[1]).toBe('2027-04-08')
    expect(out.at(-1)).toBe('2027-06-24')
    expect(out).toHaveLength(13)
  })

  it('pagamento do IRS: 1 vez por semana desde 1 de agosto e no próprio dia', () => {
    const out = reminderDates(occ(byTemplate('irs-pagamento'), '2027-08-31'), '2027-01-01', '2027-12-31')
    expect(out).toEqual(['2027-08-01', '2027-08-08', '2027-08-15', '2027-08-22', '2027-08-29', '2027-08-31'])
  })

  it('pagamentos por conta: 7 dias antes e no dia (sem repetir)', () => {
    const out = reminderDates(occ(byTemplate('irs-pagamentos-conta'), '2027-07-20'), '2027-01-01', '2027-12-31')
    expect(out).toEqual(['2027-07-13', '2027-07-20'])
  })

  it('só devolve datas dentro da janela', () => {
    const out = reminderDates(occ(byTemplate('irs-pagamento'), '2027-08-31'), '2027-08-10', '2027-08-30')
    expect(out).toEqual(['2027-08-15', '2027-08-22', '2027-08-29'])
  })
})

describe('actionLabel', () => {
  it('muda o botão conforme o tipo', () => {
    expect(actionLabel('pagamento')).toBe('Pago')
    expect(actionLabel('declaracao')).toBe('Entregue')
    expect(actionLabel('outro')).toBe('Feito')
  })
})
