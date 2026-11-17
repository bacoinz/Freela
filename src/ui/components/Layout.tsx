import { ArrowLeft, ChevronRight, type LucideIcon, ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { IconButton } from './Button'
import { cn } from './cn'

/** Volta atrás; se não houver histórico (ex.: veio de uma notificação), vai para `fallback`. */
export function useGoBack(fallback = '/') {
  const navigate = useNavigate()
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }
}

interface AppBarProps {
  title: string
  /** Mostra o botão "voltar" (com o destino quando não há histórico). */
  back?: string
  actions?: ReactNode
  /** Imagem/ícone antes do título (ex.: o logótipo no Início). */
  logo?: ReactNode
}

export function AppBar({ title, back, actions, logo }: AppBarProps) {
  const goBack = useGoBack(back)
  return (
    <header className="sticky top-0 z-30 bg-bg" style={{ paddingTop: 'var(--sat)' }}>
      <div className="mx-auto flex h-14 max-w-xl items-center gap-1 px-2">
        {back !== undefined && <IconButton icon={ArrowLeft} label="Voltar" onClick={goBack} />}
        {logo && <span className="ml-2 flex shrink-0 items-center">{logo}</span>}
        <h1 className={cn('min-w-0 flex-1 truncate font-bold tracking-tight', back !== undefined ? 'text-lg' : 'px-2 text-[22px]')}>
          {title}
        </h1>
        {actions}
      </div>
    </header>
  )
}

/** Conteúdo de um ecrã. `withNav` reserva espaço para a barra de navegação + botão flutuante. */
export function Page({ children, withNav, withBottomBar, className }: { children: ReactNode; withNav?: boolean; withBottomBar?: boolean; className?: string }) {
  const bottom = withNav
    ? 'calc(var(--nav-h) + var(--sab) + 96px)'
    : withBottomBar
      ? 'calc(var(--sab) + 96px)'
      : 'calc(var(--sab) + 32px)'
  return (
    <main className={cn('mx-auto flex max-w-xl flex-col gap-5 px-4 pt-2', className)} style={{ paddingBottom: bottom }}>
      {children}
    </main>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl border border-line bg-surface shadow-card', className)}>{children}</div>
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex min-h-8 items-center justify-between gap-2 px-1">
        <h2 className="text-[15px] font-semibold text-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="-mr-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-primary-ink hover:bg-primary-soft">
      {children}
    </Link>
  )
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
      <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-neutral-soft text-muted">
        <Icon aria-hidden className="size-6" />
      </div>
      <p className="font-semibold">{title}</p>
      {text && <p className="text-sm text-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

interface ListRowProps {
  icon?: LucideIcon
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  to?: string
  /** Link externo: abre fora da app (no browser). */
  href?: string
  onClick?: () => void
  chevron?: boolean
  className?: string
}

/** Linha de lista tocável (definições, listas simples). */
export function ListRow({ icon: Icon, leading, title, subtitle, right, to, href, onClick, chevron, className }: ListRowProps) {
  const content = (
    <>
      {leading ??
        (Icon && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-neutral-soft text-muted">
            <Icon aria-hidden className="size-5" />
          </span>
        ))}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{title}</span>
        {subtitle && <span className="text-sm text-muted">{subtitle}</span>}
      </span>
      {right}
      {href && <ExternalLink aria-hidden className="size-4 shrink-0 text-faint" />}
      {(chevron ?? !!to) && <ChevronRight aria-hidden className="size-5 shrink-0 text-faint" />}
    </>
  )
  const cls = cn('flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left', (to || href || onClick) && 'active:bg-neutral-soft hover:bg-surface-2', className)
  if (href)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {content}
      </a>
    )
  if (to)
    return (
      <Link to={to} className={cls}>
        {content}
      </Link>
    )
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {content}
      </button>
    )
  return <div className={cls}>{content}</div>
}

/** Cartão com linhas separadas por divisórias. */
export function ListCard({ children }: { children: ReactNode }) {
  return <Card className="divide-y divide-line overflow-hidden">{children}</Card>
}
