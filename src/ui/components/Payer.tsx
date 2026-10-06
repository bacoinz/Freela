import { Bookmark, UserRound, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { initials, NEUTRAL_COLOR, nextPayerColor, normalizeName, suggestPayers } from '../../domain/payers'
import type { PayerInput } from '../../domain/ops'
import type { Job, Payer } from '../../domain/types'
import { cn } from './cn'
import { inputClass } from './Form'

/** Círculo com as iniciais na cor do pagador. */
export function PayerAvatar({ name, color, size = 40 }: { name: string; color?: string; size?: number }) {
  const bg = color ?? NEUTRAL_COLOR
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  )
}

/** Nome a mostrar para um valor do campo "Pagador". */
export function payerInputName(v: PayerInput, payers: Payer[]): string {
  if (v.kind === 'saved') return payers.find((p) => p.id === v.id)?.name ?? ''
  return v.name
}

interface PayerPickerProps {
  id?: string
  value: PayerInput | null
  onChange: (v: PayerInput | null) => void
  payers: Payer[]
  jobs: Job[]
  /** Só pagadores guardados (ex.: rendimentos fixos). */
  savedOnly?: boolean
  invalid?: boolean
}

/** Campo "Quem paga": escolher um guardado, um avulso já usado, ou criar um novo. */
export function PayerPicker({ id, value, onChange, payers, jobs, savedOnly, invalid }: PayerPickerProps) {
  const [query, setQuery] = useState('')
  const listId = useId()
  const suggestions = useMemo(
    () => suggestPayers(query, payers, jobs).filter((s) => !savedOnly || s.kind === 'saved').slice(0, 6),
    [query, payers, jobs, savedOnly],
  )

  if (value) {
    const name = payerInputName(value, payers)
    const color = value.kind === 'saved' ? payers.find((p) => p.id === value.id)?.color : value.kind === 'new' ? nextPayerColor(payers) : undefined
    const badge = value.kind === 'saved' ? 'guardado' : value.kind === 'new' ? 'novo — vai ser guardado' : 'só desta vez'
    return (
      <div className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2">
        <PayerAvatar name={name} color={value.kind === 'oneoff' ? undefined : color} size={36} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{name}</span>
          <span className="text-xs text-muted">{badge}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setQuery(name)
            onChange(null)
          }}
          className="rounded-lg px-2 py-2 text-sm font-semibold text-primary-ink hover:bg-primary-soft"
        >
          Alterar
        </button>
      </div>
    )
  }

  const typed = query.trim()
  const exact = suggestions.some((s) => normalizeName(s.kind === 'saved' ? s.payer.name : s.name) === normalizeName(typed))

  return (
    <div className="flex flex-col gap-2">
      <input
        id={id}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ex.: Escola de Música, Hot Clube…"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        aria-controls={listId}
        className={inputClass}
      />
      <div id={listId} className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface empty:hidden">
        {suggestions.map((s) => {
          const name = s.kind === 'saved' ? s.payer.name : s.name
          return (
            <button
              key={s.kind + name}
              type="button"
              onClick={() => onChange(s.kind === 'saved' ? { kind: 'saved', id: s.payer.id } : { kind: 'oneoff', name })}
              className="flex min-h-12 items-center gap-3 border-b border-line px-3 py-2 text-left last:border-b-0 hover:bg-surface-2"
            >
              <PayerAvatar name={name} color={s.kind === 'saved' ? s.payer.color : undefined} size={30} />
              <span className="min-w-0 flex-1 truncate">{name}</span>
              <span className="text-xs text-muted">{s.kind === 'saved' ? 'guardado' : 'avulso'}</span>
            </button>
          )
        })}
      </div>
      {typed && !exact && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ kind: 'new', name: typed })}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary-soft px-3 text-sm font-semibold text-primary-ink"
          >
            <Bookmark aria-hidden className="size-4 shrink-0" />
            Guardar pagador
          </button>
          {!savedOnly && (
            <button
              type="button"
              onClick={() => onChange({ kind: 'oneoff', name: typed })}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold"
            >
              <UserRound aria-hidden className="size-4 shrink-0" />
              Só desta vez
            </button>
          )}
        </div>
      )}
      {query && (
        <button type="button" onClick={() => setQuery('')} className={cn('inline-flex items-center gap-1 self-start text-sm text-muted', !query && 'hidden')}>
          <X aria-hidden className="size-4" /> Limpar
        </button>
      )}
    </div>
  )
}
