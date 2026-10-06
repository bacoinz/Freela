import { LoaderCircle, type LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from './cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline' | 'tonal'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:brightness-110',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  ghost: 'text-primary-ink hover:bg-primary-soft',
  danger: 'bg-danger-strong text-white hover:brightness-110',
  'danger-outline': 'bg-surface text-danger border border-line hover:bg-danger-soft',
  tonal: 'bg-primary-soft text-primary-ink hover:brightness-95',
}

const SIZES: Record<Size, string> = {
  sm: 'h-10 px-3 text-sm rounded-xl',
  md: 'h-12 px-4 text-[15px] rounded-xl',
  lg: 'h-14 px-5 text-base rounded-2xl',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  loading?: boolean
  block?: boolean
}

export function Button({ variant = 'primary', size = 'md', icon: Icon, loading, block, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 font-semibold transition-[filter,background-color,transform] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
    >
      {loading ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : Icon && <Icon aria-hidden className="size-5" />}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  label: string
  to?: string
  tone?: 'default' | 'danger'
}

/** Botão só com ícone (área de toque 44×44) — tem sempre um texto acessível. */
export function IconButton({ icon: Icon, label, to, tone = 'default', className, ...rest }: IconButtonProps) {
  const cls = cn(
    'inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-neutral-soft active:bg-neutral-soft',
    tone === 'danger' ? 'text-danger' : 'text-ink',
    className,
  )
  if (to) {
    return (
      <Link to={to} aria-label={label} title={label} className={cls}>
        <Icon aria-hidden className="size-[22px]" />
      </Link>
    )
  }
  return (
    <button type="button" aria-label={label} title={label} className={cls} {...rest}>
      <Icon aria-hidden className="size-[22px]" />
    </button>
  )
}

/** Botão flutuante (ação principal do ecrã), por cima da barra de navegação. */
export function Fab({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 z-30 mx-auto flex max-w-xl justify-end px-4" style={{ bottom: 'calc(var(--nav-h) + var(--sab) + 16px)' }}>
      <Link
        to={to}
        className="pointer-events-auto inline-flex h-14 items-center gap-2 rounded-2xl bg-primary pl-4 pr-5 font-semibold text-white shadow-float transition-transform active:scale-[0.97]"
      >
        <Icon aria-hidden className="size-6" />
        {label}
      </Link>
    </div>
  )
}

/** Barra fixa no fundo com o botão principal de um formulário. */
export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95" style={{ paddingBottom: 'calc(var(--sab) + 12px)' }}>
      <div className="mx-auto flex max-w-xl gap-3 px-4 pt-3">{children}</div>
    </div>
  )
}
