import { Check } from 'lucide-react'
import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { centsToInput, parseMoney } from '../../domain/money'
import type { Cents } from '../../domain/types'
import { cn } from './cn'

export const inputClass =
  'w-full h-12 rounded-xl border border-line bg-surface px-3.5 text-[16px] text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-primary/35 focus:border-primary aria-[invalid=true]:border-danger'

interface FieldProps {
  label: string
  htmlFor?: string
  hint?: ReactNode
  error?: string | null
  optional?: boolean
  children: ReactNode
  className?: string
}

/** Rótulo visível + campo + ajuda/erro por baixo. */
export function Field({ label, htmlFor, hint, error, optional, children, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="px-0.5 text-sm font-medium text-muted">
        {label}
        {optional && <span className="font-normal text-faint"> (opcional)</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="px-0.5 text-sm font-medium text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="px-0.5 text-sm text-muted">{hint}</p>
      )}
    </div>
  )
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" {...rest} className={cn(inputClass, className)} />
}

export function DateInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="date" {...rest} className={cn(inputClass, 'tnum', className)} />
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...rest} className={cn(inputClass, 'h-auto min-h-24 py-3 leading-relaxed', className)} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cn(inputClass, 'appearance-none bg-[length:20px] pr-10', className)} style={{ backgroundImage: CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}>
      {children}
    </select>
  )
}

const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23868fa0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`

interface MoneyInputProps {
  id?: string
  value: Cents | null
  onChange: (c: Cents | null) => void
  autoFocus?: boolean
  large?: boolean
  invalid?: boolean
  placeholder?: string
  'aria-describedby'?: string
}

/** Valor em euros: aceita "150", "150,50", "1.234,56". */
export function MoneyInput({ id, value, onChange, autoFocus, large, invalid, placeholder = '0,00', ...aria }: MoneyInputProps) {
  const [text, setText] = useState(value != null ? centsToInput(value) : '')
  // Se o valor mudar por fora (ex.: prestações recalculadas), mostra o novo valor.
  useEffect(() => {
    if (parseMoney(text) !== value) setText(value != null ? centsToInput(value) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  const bad = invalid || (text.trim() !== '' && parseMoney(text) === null)
  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={text}
        aria-invalid={bad || undefined}
        aria-describedby={aria['aria-describedby']}
        onChange={(e) => {
          setText(e.target.value)
          onChange(parseMoney(e.target.value))
        }}
        className={cn(inputClass, 'tnum pr-10', large && 'h-16 text-[28px] font-bold')}
      />
      <span aria-hidden className={cn('pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted', large ? 'text-2xl font-semibold' : '')}>
        €
      </span>
    </div>
  )
}

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: ReactNode
  disabled?: boolean
}

/** Interruptor (role="switch") com rótulo. */
export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  const id = useId()
  return (
    <div className={cn('flex min-h-14 items-center gap-3 px-4 py-2.5', disabled && 'opacity-60')}>
      <label htmlFor={id} className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{label}</span>
        {description && <span className="text-sm text-muted">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-primary' : 'bg-neutral-soft ring-1 ring-inset ring-line',
        )}
      >
        <span
          aria-hidden
          className={cn('absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform duration-200', checked && 'translate-x-5')}
        />
      </button>
    </div>
  )
}

interface SegmentedProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}

/** Escolha entre 2–4 opções lado a lado. */
export function Segmented<T extends string>({ value, options, onChange, label }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-neutral-soft p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-10 flex-1 rounded-lg px-2 text-sm font-semibold transition-colors',
            value === o.value ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface ChipProps {
  selected: boolean
  onClick: () => void
  children: ReactNode
  color?: string
}

/** Botão de escolha em forma de pílula. */
export function Chip({ selected, onClick, children, color }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
        selected ? 'border-primary bg-primary-soft text-primary-ink' : 'border-line bg-surface text-ink hover:bg-surface-2',
      )}
    >
      {selected ? (
        <Check aria-hidden className="size-4" />
      ) : (
        color && <span aria-hidden className="size-2.5 rounded-full" style={{ background: color }} />
      )}
      {children}
    </button>
  )
}

export function ChipRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {children}
    </div>
  )
}
