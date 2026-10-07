import { z } from 'zod'
import type { AppData } from './types'

/** Versão atual do formato dos dados. */
export const SCHEMA_VERSION = 1

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data inválida')
const period = z.string().regex(/^\d{4}-\d{2}$/, 'mês inválido')
const cents = z.number().int().min(0)
const id = z.string().min(1)
const month = z.number().int().min(1).max(12)
const dayOfMonth = z.union([z.number().int().min(1).max(31), z.literal('last')])

const named = z.object({ id, name: z.string(), color: z.string(), archived: z.boolean().optional() })
const method = z.object({ id, name: z.string(), archived: z.boolean().optional() })

const installment = z.object({
  id,
  amount: cents,
  dueDate: isoDate.optional(),
  expectedMethodId: z.string().optional(),
  receivedDate: isoDate.optional(),
  methodId: z.string().optional(),
})

const job = z.object({
  id,
  title: z.string(),
  categoryId: z.string(),
  payerId: z.string().optional(),
  payerName: z.string().optional(),
  workDate: isoDate,
  investPct: z.number().min(0).max(100),
  notes: z.string().optional(),
  installments: z.array(installment),
  recurringId: z.string().optional(),
  period: period.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const recurring = z.object({
  id,
  title: z.string(),
  categoryId: z.string(),
  payerId: z.string(),
  amount: cents,
  dayOfMonth: z.number().int().min(1).max(31),
  payMonth: z.enum(['same', 'next']).optional(),
  methodId: z.string().optional(),
  investPct: z.number().min(0).max(100).optional(),
  months: z.array(month),
  startPeriod: period,
  skippedPeriods: z.array(period),
  active: z.boolean(),
})

const schedule = z.discriminatedUnion('type', [
  z.object({ type: z.literal('monthly'), day: dayOfMonth }),
  z.object({ type: z.literal('months'), months: z.array(month), day: dayOfMonth }),
  z.object({ type: z.literal('yearly'), month, day: dayOfMonth }),
  z.object({ type: z.literal('once'), date: isoDate }),
])

const reminderStart = z.discriminatedUnion('type', [
  z.object({ type: z.literal('dueMonthStart') }),
  z.object({ type: z.literal('fixedDate'), month, day: z.number().int().min(1).max(31) }),
  z.object({ type: z.literal('daysBefore'), days: z.number().int().min(0) }),
])

const reminderRule = z.discriminatedUnion('type', [
  z.object({ type: z.literal('daysOfMonth'), days: z.array(z.number().int().min(1).max(31)) }),
  z.object({
    type: z.literal('repeat'),
    everyDays: z.number().int().min(1),
    from: reminderStart,
    until: z.enum(['due', 'done']),
    onDueDay: z.boolean(),
  }),
])

const obligationRule = z.object({
  id,
  title: z.string(),
  kind: z.enum(['pagamento', 'declaracao', 'outro']),
  schedule,
  reminders: reminderRule,
  defaultAmount: cents.optional(),
  active: z.boolean(),
  startDate: isoDate,
  template: z.string().optional(),
  notes: z.string().optional(),
})

const obligationRecord = z.object({
  ruleId: z.string(),
  originalDate: isoDate,
  dueDateOverride: isoDate.optional(),
  status: z.enum(['done', 'notApplicable']).optional(),
  date: isoDate.optional(),
  amountPaid: cents.optional(),
  notes: z.string().optional(),
})

const settings = z
  .object({
    investPct: z.number().min(0).max(100).default(15),
    overdueDays: z.number().int().min(0).default(30),
    remindersEnabled: z.boolean().default(true),
    reminderHour: z.number().int().min(0).max(23).default(10),
    calendarColorMode: z.enum(['status', 'payer']).default('status'),
    lockEnabled: z.boolean().default(false),
    lockInitialized: z.boolean().optional(),
    lastAutoBackupDate: isoDate.optional(),
    lastExportAt: z.string().optional(),
    lastChangeAt: z.string().optional(),
  })
  .prefault({})

const appData = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  jobs: z.array(job),
  recurring: z.array(recurring).default([]),
  obligationRules: z.array(obligationRule).default([]),
  obligationRecords: z.array(obligationRecord).default([]),
  categories: z.array(named),
  payers: z.array(named).default([]),
  methods: z.array(method),
  settings,
})

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** Migra dados de versões antigas para a atual (por agora só existe a v1). */
function migrate(obj: Record<string, unknown>): Record<string, unknown> {
  return obj
}

/** Marcas aceites no ficheiro de cópia ('ganhos' era o nome antigo da app). */
const BACKUP_MARKS = new Set(['freela', 'ganhos'])

/**
 * Valida (e migra) dados lidos do armazenamento ou de um ficheiro importado.
 * Aceita os dados diretos ou o formato de cópia de segurança `{ app: 'freela', data }`.
 */
export function parseAppData(raw: unknown): AppData {
  let obj = raw
  if (isObject(obj) && typeof obj.app === 'string' && BACKUP_MARKS.has(obj.app) && 'data' in obj) obj = obj.data
  if (!isObject(obj) || !('schemaVersion' in obj) || !('jobs' in obj)) {
    throw new Error('Este ficheiro não parece ser uma cópia de segurança da app Freela.')
  }
  if (typeof obj.schemaVersion === 'number' && obj.schemaVersion > SCHEMA_VERSION) {
    throw new Error('Este ficheiro foi criado por uma versão mais recente da app. Atualiza a app primeiro.')
  }
  const result = appData.safeParse(migrate(obj))
  if (!result.success) {
    const issue = result.error.issues[0]
    const where = issue ? `${issue.path.join('.')}: ${issue.message}` : 'erro desconhecido'
    throw new Error(`O ficheiro tem dados inválidos (${where}).`)
  }
  return result.data as AppData
}

export interface Backup {
  app: 'freela'
  schemaVersion: number
  exportedAt: string
  data: AppData
}

/** Formato do ficheiro de cópia de segurança. */
export function makeBackup(data: AppData, exportedAt: string): Backup {
  return { app: 'freela', schemaVersion: SCHEMA_VERSION, exportedAt, data }
}
