// Operações puras sobre os dados da app: recebem AppData e devolvem um AppData novo.
import { addDays, diffDays } from './dates'
import { receiveInstallment, undoInstallment, type Receipt } from './installments'
import { nextPayerColor, normalizeName } from './payers'
import { generateRecurringJobs, recurringDueDate, recurringWorkDate } from './recurring'
import type {
  AppData,
  Category,
  Cents,
  ISODate,
  Installment,
  Job,
  ObligationRecord,
  ObligationRule,
  ObligationStatus,
  OpsContext,
  Payer,
  PaymentMethod,
  RecurringIncome,
  Settings,
} from './types'

export type PayerInput =
  | { kind: 'saved'; id: string }
  | { kind: 'oneoff'; name: string }
  /** Guardar um pagador novo (se já existir um com o mesmo nome, usa esse). */
  | { kind: 'new'; name: string }

export interface InstallmentInput {
  /** Id de uma prestação existente (ao editar). */
  id?: string
  amount: Cents
  dueDate?: ISODate
  expectedMethodId?: string
  received?: { date: ISODate; methodId: string }
}

export interface JobInput {
  title: string
  categoryId: string
  payer: PayerInput
  workDate: ISODate
  investPct: number
  notes?: string
  installments: InstallmentInput[]
}

export interface Created {
  data: AppData
  id: string
}

const cleanName = (s: string) => s.trim().replace(/\s+/g, ' ')

// ---------- validação ----------

function requireTitle(title: string): string {
  const t = cleanName(title)
  if (!t) throw new Error('Escreve uma descrição do trabalho.')
  return t
}

function requireCategory(data: AppData, categoryId: string) {
  if (!data.categories.some((c) => c.id === categoryId)) throw new Error('Escolhe uma categoria.')
}

function requirePct(pct: number) {
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new Error('A percentagem para investir tem de estar entre 0 e 100.')
  }
}

function buildInstallments(input: InstallmentInput[], existing: Installment[], ctx: OpsContext): Installment[] {
  if (input.length === 0) throw new Error('Indica pelo menos uma prestação.')
  const existingIds = new Set(existing.map((i) => i.id))
  return input.map((i) => {
    if (!Number.isSafeInteger(i.amount) || i.amount <= 0) {
      throw new Error('Cada prestação tem de ter um valor maior do que zero.')
    }
    const inst: Installment = { id: i.id && existingIds.has(i.id) ? i.id : ctx.newId(), amount: i.amount }
    if (i.dueDate) inst.dueDate = i.dueDate
    if (i.expectedMethodId) inst.expectedMethodId = i.expectedMethodId
    if (i.received) {
      if (!i.received.methodId) throw new Error('Indica o método de cada prestação recebida.')
      inst.receivedDate = i.received.date
      inst.methodId = i.received.methodId
    }
    return inst
  })
}

// ---------- pagadores ----------

export function addPayer(data: AppData, name: string, ctx: OpsContext, color?: string): Created {
  const n = cleanName(name)
  if (!n) throw new Error('Indica quem paga.')
  const existing = data.payers.find((p) => normalizeName(p.name) === normalizeName(n))
  if (existing) {
    const payers = data.payers.map((p) => (p.id === existing.id && p.archived ? withoutArchived(p) : p))
    return { data: { ...data, payers }, id: existing.id }
  }
  const payer: Payer = { id: ctx.newId(), name: n, color: color ?? nextPayerColor(data.payers) }
  return { data: { ...data, payers: [...data.payers, payer] }, id: payer.id }
}

function withoutArchived<T extends { archived?: boolean }>(x: T): T {
  const { archived: _a, ...rest } = x
  return rest as T
}

function resolvePayer(
  data: AppData,
  payer: PayerInput,
  ctx: OpsContext,
): { data: AppData; payerId?: string; payerName?: string } {
  if (payer.kind === 'saved') {
    if (!data.payers.some((p) => p.id === payer.id)) throw new Error('Esse pagador já não existe.')
    return { data, payerId: payer.id }
  }
  const name = cleanName(payer.name)
  if (!name) throw new Error('Indica quem paga.')
  if (payer.kind === 'oneoff') return { data, payerName: name }
  const { data: d, id } = addPayer(data, name, ctx)
  return { data: d, payerId: id }
}

export function updatePayer(data: AppData, id: string, patch: Partial<Pick<Payer, 'name' | 'color' | 'archived'>>): AppData {
  return { ...data, payers: data.payers.map((p) => (p.id === id ? applyNamedPatch(p, patch) : p)) }
}

/** Aplica nome/cor/arquivado a um item com nome (valida o nome; `archived: false` remove a marca). */
function applyNamedPatch<T extends { name: string; archived?: boolean }>(
  item: T,
  patch: { name?: string; color?: string; archived?: boolean },
): T {
  const next = { ...item }
  if (patch.name !== undefined) {
    const n = cleanName(patch.name)
    if (!n) throw new Error('O nome não pode ficar vazio.')
    next.name = n
  }
  if (patch.color !== undefined) (next as T & { color?: string }).color = patch.color
  if (patch.archived === true) next.archived = true
  if (patch.archived === false) delete next.archived
  return next
}

/** Apaga o pagador; se estiver em uso, arquiva (sai das listas, mantém o histórico). */
export function removePayer(data: AppData, id: string): AppData {
  const used = data.jobs.some((j) => j.payerId === id) || data.recurring.some((r) => r.payerId === id)
  return {
    ...data,
    payers: used
      ? data.payers.map((p) => (p.id === id ? { ...p, archived: true } : p))
      : data.payers.filter((p) => p.id !== id),
  }
}

/** Passa um pagador avulso a guardado e atualiza os trabalhos com esse nome. */
export function promoteOneOff(data: AppData, name: string, ctx: OpsContext): Created {
  const { data: d, id } = addPayer(data, name, ctx)
  const norm = normalizeName(name)
  const jobs = d.jobs.map((j) => {
    if (j.payerId || normalizeName(j.payerName ?? '') !== norm) return j
    const { payerName: _p, ...rest } = j
    return { ...rest, payerId: id }
  })
  return { data: { ...d, jobs }, id }
}

// ---------- trabalhos ----------

export function addJob(data: AppData, input: JobInput, ctx: OpsContext): Created {
  const title = requireTitle(input.title)
  requireCategory(data, input.categoryId)
  requirePct(input.investPct)
  const installments = buildInstallments(input.installments, [], ctx)
  const resolved = resolvePayer(data, input.payer, ctx)
  const now = ctx.nowISO()
  const job: Job = {
    id: ctx.newId(),
    title,
    categoryId: input.categoryId,
    workDate: input.workDate,
    investPct: input.investPct,
    installments,
    createdAt: now,
    updatedAt: now,
  }
  if (resolved.payerId) job.payerId = resolved.payerId
  if (resolved.payerName) job.payerName = resolved.payerName
  if (input.notes?.trim()) job.notes = input.notes.trim()
  return { data: { ...resolved.data, jobs: [...resolved.data.jobs, job] }, id: job.id }
}

export function updateJob(data: AppData, jobId: string, input: JobInput, ctx: OpsContext): AppData {
  const old = data.jobs.find((j) => j.id === jobId)
  if (!old) throw new Error('Trabalho não encontrado.')
  const title = requireTitle(input.title)
  requireCategory(data, input.categoryId)
  requirePct(input.investPct)
  const installments = buildInstallments(input.installments, old.installments, ctx)
  const resolved = resolvePayer(data, input.payer, ctx)
  const job: Job = {
    id: old.id,
    title,
    categoryId: input.categoryId,
    workDate: input.workDate,
    investPct: input.investPct,
    installments,
    createdAt: old.createdAt,
    updatedAt: ctx.nowISO(),
  }
  if (resolved.payerId) job.payerId = resolved.payerId
  if (resolved.payerName) job.payerName = resolved.payerName
  if (input.notes?.trim()) job.notes = input.notes.trim()
  if (old.recurringId) job.recurringId = old.recurringId
  if (old.period) job.period = old.period
  return { ...resolved.data, jobs: resolved.data.jobs.map((j) => (j.id === jobId ? job : j)) }
}

/** Elimina um trabalho. Se vier de um rendimento fixo, pode marcar o mês como saltado. */
export function deleteJob(data: AppData, jobId: string, opts: { skipRecurringPeriod?: boolean } = {}): AppData {
  const job = data.jobs.find((j) => j.id === jobId)
  if (!job) return data
  let recurring = data.recurring
  if (opts.skipRecurringPeriod && job.recurringId && job.period) {
    const period = job.period
    recurring = recurring.map((r) =>
      r.id === job.recurringId && !r.skippedPeriods.includes(period)
        ? { ...r, skippedPeriods: [...r.skippedPeriods, period].sort() }
        : r,
    )
  }
  return { ...data, recurring, jobs: data.jobs.filter((j) => j.id !== jobId) }
}

/** Cópia por receber, com a data de hoje; as datas previstas mudam na mesma proporção. */
export function duplicateJob(data: AppData, jobId: string, ctx: OpsContext): Created {
  const orig = data.jobs.find((j) => j.id === jobId)
  if (!orig) throw new Error('Trabalho não encontrado.')
  const shift = diffDays(orig.workDate, ctx.today)
  const now = ctx.nowISO()
  const job: Job = {
    id: ctx.newId(),
    title: orig.title,
    categoryId: orig.categoryId,
    workDate: ctx.today,
    investPct: orig.investPct,
    installments: orig.installments.map((i) => {
      const inst: Installment = { id: ctx.newId(), amount: i.amount }
      if (i.dueDate) inst.dueDate = addDays(i.dueDate, shift)
      const method = i.expectedMethodId ?? i.methodId
      if (method) inst.expectedMethodId = method
      return inst
    }),
    createdAt: now,
    updatedAt: now,
  }
  if (orig.payerId) job.payerId = orig.payerId
  if (orig.payerName) job.payerName = orig.payerName
  if (orig.notes) job.notes = orig.notes
  return { data: { ...data, jobs: [...data.jobs, job] }, id: job.id }
}

function mapJob(data: AppData, jobId: string, fn: (j: Job) => Job): AppData {
  if (!data.jobs.some((j) => j.id === jobId)) throw new Error('Trabalho não encontrado.')
  return { ...data, jobs: data.jobs.map((j) => (j.id === jobId ? fn(j) : j)) }
}

export function receive(data: AppData, jobId: string, installmentId: string, r: Receipt, ctx: OpsContext): AppData {
  return mapJob(data, jobId, (j) => ({ ...receiveInstallment(j, installmentId, r, ctx.newId), updatedAt: ctx.nowISO() }))
}

export function undoReceive(data: AppData, jobId: string, installmentId: string, ctx: OpsContext): AppData {
  return mapJob(data, jobId, (j) => ({ ...undoInstallment(j, installmentId), updatedAt: ctx.nowISO() }))
}

// ---------- rendimentos fixos ----------

/** Cria os trabalhos em falta dos rendimentos fixos (devolve o mesmo objeto se não houver nada). */
export function applyRecurring(data: AppData, ctx: OpsContext): AppData {
  const fresh = generateRecurringJobs(data, ctx)
  return fresh.length ? { ...data, jobs: [...data.jobs, ...fresh] } : data
}

export function upsertRecurring(
  data: AppData,
  rec: Omit<RecurringIncome, 'id'> & { id?: string },
  ctx: OpsContext,
): Created {
  const title = cleanName(rec.title)
  if (!title) throw new Error('Escreve uma descrição para o rendimento fixo.')
  if (!Number.isSafeInteger(rec.amount) || rec.amount <= 0) throw new Error('O valor tem de ser maior do que zero.')
  if (!data.payers.some((p) => p.id === rec.payerId)) throw new Error('Escolhe quem paga.')
  if (rec.months.length === 0) throw new Error('Escolhe pelo menos um mês.')
  if (rec.dayOfMonth < 1 || rec.dayOfMonth > 31) throw new Error('O dia tem de estar entre 1 e 31.')
  requireCategory(data, rec.categoryId)
  const id = rec.id && data.recurring.some((r) => r.id === rec.id) ? rec.id : ctx.newId()
  const clean: RecurringIncome = { ...rec, id, title, months: [...new Set(rec.months)].sort((a, b) => a - b) }
  const old = data.recurring.find((r) => r.id === id)
  return {
    data: {
      ...data,
      recurring: old ? data.recurring.map((r) => (r.id === id ? clean : r)) : [...data.recurring, clean],
      jobs: old ? redateRecurringJobs(data.jobs, old, clean, ctx.nowISO()) : data.jobs,
    },
    id,
  }
}

/**
 * Mudou o dia ou o mês do pagamento: os meses ainda por receber passam para as datas novas.
 * Só mexe nos que ainda têm as datas automáticas (não estraga datas mudadas à mão).
 */
function redateRecurringJobs(jobs: Job[], old: RecurringIncome, next: RecurringIncome, now: string): Job[] {
  if (old.dayOfMonth === next.dayOfMonth && (old.payMonth ?? 'same') === (next.payMonth ?? 'same')) return jobs
  return jobs.map((job) => {
    const inst = job.installments[0]
    if (job.recurringId !== old.id || !job.period || job.installments.length !== 1 || !inst || inst.receivedDate) return job
    if (inst.dueDate !== recurringDueDate(old, job.period)) return job
    return {
      ...job,
      workDate: job.workDate === recurringWorkDate(old, job.period) ? recurringWorkDate(next, job.period) : job.workDate,
      installments: [{ ...inst, dueDate: recurringDueDate(next, job.period) }],
      updatedAt: now,
    }
  })
}

/** Apaga o rendimento fixo (os trabalhos já criados ficam). */
export function removeRecurring(data: AppData, id: string): AppData {
  return { ...data, recurring: data.recurring.filter((r) => r.id !== id) }
}

// ---------- categorias e métodos ----------

export function addCategory(data: AppData, name: string, color: string, ctx: OpsContext): Created {
  const n = cleanName(name)
  if (!n) throw new Error('O nome não pode ficar vazio.')
  const cat: Category = { id: ctx.newId(), name: n, color }
  return { data: { ...data, categories: [...data.categories, cat] }, id: cat.id }
}

export function updateCategory(data: AppData, id: string, patch: Partial<Pick<Category, 'name' | 'color' | 'archived'>>): AppData {
  return { ...data, categories: data.categories.map((c) => (c.id === id ? applyNamedPatch(c, patch) : c)) }
}

/** Apaga a categoria; se estiver em uso, arquiva. Tem de ficar pelo menos uma ativa. */
export function removeCategory(data: AppData, id: string): AppData {
  if (data.categories.filter((c) => !c.archived && c.id !== id).length === 0) {
    throw new Error('Tem de existir pelo menos uma categoria.')
  }
  const used = data.jobs.some((j) => j.categoryId === id) || data.recurring.some((r) => r.categoryId === id)
  return {
    ...data,
    categories: used
      ? data.categories.map((c) => (c.id === id ? { ...c, archived: true } : c))
      : data.categories.filter((c) => c.id !== id),
  }
}

export function addMethod(data: AppData, name: string, ctx: OpsContext): Created {
  const n = cleanName(name)
  if (!n) throw new Error('O nome não pode ficar vazio.')
  const m: PaymentMethod = { id: ctx.newId(), name: n }
  return { data: { ...data, methods: [...data.methods, m] }, id: m.id }
}

export function updateMethod(data: AppData, id: string, patch: Partial<Pick<PaymentMethod, 'name' | 'archived'>>): AppData {
  return { ...data, methods: data.methods.map((m) => (m.id === id ? applyNamedPatch(m, patch) : m)) }
}

/** Apaga o método; se estiver em uso, arquiva. */
export function removeMethod(data: AppData, id: string): AppData {
  const used =
    data.jobs.some((j) => j.installments.some((i) => i.methodId === id || i.expectedMethodId === id)) ||
    data.recurring.some((r) => r.methodId === id)
  return {
    ...data,
    methods: used
      ? data.methods.map((m) => (m.id === id ? { ...m, archived: true } : m))
      : data.methods.filter((m) => m.id !== id),
  }
}

// ---------- obrigações ----------

function isEmptyRecord(r: ObligationRecord): boolean {
  return Object.keys(r).every((k) => k === 'ruleId' || k === 'originalDate')
}

function updateRecord(
  data: AppData,
  ruleId: string,
  originalDate: ISODate,
  fn: (r: ObligationRecord) => ObligationRecord,
): AppData {
  const idx = data.obligationRecords.findIndex((r) => r.ruleId === ruleId && r.originalDate === originalDate)
  const current = idx >= 0 ? data.obligationRecords[idx]! : { ruleId, originalDate }
  const next = fn(current)
  const records = [...data.obligationRecords]
  if (idx >= 0) records.splice(idx, 1)
  if (!isEmptyRecord(next)) records.splice(idx >= 0 ? idx : records.length, 0, next)
  return { ...data, obligationRecords: records }
}

export function markOccurrence(
  data: AppData,
  ruleId: string,
  originalDate: ISODate,
  status: ObligationStatus,
  extra: { date?: ISODate; amountPaid?: Cents } = {},
): AppData {
  return updateRecord(data, ruleId, originalDate, (r) => {
    const { date: _d, amountPaid: _a, ...rest } = r
    const next: ObligationRecord = { ...rest, status }
    if (extra.date) next.date = extra.date
    if (extra.amountPaid !== undefined && extra.amountPaid > 0) next.amountPaid = extra.amountPaid
    return next
  })
}

export function unmarkOccurrence(data: AppData, ruleId: string, originalDate: ISODate): AppData {
  return updateRecord(data, ruleId, originalDate, (r) => {
    const { status: _s, date: _d, amountPaid: _a, ...rest } = r
    return rest
  })
}

export function setOccurrenceDueDate(
  data: AppData,
  ruleId: string,
  originalDate: ISODate,
  dueDate: ISODate | undefined,
): AppData {
  return updateRecord(data, ruleId, originalDate, (r) => {
    const { dueDateOverride: _o, ...rest } = r
    return dueDate && dueDate !== originalDate ? { ...rest, dueDateOverride: dueDate } : rest
  })
}

export function upsertObligationRule(
  data: AppData,
  rule: Omit<ObligationRule, 'id'> & { id?: string },
  ctx: OpsContext,
): Created {
  const title = cleanName(rule.title)
  if (!title) throw new Error('Escreve uma descrição para o prazo.')
  const exists = rule.id !== undefined && data.obligationRules.some((r) => r.id === rule.id)
  const id = exists ? rule.id! : ctx.newId()
  const clean: ObligationRule = { ...rule, id, title }
  return {
    data: {
      ...data,
      obligationRules: exists
        ? data.obligationRules.map((r) => (r.id === id ? clean : r))
        : [...data.obligationRules, clean],
    },
    id,
  }
}

/** Apaga a regra; se já tiver histórico (feito/pago), apenas a desativa. */
export function removeObligationRule(data: AppData, id: string): AppData {
  const hasHistory = data.obligationRecords.some((r) => r.ruleId === id && r.status)
  if (hasHistory) {
    return { ...data, obligationRules: data.obligationRules.map((r) => (r.id === id ? { ...r, active: false } : r)) }
  }
  return {
    ...data,
    obligationRules: data.obligationRules.filter((r) => r.id !== id),
    obligationRecords: data.obligationRecords.filter((r) => r.ruleId !== id),
  }
}

// ---------- definições ----------

export function updateSettings(data: AppData, patch: Partial<Settings>): AppData {
  const next = { ...data.settings, ...patch }
  requirePct(next.investPct)
  if (!Number.isInteger(next.reminderHour) || next.reminderHour < 0 || next.reminderHour > 23) {
    throw new Error('A hora dos lembretes tem de estar entre 0 e 23.')
  }
  if (!Number.isInteger(next.overdueDays) || next.overdueDays < 0) {
    throw new Error('O nº de dias até um pagamento ficar atrasado não pode ser negativo.')
  }
  return { ...data, settings: next }
}
