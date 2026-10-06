import { beforeEach, describe, expect, it } from 'vitest'
import { NEUTRAL_COLOR, PAYER_PALETTE, initials, nextPayerColor, normalizeName, payerColor, payerKey, payerLabel, suggestPayers } from './payers'
import { mkJob, resetIds } from './testkit'
import type { Payer } from './types'

beforeEach(() => resetIds())

const escola: Payer = { id: 'p1', name: 'Escola de Música X', color: PAYER_PALETTE[0]! }
const hot: Payer = { id: 'p2', name: 'Hot Clube', color: PAYER_PALETTE[1]! }
const velho: Payer = { id: 'p3', name: 'Esquecido', color: PAYER_PALETTE[2]!, archived: true }

describe('normalizeName', () => {
  it('ignora maiúsculas, acentos e espaços a mais', () => {
    expect(normalizeName('  João   Silva ')).toBe('joao silva')
    expect(normalizeName('ESCOLA de Música')).toBe('escola de musica')
  })
})

describe('nextPayerColor', () => {
  it('usa a primeira cor livre da paleta', () => {
    expect(nextPayerColor([])).toBe(PAYER_PALETTE[0])
    expect(nextPayerColor([escola])).toBe(PAYER_PALETTE[1])
    expect(nextPayerColor([escola, hot])).toBe(PAYER_PALETTE[2])
  })

  it('volta ao início quando todas as cores estão usadas', () => {
    const all = PAYER_PALETTE.map((c, i) => ({ id: `x${i}`, name: `P${i}`, color: c }))
    expect(PAYER_PALETTE).toHaveLength(12)
    expect(nextPayerColor(all)).toBe(PAYER_PALETTE[0])
  })
})

describe('payerKey / payerLabel / payerColor', () => {
  it('identifica pagadores guardados pelo id e avulsos pelo nome', () => {
    expect(payerKey(mkJob({ payerId: 'p1', payerName: undefined }))).toBe('id:p1')
    expect(payerKey(mkJob({ payerName: '  Bar   Azul ' }))).toBe('name:bar azul')
  })

  it('mostra o nome e a cor certos', () => {
    const payers = [escola]
    expect(payerLabel(mkJob({ payerId: 'p1', payerName: undefined }), payers)).toBe('Escola de Música X')
    expect(payerLabel(mkJob({ payerName: 'Bar Azul' }), payers)).toBe('Bar Azul')
    expect(payerColor(mkJob({ payerId: 'p1', payerName: undefined }), payers)).toBe(escola.color)
    expect(payerColor(mkJob({ payerName: 'Bar Azul' }), payers)).toBe(NEUTRAL_COLOR)
  })
})

describe('suggestPayers', () => {
  const jobs = [
    mkJob({ payerName: 'Escadinhas Bar', workDate: '2026-09-01' }),
    mkJob({ payerName: 'Casamento Silva', workDate: '2026-10-01' }),
    mkJob({ payerName: 'escola de musica x', workDate: '2026-10-02' }), // igual a um guardado → não repete
    mkJob({ payerId: 'p2', payerName: undefined, workDate: '2026-10-03' }),
  ]

  it('mostra guardados (não arquivados) e avulsos já usados que correspondem à pesquisa', () => {
    const out = suggestPayers('esc', [escola, hot, velho], jobs)
    expect(out.map((s) => (s.kind === 'saved' ? `S:${s.payer.name}` : `A:${s.name}`))).toEqual([
      'S:Escola de Música X',
      'A:Escadinhas Bar',
    ])
  })

  it('pesquisa sem acentos e no meio do nome', () => {
    const out = suggestPayers('musica', [escola, hot], jobs)
    expect(out.map((s) => s.kind)).toEqual(['saved'])
  })

  it('sem pesquisa, mostra os guardados usados mais recentemente primeiro, depois avulsos recentes', () => {
    const out = suggestPayers('', [escola, hot], jobs)
    expect(out.map((s) => (s.kind === 'saved' ? `S:${s.payer.name}` : `A:${s.name}`))).toEqual([
      'S:Hot Clube',
      'S:Escola de Música X',
      'A:Casamento Silva',
      'A:Escadinhas Bar',
    ])
  })
})

describe('initials', () => {
  it('usa as iniciais das palavras principais', () => {
    expect(initials('Escola de Música X')).toBe('EM')
    expect(initials('Hot Clube')).toBe('HC')
    expect(initials('Revolut')).toBe('RE')
    expect(initials('  ')).toBe('?')
  })
})
