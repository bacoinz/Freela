import type { Cents, ISODate, Installment, Job } from './types'

export interface Receipt {
  amount: Cents
  date: ISODate
  methodId: string
}

export function isReceived(i: Installment): boolean {
  return i.receivedDate !== undefined
}

/** Divide o total em `n` partes iguais; o que sobra vai para a última. */
export function splitEven(total: Cents, n: number): Cents[] {
  const parts = Math.max(1, Math.floor(n))
  const base = Math.floor(total / parts)
  const out = Array<Cents>(parts).fill(base)
  out[parts - 1] = total - base * (parts - 1)
  return out
}

/** No editor de prestações, a última é sempre o total menos as outras. */
export function lastFromTotal(total: Cents, others: Cents[]): Cents {
  return total - others.reduce((s, v) => s + v, 0)
}

export function jobTotal(job: Job): Cents {
  return job.installments.reduce((s, i) => s + i.amount, 0)
}

export function paidAmount(job: Job): Cents {
  return job.installments.reduce((s, i) => (isReceived(i) ? s + i.amount : s), 0)
}

export function remainingAmount(job: Job): Cents {
  return jobTotal(job) - paidAmount(job)
}

export function paidCount(job: Job): number {
  return job.installments.filter(isReceived).length
}

/**
 * Marca uma prestação como recebida. O total combinado mantém-se:
 * - recebeu menos → o resto fica numa nova prestação pendente logo a seguir;
 * - recebeu mais → as outras prestações pendentes baixam (primeiro as seguintes);
 *   se não houver pendentes suficientes, o total sobe.
 */
export function receiveInstallment(job: Job, installmentId: string, r: Receipt, newId: () => string): Job {
  if (!(r.amount > 0)) throw new Error('O valor recebido tem de ser maior do que zero.')
  const idx = job.installments.findIndex((i) => i.id === installmentId)
  const inst = job.installments[idx]
  if (!inst) throw new Error('Prestação não encontrada.')
  if (isReceived(inst)) throw new Error('Esta prestação já foi recebida.')

  let list: Installment[] = job.installments.map((i) => ({ ...i }))
  list[idx] = { ...inst, amount: r.amount, receivedDate: r.date, methodId: r.methodId }

  if (r.amount < inst.amount) {
    const rest: Installment = { id: newId(), amount: inst.amount - r.amount }
    if (inst.dueDate) rest.dueDate = inst.dueDate
    if (inst.expectedMethodId) rest.expectedMethodId = inst.expectedMethodId
    list.splice(idx + 1, 0, rest)
  } else if (r.amount > inst.amount) {
    let excess = r.amount - inst.amount
    const order = [...list.keys()].filter((j) => j > idx).concat([...list.keys()].filter((j) => j < idx))
    for (const j of order) {
      const other = list[j]!
      if (excess <= 0) break
      if (isReceived(other)) continue
      const cut = Math.min(excess, other.amount)
      other.amount -= cut
      excess -= cut
    }
    list = list.filter((i) => isReceived(i) || i.amount > 0)
  }

  return { ...job, installments: list }
}

/** Anula o recebimento de uma prestação (volta a ficar pendente). */
export function undoInstallment(job: Job, installmentId: string): Job {
  return {
    ...job,
    installments: job.installments.map((i) => {
      if (i.id !== installmentId) return i
      const { receivedDate: _r, methodId: _m, ...rest } = i
      return rest
    }),
  }
}
