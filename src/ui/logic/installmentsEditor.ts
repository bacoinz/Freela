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

/**
 * Pagamento que já estava guardado como recebido (num trabalho existente): é um facto,
 * por isso o valor não muda sozinho quando se mexe no total ou no modo.
 * Um pagamento novo marcado como pago é só uma escolha no formulário e acompanha o total.
 */
export const isLockedRow = (r: EditorRow): boolean => !!r.id && !!r.received

/** Linha que acerta o total: a última que não está fechada (ou, se estiverem todas, a última). */
function balancingIndex(rows: EditorRow[]): number {
  for (let i = rows.length - 1; i >= 0; i--) if (!isLockedRow(rows[i]!)) return i
  return rows.length - 1
}

/** Valores por defeito de um pagamento novo: já pago (na data do trabalho) ou pendente. */
export interface RowDefaults {
  paid: boolean
  methodId: string
}

/**
 * Linhas para o modo escolhido: 1 em "De uma vez", 2 em "2 vezes"; "Personalizado" mantém as que há.
 * Ficam primeiro os pagamentos já guardados como recebidos (nunca se perdem) e depois as primeiras
 * linhas, que mantêm o estado (pago ou pendente). Se não houver nenhuma linha, a primeira nova fica
 * paga na data do trabalho quando `defaults.paid`; as outras novas ficam pendentes.
 */
export function rowsForMode(
  mode: EditorMode,
  total: Cents,
  workDate: ISODate,
  existing: EditorRow[],
  newKey: () => string,
  defaults: RowDefaults,
): EditorRow[] {
  const fresh = (paid: boolean): EditorRow => {
    const row: EditorRow = { key: newKey(), amount: 0, dueDate: '' }
    if (paid) row.received = { date: workDate, methodId: defaults.methodId }
    return row
  }

  if (mode === 'custom') return applyTotal(existing.length > 0 ? existing : [fresh(defaults.paid)], total)

  const count = mode === 'single' ? 1 : 2
  const locked = existing.filter(isLockedRow).slice(0, count)
  const others = existing.filter((r) => !isLockedRow(r)).slice(0, count - locked.length)
  const kept = existing.filter((r) => locked.includes(r) || others.includes(r))
  while (kept.length < count) kept.push(fresh(kept.length === 0 && defaults.paid))
  return resplit(kept, total)
}

/** Altera o valor de uma linha; se não for a que acerta o total, essa acerta-o. */
export function editRowAmount(rows: EditorRow[], key: string, amount: Cents, total: Cents): EditorRow[] {
  const next = rows.map((r) => (r.key === key ? { ...r, amount } : r))
  const last = balancingIndex(next)
  if (last < 0 || next[last]!.key === key) return next
  return applyTotal(next, total)
}

/** A última prestação que não está fechada passa a ser o total menos as outras. */
export function applyTotal(rows: EditorRow[], total: Cents): EditorRow[] {
  const last = balancingIndex(rows)
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

/**
 * Divide o total por igual pelas linhas que não estão fechadas (mantém datas e métodos);
 * os pagamentos já guardados como recebidos ficam com o valor que têm.
 */
export function resplit(rows: EditorRow[], total: Cents): EditorRow[] {
  const freeIdx = rows.flatMap((r, i) => (isLockedRow(r) ? [] : [i]))
  if (freeIdx.length === 0) return applyTotal(rows, total)
  const locked = sum(rows.filter(isLockedRow))
  const parts = splitEven(Math.max(0, total - locked), freeIdx.length)
  return rows.map((r, i) => {
    const k = freeIdx.indexOf(i)
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
