import { beforeEach, describe, expect, it } from 'vitest'
import { defaultObligationRules } from './obligations'
import { planReminders } from './reminders'
import { mkData, mkInst, mkJob, newId, resetIds } from './testkit'
import type { AppData } from './types'

beforeEach(() => resetIds())

const TODAY = '2026-10-06'
const at = (iso: string, h: number, m = 0) => {
  const [y, mo, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(y, mo - 1, d, h, m)
}

function dataWithDefaults(p: Partial<AppData> = {}): AppData {
  return mkData({ obligationRules: defaultObligationRules(TODAY, newId), ...p })
}

describe('planReminders', () => {
  it('não planeia nada com os lembretes desligados', () => {
    const data = dataWithDefaults()
    data.settings.remindersEnabled = false
    expect(planReminders(data, at(TODAY, 9))).toEqual([])
  })

  it('junta as regras das obrigações, uma notificação por dia, à hora definida', () => {
    const out = planReminders(dataWithDefaults(), at(TODAY, 9), 20)
    expect(out.map((n) => n.date)).toEqual([
      '2026-10-06', // trimestral (5 em 5 desde dia 1)
      '2026-10-10', // SS
      '2026-10-11', // trimestral
      '2026-10-15', // SS
      '2026-10-16', // trimestral
      '2026-10-21',
      '2026-10-26',
    ])
    expect(out[0]!.at).toEqual(at(TODAY, 10))
    expect(out[0]!.id).toBe(20261006)
    expect(out[1]!.title).toBe('Pagar Segurança Social')
    expect(out[1]!.body).toContain('20 out')
    expect(out[1]!.route).toBe('/obrigacoes')
  })

  it('não inclui o dia de hoje se a hora já passou', () => {
    const out = planReminders(dataWithDefaults(), at(TODAY, 11), 20)
    expect(out[0]!.date).toBe('2026-10-10')
  })

  it('para de lembrar quando a obrigação é marcada como feita', () => {
    const data = dataWithDefaults()
    const ss = data.obligationRules.find((r) => r.template === 'ss-pagamento')!
    data.obligationRecords.push({ ruleId: ss.id, originalDate: '2026-10-20', status: 'done', date: '2026-10-08' })
    const out = planReminders(data, at(TODAY, 9), 20)
    expect(out.map((n) => n.date)).not.toContain('2026-10-10')
    expect(out.map((n) => n.date)).not.toContain('2026-10-15')
  })

  it('a declaração trimestral continua depois do prazo até estar feita', () => {
    const out = planReminders(dataWithDefaults(), at(TODAY, 9), 40)
    const dates = out.map((n) => n.date)
    expect(dates).toContain('2026-10-31')
    expect(dates).toContain('2026-11-05')
    expect(dates).toContain('2026-11-15')
  })

  it('pagamento em atraso: aviso no dia seguinte à data prevista e resumo às segundas', () => {
    const job = mkJob({
      title: 'Casamento Silva',
      payerName: 'Família Silva',
      installments: [mkInst({ amount: 22500, dueDate: '2026-10-08' })],
    })
    const data = mkData({ jobs: [job] })
    const out = planReminders(data, at(TODAY, 9), 20)
    expect(out.map((n) => n.date)).toEqual(['2026-10-09', '2026-10-12', '2026-10-19', '2026-10-26'])
    expect(out[0]!.title).toBe('Pagamento em atraso')
    expect(out[0]!.body).toContain('Casamento Silva')
    expect(out[0]!.body).toContain('225,00')
    expect(out[0]!.route).toBe('/trabalhos')
  })

  it('agrupa num só dia obrigações e pagamentos em atraso', () => {
    const job = mkJob({ title: 'Gravação', installments: [mkInst({ amount: 10000, dueDate: '2026-10-09' })] })
    const out = planReminders(dataWithDefaults({ jobs: [job] }), at(TODAY, 9), 10)
    const day = out.find((n) => n.date === '2026-10-10')! // SS + 1.º aviso do atraso
    expect(day.items).toHaveLength(2)
    expect(day.title).toBe('2 lembretes para hoje')
    expect(day.body).toContain('Segurança Social')
    expect(day.body).toContain('Gravação')
    expect(day.route).toBe('/')
  })

  it('não lembra pagamentos já recebidos', () => {
    const job = mkJob({ installments: [mkInst({ dueDate: '2026-10-01', receivedDate: '2026-10-02', methodId: 'mbway' })] })
    expect(planReminders(mkData({ jobs: [job] }), at(TODAY, 9), 30)).toEqual([])
  })
})
