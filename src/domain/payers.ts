import type { ISODate, Job, Payer } from './types'

/** 12 cores para pagadores (evita vermelho, reservado a atrasos/obrigações). */
export const PAYER_PALETTE: readonly string[] = [
  '#6366f1', // índigo
  '#f97316', // laranja
  '#10b981', // esmeralda
  '#ec4899', // rosa
  '#0ea5e9', // azul-céu
  '#f59e0b', // âmbar
  '#8b5cf6', // violeta
  '#14b8a6', // verde-azulado
  '#65a30d', // lima
  '#d946ef', // fúcsia
  '#a16207', // castanho
  '#2563eb', // azul
]

/** Cor dos pagadores avulsos. */
export const NEUTRAL_COLOR = '#94a3b8'

export type PayerSuggestion = { kind: 'saved'; payer: Payer } | { kind: 'oneoff'; name: string }

/** Para comparar nomes: sem acentos, minúsculas, espaços simples. */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/** Primeira cor da paleta ainda não usada; se estiverem todas, recomeça. */
export function nextPayerColor(payers: Payer[]): string {
  const used = new Set(payers.map((p) => p.color))
  return PAYER_PALETTE.find((c) => !used.has(c)) ?? PAYER_PALETTE[payers.length % PAYER_PALETTE.length]!
}

/** Chave estável para agrupar por pagador: 'id:…' (guardado) ou 'name:…' (avulso). */
export function payerKey(job: Job): string {
  return job.payerId ? `id:${job.payerId}` : `name:${normalizeName(job.payerName ?? '')}`
}

export function payerLabel(job: Job, payers: Payer[]): string {
  if (job.payerId) return payers.find((p) => p.id === job.payerId)?.name ?? '(pagador removido)'
  return job.payerName?.trim() || 'Sem pagador'
}

export function payerColor(job: Job, payers: Payer[]): string {
  if (!job.payerId) return NEUTRAL_COLOR
  return payers.find((p) => p.id === job.payerId)?.color ?? NEUTRAL_COLOR
}

/** Iniciais para o círculo colorido (ex.: "Escola de Música" → "EM"). */
export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !['de', 'da', 'do', 'das', 'dos', 'e'].includes(w.toLowerCase()))
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return (words[0]![0]! + words[1]![0]!).toUpperCase()
}

/**
 * Sugestões para o campo "Pagador": guardados (não arquivados) e avulsos já usados.
 * Guardados primeiro; dentro de cada grupo, os que começam pela pesquisa e depois os mais recentes.
 */
export function suggestPayers(query: string, payers: Payer[], jobs: Job[]): PayerSuggestion[] {
  const q = normalizeName(query)
  const lastUsed = new Map<string, ISODate>()
  for (const j of jobs) {
    const k = payerKey(j)
    const prev = lastUsed.get(k)
    if (!prev || j.workDate > prev) lastUsed.set(k, j.workDate)
  }

  const rank = (name: string, key: string) => ({
    prefix: q !== '' && normalizeName(name).startsWith(q) ? 0 : 1,
    last: lastUsed.get(key) ?? '',
    name: normalizeName(name),
  })
  const compare = (a: ReturnType<typeof rank>, b: ReturnType<typeof rank>) =>
    a.prefix - b.prefix || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0) || a.name.localeCompare(b.name)
  const matches = (name: string) => q === '' || normalizeName(name).includes(q)

  const saved = payers
    .filter((p) => !p.archived && matches(p.name))
    .map((p) => ({ p, r: rank(p.name, `id:${p.id}`) }))
    .sort((a, b) => compare(a.r, b.r))
    .map(({ p }): PayerSuggestion => ({ kind: 'saved', payer: p }))

  const savedNames = new Set(payers.map((p) => normalizeName(p.name)))
  const oneOffs = new Map<string, { name: string; date: ISODate }>()
  for (const j of jobs) {
    if (j.payerId || !j.payerName?.trim()) continue
    const norm = normalizeName(j.payerName)
    if (savedNames.has(norm)) continue
    const prev = oneOffs.get(norm)
    if (!prev || j.workDate > prev.date) oneOffs.set(norm, { name: j.payerName.trim(), date: j.workDate })
  }
  const oneOffList = [...oneOffs.entries()]
    .filter(([, v]) => matches(v.name))
    .map(([norm, v]) => ({ v, r: rank(v.name, `name:${norm}`) }))
    .sort((a, b) => compare(a.r, b.r))
    .map(({ v }): PayerSuggestion => ({ kind: 'oneoff', name: v.name }))

  return [...saved, ...oneOffList]
}
