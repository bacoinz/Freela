import type { Cents } from './types'

const fmtCents = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const fmtWhole = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** 15050 → "150,50 €". Com `compactCents`, 45000 → "450 €". */
export function formatMoney(cents: Cents, opts: { compactCents?: boolean } = {}): string {
  const value = cents / 100
  if (opts.compactCents && cents % 100 === 0) return fmtWhole.format(value)
  return fmtCents.format(value)
}

/** Valida grupos de milhares: o 1.º com 1–3 dígitos, os outros com 3. */
function validThousands(groups: string[]): boolean {
  if (groups.length < 2) return /^\d+$/.test(groups[0] ?? '')
  return groups.every((g, i) => (i === 0 ? /^\d{1,3}$/.test(g) : /^\d{3}$/.test(g)))
}

/**
 * Lê um valor escrito à portuguesa (ou com ponto decimal) e devolve cêntimos.
 * Aceita "150", "150,5", "1.234,56", "1 234,56", "12.50", "1.234" (milhares).
 * Devolve `null` se o texto não for um valor válido e não negativo com ≤ 2 casas decimais.
 */
export function parseMoney(input: string): Cents | null {
  const s = input.replace(/[\s  €]/g, '')
  if (s === '' || !/^[\d.,]+$/.test(s)) return null

  const commas = s.split(',').length - 1
  const dots = s.split('.').length - 1
  let intPart: string
  let decPart = ''

  if (commas > 0 && dots > 0) {
    const decSep = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.'
    const thouSep = decSep === ',' ? '.' : ','
    const idx = s.lastIndexOf(decSep)
    if (s.split(decSep).length - 1 !== 1) return null
    const groups = s.slice(0, idx).split(thouSep)
    if (!validThousands(groups)) return null
    intPart = groups.join('')
    decPart = s.slice(idx + 1)
  } else if (commas > 0) {
    if (commas > 1) return null
    ;[intPart, decPart] = s.split(',') as [string, string]
  } else if (dots === 1) {
    const [a, b] = s.split('.') as [string, string]
    const looksLikeThousands = b.length === 3 && a.length > 0 && a[0] !== '0'
    if (looksLikeThousands) {
      intPart = a + b
    } else {
      intPart = a
      decPart = b
    }
  } else if (dots > 1) {
    const groups = s.split('.')
    if (!validThousands(groups)) return null
    intPart = groups.join('')
  } else {
    intPart = s
  }

  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(decPart)) return null
  if (decPart.length > 2) return null
  if (intPart === '' && decPart === '') return null

  const cents = Number(intPart || '0') * 100 + Number((decPart + '00').slice(0, 2))
  return Number.isSafeInteger(cents) ? cents : null
}

/** Percentagem de um valor, arredondada ao cêntimo (meio cêntimo arredonda para cima). */
export function percentOf(cents: Cents, pct: number): Cents {
  return Math.round((cents * pct) / 100)
}

/** 15050 → "150,50"; 45000 → "450" (para pré-preencher campos de valor). */
export function centsToInput(cents: Cents): string {
  const abs = Math.abs(cents)
  const int = Math.floor(abs / 100)
  const dec = abs % 100
  const sign = cents < 0 ? '-' : ''
  return dec === 0 ? `${sign}${int}` : `${sign}${int},${String(dec).padStart(2, '0')}`
}
