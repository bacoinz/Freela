import { describe, expect, it } from 'vitest'
import { formatMoney, parseMoney, percentOf, centsToInput } from './money'

// O Intl usa espaços especiais (U+00A0 / U+202F); normalizamos para comparar.
const norm = (s: string) => s.replace(/[  ]/g, ' ')

describe('formatMoney', () => {
  it('formata em euros no formato português', () => {
    expect(norm(formatMoney(15050))).toBe('150,50 €')
    expect(norm(formatMoney(0))).toBe('0,00 €')
    expect(norm(formatMoney(5))).toBe('0,05 €')
  })

  it('agrupa milhares a partir de 10 000', () => {
    expect(norm(formatMoney(1234567))).toBe('12 345,67 €')
  })

  it('pode omitir os cêntimos quando são zero', () => {
    expect(norm(formatMoney(45000, { compactCents: true }))).toBe('450 €')
    expect(norm(formatMoney(45050, { compactCents: true }))).toBe('450,50 €')
  })

  it('formata valores negativos', () => {
    expect(norm(formatMoney(-2500))).toBe('-25,00 €')
  })
})

describe('parseMoney', () => {
  it.each([
    ['150', 15000],
    ['150,5', 15050],
    ['150,50', 15050],
    ['12.50', 1250],
    ['12.5', 1250],
    ['1.234,56', 123456],
    ['1 234,56', 123456],
    ['1.234', 123400],
    ['1.234.567', 123456700],
    ['1,234.56', 123456],
    ['0,05', 5],
    [' 450 € ', 45000],
    ['€450', 45000],
    [',5', 50],
  ])('lê "%s" como %i cêntimos', (input, expected) => {
    expect(parseMoney(input)).toBe(expected)
  })

  it.each(['', '   ', 'abc', '12,345', '1,2,3', '-5', '12..5', '1.23.45', '12,3a'])(
    'rejeita "%s"',
    (input) => {
      expect(parseMoney(input)).toBeNull()
    },
  )
})

describe('percentOf', () => {
  it('calcula a percentagem arredondando ao cêntimo', () => {
    expect(percentOf(22500, 15)).toBe(3375)
    expect(percentOf(45000, 15)).toBe(6750)
    expect(percentOf(22550, 15)).toBe(3383) // 3382,5 → 3383
    expect(percentOf(100, 12.5)).toBe(13) // 12,5 → 13
    expect(percentOf(0, 15)).toBe(0)
  })
})

describe('centsToInput', () => {
  it('converte cêntimos para o texto de um campo de valor', () => {
    expect(centsToInput(15050)).toBe('150,50')
    expect(centsToInput(45000)).toBe('450')
    expect(centsToInput(5)).toBe('0,05')
  })
})
