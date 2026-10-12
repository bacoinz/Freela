import { beforeEach, describe, expect, it } from 'vitest'
import { jobsToCSV } from './csv'
import { mkData, mkInst, mkJob, resetIds } from './testkit'

beforeEach(() => resetIds())

describe('jobsToCSV', () => {
  const data = mkData({
    payers: [{ id: 'p1', name: 'Hot Clube', color: '#6366f1' }],
    jobs: [
      mkJob({
        title: 'Casamento; "Silva"',
        payerName: 'Família Silva',
        workDate: '2026-09-20',
        notes: 'linha 1\nlinha 2',
        installments: [
          mkInst({
            amount: 22500,
            dueDate: '2026-09-20',
            receivedDate: '2026-09-21',
            methodId: 'mbway',
            invested: { date: '2026-09-25', parts: [{ destinationId: 'poupanca', name: 'Conta poupança', amount: 3375 }] },
          }),
          mkInst({ amount: 22500, dueDate: '2026-10-01' }),
        ],
      }),
      mkJob({ title: 'Concerto', payerId: 'p1', payerName: undefined, workDate: '2026-10-02', installments: [mkInst({ amount: 15050 })] }),
    ],
  })

  it('começa com BOM e usa ";" para abrir bem no Excel em português', () => {
    const csv = jobsToCSV(data, '2026-10-06')
    expect(csv.startsWith('﻿')).toBe(true)
    const header = csv.slice(1).split('\r\n')[0]!
    expect(header).toBe(
      'Data do trabalho;Descrição;Categoria;Pagador;Total do trabalho;Prestação;Valor;Data prevista;Data de recebimento;Método;Estado;% investimento;Para investir;Investido em;Notas',
    )
  })

  it('uma linha por prestação, com valores à portuguesa e campos protegidos', () => {
    const lines = jobsToCSV(data, '2026-10-06').slice(1).split('\r\n')
    expect(lines).toHaveLength(4)
    expect(lines[1]).toBe(
      '20/09/2026;"Casamento; ""Silva""";Música;Família Silva;450,00;1/2;225,00;20/09/2026;21/09/2026;MB WAY;Recebido;15;33,75;25/09/2026;"linha 1\nlinha 2"',
    )
    expect(lines[2]).toBe(
      '20/09/2026;"Casamento; ""Silva""";Música;Família Silva;450,00;2/2;225,00;01/10/2026;;;Atrasado;15;33,75;;"linha 1\nlinha 2"',
    )
    expect(lines[3]).toBe('02/10/2026;Concerto;Música;Hot Clube;150,50;1/1;150,50;;;;Pendente;15;22,58;;')
  })
})
