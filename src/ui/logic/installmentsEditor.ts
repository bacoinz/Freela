import { splitEven } from '../../domain/installments'
import type { InstallmentInput } from '../../domain/ops'
import type { Cents, ISODate } from '../../domain/types'

export type EditorMode = 'single' | 'two' | 'custom'

/** Uma linha do editor de prestações no formulário. */
export interface EditorRow {
  key: string
  id?: string
  amount: Cents
  dueDate: ISODate | ''
  expectedMethodId?: string
  received?: { date: ISODate; methodId: string }
}

const sum = (rows: EditorRow[]) => rows.reduce((s, r) => s + r.amount, 0)

/** Valores por defeito de um pagamento novo: já pago (na data do trabalho) ou pendente. */
export interface RowDefaults {
  paid: boolean
  methodId: string
}

/**
 * Linhas para o modo escolhido. Os pagamentos já feitos nunca se perdem;
 * o resto do total é dividido pelas linhas novas. A primeira linha nova fica paga
 * (na data do trabalho) se `defaults.paid` e ainda não houver nada pago; as outras ficam pendentes.
 */
export function rowsForMode(
  mode: EditorMode,
  total: Cents,
  workDate: ISODate,
  existing: EditorRow[],
  newKey: () => string,
  defaults: RowDefaults,
): EditorRow[] {
  const received = existing.filter((r) => r.received)
  const pendingTotal = Math.max(0, total - sum(received))

  if (mode === 'custom') {
    const pending = existing.filter((r) => !r.received)
    if (pending.length === 0) return [...received, { key: newKey(), amount: pendingTotal, dueDate: '' }]
    return applyTotal(existing, total)
  }

  const parts = mode === 'single' ? 1 : Math.max(1, 2 - received.length)
  const amounts = splitEven(pendingTotal, parts)
  const fresh = amounts.map((amount, i): EditorRow => {
    const row: EditorRow = { key: newKey(), amount, dueDate: '' }
    if (i === 0 && defaults.paid && received.length === 0) row.received = { date: workDate, methodId: defaults.methodId }
    return row
  })
  return [...received, ...fresh]
}

function lastPendingIndex(rows: EditorRow[]): number {
  for (let i = rows.length - 1; i >= 0; i--) if (!rows[i]!.received) return i
  return -1
}

/** Altera o valor de uma linha; se não for a última por receber, a última acerta o total. */
export function editRowAmount(rows: EditorRow[], key: string, amount: Cents, total: Cents): EditorRow[] {
  const next = rows.map((r) => (r.key === key ? { ...r, amount } : r))
  const last = lastPendingIndex(next)
  if (last < 0 || next[last]!.key === key) return next
  return applyTotal(next, total)
}

/** A última prestação por receber passa a ser o total menos as outras. */
export function applyTotal(rows: EditorRow[], total: Cents): EditorRow[] {
  const last = lastPendingIndex(rows)
  if (last < 0) return rows
  const others = sum(rows) - rows[last]!.amount
  return rows.map((r, i) => (i === last ? { ...r, amount: total - others } : r))
}

/** Converte as linhas para o formato das operações do domínio. */
export function rowsToInput(rows: EditorRow[]): InstallmentInput[] {
  return rows.map((r) => {
    const out: InstallmentInput = { amount: r.amount }
    if (r.id) out.id = r.id
    if (r.dueDate) out.dueDate = r.dueDate
    if (r.expectedMethodId) out.expectedMethodId = r.expectedMethodId
    if (r.received) out.received = r.received
    return out
  })
}

/** Divide o que falta receber por igual pelas prestações por receber (mantém datas e métodos). */
export function resplit(rows: EditorRow[], total: Cents): EditorRow[] {
  const pendingIdx = rows.flatMap((r, i) => (r.received ? [] : [i]))
  if (pendingIdx.length === 0) return rows
  const received = rows.filter((r) => r.received).reduce((s, r) => s + r.amount, 0)
  const parts = splitEven(Math.max(0, total - received), pendingIdx.length)
  return rows.map((r, i) => {
    const k = pendingIdx.indexOf(i)
    return k >= 0 ? { ...r, amount: parts[k]! } : r
  })
}

/** Acrescenta uma prestação por receber e divide de novo por igual. */
export function addRow(rows: EditorRow[], total: Cents, newKey: () => string): EditorRow[] {
  return resplit([...rows, { key: newKey(), amount: 0, dueDate: '' }], total)
}

/** Remove uma prestação; a última por receber acerta o total. */
export function removeRow(rows: EditorRow[], key: string, total: Cents): EditorRow[] {
  return applyTotal(
    rows.filter((r) => r.key !== key),
    total,
  )
}
