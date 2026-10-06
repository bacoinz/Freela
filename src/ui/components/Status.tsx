import { CircleAlert, CircleCheck, Clock, Hourglass, type LucideIcon } from 'lucide-react'
import { formatMoney } from '../../domain/money'
import { STATUS_LABEL, type JobStatus } from '../../domain/jobs'
import type { Cents } from '../../domain/types'
import { cn } from './cn'

const STATUS_STYLE: Record<JobStatus, { cls: string; icon: LucideIcon }> = {
  received: { cls: 'bg-success-soft text-success', icon: CircleCheck },
  overdue: { cls: 'bg-danger-soft text-danger', icon: CircleAlert },
  partial: { cls: 'bg-warning-soft text-warning', icon: Hourglass },
  pending: { cls: 'bg-info-soft text-info', icon: Clock },
}

/** Estado com ícone + texto (nunca só cor). */
export function StatusBadge({ status, label }: { status: JobStatus; label?: string }) {
  const { cls, icon: Icon } = STATUS_STYLE[status]
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-semibold', cls)}>
      <Icon aria-hidden className="size-3.5" />
      {label ?? STATUS_LABEL[status]}
    </span>
  )
}

export function Badge({ tone, icon: Icon, children }: { tone: 'success' | 'danger' | 'warning' | 'info' | 'neutral'; icon?: LucideIcon; children: React.ReactNode }) {
  const cls = {
    success: 'bg-success-soft text-success',
    danger: 'bg-danger-soft text-danger',
    warning: 'bg-warning-soft text-warning',
    info: 'bg-info-soft text-info',
    neutral: 'bg-neutral-soft text-muted',
  }[tone]
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-semibold', cls)}>
      {Icon && <Icon aria-hidden className="size-3.5" />}
      {children}
    </span>
  )
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-soft">
      <div className="h-full rounded-full bg-success transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  )
}

/**
 * Valor em euros. Algarismos alinhados (tabulares) por defeito, para listas;
 * `display` usa algarismos proporcionais (números grandes e destacados).
 */
export function Money({ cents, className, compact, display }: { cents: Cents; className?: string; compact?: boolean; display?: boolean }) {
  return <span className={cn(!display && 'tnum', 'whitespace-nowrap', className)}>{formatMoney(cents, { compactCents: compact })}</span>
}
