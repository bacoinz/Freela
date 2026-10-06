import { defaultObligationRules } from './obligations'
import type { AppData, OpsContext, Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  investPct: 15,
  overdueDays: 30,
  remindersEnabled: true,
  reminderHour: 10,
  calendarColorMode: 'status',
  lockEnabled: false,
}

export const CATEGORY_COLORS = ['#8b5cf6', '#64748b', '#0ea5e9', '#f97316', '#10b981', '#ec4899']

/** Dados iniciais da app (primeira utilização). */
export function createDefaultData(ctx: OpsContext): AppData {
  return {
    schemaVersion: 1,
    jobs: [],
    recurring: [],
    obligationRules: defaultObligationRules(ctx.today, ctx.newId),
    obligationRecords: [],
    categories: [
      { id: ctx.newId(), name: 'Música', color: CATEGORY_COLORS[0]! },
      { id: ctx.newId(), name: 'Outro', color: CATEGORY_COLORS[1]! },
    ],
    payers: [],
    methods: ['Transferência bancária', 'MB WAY', 'Revolut', 'Dinheiro'].map((name) => ({ id: ctx.newId(), name })),
    settings: { ...DEFAULT_SETTINGS },
  }
}
