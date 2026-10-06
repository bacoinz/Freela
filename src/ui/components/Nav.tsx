import { BriefcaseBusiness, CalendarDays, ChartColumnBig, ChevronLeft, ChevronRight, House, Landmark } from 'lucide-react'
import { NavLink } from 'react-router'
import { addMonths, formatPeriodPT, periodOf } from '../../domain/dates'
import type { ISODate, Period } from '../../domain/types'
import { IconButton } from './Button'
import { cn } from './cn'

const TABS = [
  { to: '/', label: 'Início', icon: House, end: true },
  { to: '/trabalhos', label: 'Trabalhos', icon: BriefcaseBusiness, end: false },
  { to: '/calendario', label: 'Calendário', icon: CalendarDays, end: false },
  { to: '/obrigacoes', label: 'Obrigações', icon: Landmark, end: false },
  { to: '/estatisticas', label: 'Estatísticas', icon: ChartColumnBig, end: false },
]

/** Barra de navegação principal (5 separadores). */
export function BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface"
      style={{ paddingBottom: 'var(--sab)' }}
    >
      <ul className="mx-auto flex max-w-xl" style={{ height: 'var(--nav-h)' }}>
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold', isActive ? 'text-primary-ink' : 'text-muted')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('flex h-7 w-14 items-center justify-center rounded-full transition-colors', isActive && 'bg-primary-soft')}>
                    <Icon aria-hidden className="size-[22px]" strokeWidth={isActive ? 2.4 : 2} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** ‹ outubro de 2026 › — tocar no nome volta ao mês atual. */
export function MonthSwitcher({ period, onChange, today }: { period: Period; onChange: (p: Period) => void; today: ISODate }) {
  const current = periodOf(today)
  return (
    <div className="flex items-center justify-between rounded-2xl bg-surface px-1 py-1 shadow-card ring-1 ring-line">
      <IconButton icon={ChevronLeft} label="Mês anterior" onClick={() => onChange(addMonths(period, -1))} />
      <button
        type="button"
        onClick={() => onChange(current)}
        className="min-h-11 flex-1 rounded-xl text-[15px] font-semibold first-letter:uppercase"
        aria-label={period === current ? `${formatPeriodPT(period)} (mês atual)` : `${formatPeriodPT(period)} — voltar ao mês atual`}
      >
        {formatPeriodPT(period)}
        {period !== current && <span className="ml-2 text-xs font-medium text-primary-ink">voltar a hoje</span>}
      </button>
      <IconButton icon={ChevronRight} label="Mês seguinte" onClick={() => onChange(addMonths(period, 1))} />
    </div>
  )
}
