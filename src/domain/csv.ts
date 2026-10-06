import { formatDateShort } from './dates'
import { isReceived, jobTotal } from './installments'
import { installmentInvest, isInstallmentOverdue } from './jobs'
import { payerLabel } from './payers'
import type { AppData, Cents, ISODate } from './types'

const HEADER = [
  'Data do trabalho',
  'Descrição',
  'Categoria',
  'Pagador',
  'Total do trabalho',
  'Prestação',
  'Valor',
  'Data prevista',
  'Data de recebimento',
  'Método',
  'Estado',
  '% investimento',
  'Para investir',
  'Notas',
]

/** Valor simples para Excel em PT: "1234,56" (sem € nem separador de milhares). */
function plain(c: Cents): string {
  const sign = c < 0 ? '-' : ''
  const abs = Math.abs(c)
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

function field(v: string): string {
  return /[;"\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v
}

/** CSV com uma linha por prestação (separador ";", UTF-8 com BOM, para abrir no Excel em português). */
export function jobsToCSV(data: AppData, today: ISODate): string {
  const rows = [HEADER.join(';')]
  const jobs = [...data.jobs].sort((a, b) => a.workDate.localeCompare(b.workDate) || a.createdAt.localeCompare(b.createdAt))
  for (const job of jobs) {
    const category = data.categories.find((c) => c.id === job.categoryId)?.name ?? ''
    const payer = payerLabel(job, data.payers)
    const total = plain(jobTotal(job))
    job.installments.forEach((inst, i) => {
      const received = isReceived(inst)
      const state = received
        ? 'Recebido'
        : isInstallmentOverdue(inst, job, today, data.settings.overdueDays)
          ? 'Atrasado'
          : 'Pendente'
      const method = received ? (data.methods.find((m) => m.id === inst.methodId)?.name ?? '') : ''
      rows.push(
        [
          formatDateShort(job.workDate),
          job.title,
          category,
          payer,
          total,
          `${i + 1}/${job.installments.length}`,
          plain(inst.amount),
          inst.dueDate ? formatDateShort(inst.dueDate) : '',
          inst.receivedDate ? formatDateShort(inst.receivedDate) : '',
          method,
          state,
          String(job.investPct).replace('.', ','),
          plain(installmentInvest(inst, job)),
          job.notes ?? '',
        ]
          .map(field)
          .join(';'),
      )
    })
  }
  return '﻿' + rows.join('\r\n')
}
