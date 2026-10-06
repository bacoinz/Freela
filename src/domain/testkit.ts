// Utilitários só para testes: criar objetos do domínio com valores por defeito.
import type { AppData, Installment, Job, OpsContext, RecurringIncome } from './types'

let seq = 0
export function resetIds() {
  seq = 0
}
export const newId = () => `id${++seq}`

export function mkCtx(today = '2026-10-06'): OpsContext {
  return { newId, nowISO: () => `${today}T12:00:00.000Z`, today }
}

export function mkInst(p: Partial<Installment> = {}): Installment {
  return { id: newId(), amount: 10000, ...p }
}

export function mkJob(p: Partial<Job> = {}): Job {
  return {
    id: newId(),
    title: 'Concerto',
    categoryId: 'cat-musica',
    payerName: 'Bar X',
    workDate: '2026-10-01',
    investPct: 15,
    installments: [mkInst()],
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...p,
  }
}

export function mkData(p: Partial<AppData> = {}): AppData {
  return {
    schemaVersion: 1,
    jobs: [],
    recurring: [],
    obligationRules: [],
    obligationRecords: [],
    categories: [
      { id: 'cat-musica', name: 'Música', color: '#8b5cf6' },
      { id: 'cat-outro', name: 'Outro', color: '#64748b' },
    ],
    payers: [],
    methods: [
      { id: 'transf', name: 'Transferência bancária' },
      { id: 'mbway', name: 'MB WAY' },
      { id: 'revolut', name: 'Revolut' },
      { id: 'dinheiro', name: 'Dinheiro' },
    ],
    settings: {
      investPct: 15,
      overdueDays: 30,
      remindersEnabled: true,
      reminderHour: 10,
      calendarColorMode: 'status',
      lockEnabled: false,
    },
    ...p,
  }
}

export function mkRecurring(p: Partial<RecurringIncome> = {}): RecurringIncome {
  return {
    id: 'rec1',
    title: 'Aulas — Escola de Música X',
    categoryId: 'cat-musica',
    payerId: 'p-escola',
    amount: 60000,
    dayOfMonth: 5,
    methodId: 'transf',
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    startPeriod: '2026-10',
    skippedPeriods: [],
    active: true,
    ...p,
  }
}
