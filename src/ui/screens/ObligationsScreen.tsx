import { CircleCheck, Info, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { addDays, formatDateShort, formatPeriodPT, isoParts, periodOf } from '../../domain/dates'
import { listOccurrences, type Occurrence } from '../../domain/obligations'
import { useData } from '../../data/app'
import { IconButton } from '../components/Button'
import { cn } from '../components/cn'
import { AppBar, Card, EmptyState, ListCard, Page, Section } from '../components/Layout'
import { Badge, Money } from '../components/Status'
import { useToday } from '../hooks'
import { dueLabel } from '../logic/relative'
import { ruleIcon } from '../obligationIcons'
import { ObligationSheet } from '../sheets/ObligationSheet'

const DONE_TEXT = { pagamento: 'Pago', declaracao: 'Entregue', outro: 'Feito' } as const

/** Linha de uma obrigação (usada também no Início e no Calendário). */
export function ObligationRow({ occ, today, onOpen }: { occ: Occurrence; today: string; onOpen: () => void }) {
  const Icon = ruleIcon(occ.rule)
  const done = occ.state === 'done' || occ.state === 'notApplicable'
  return (
    <button type="button" onClick={onOpen} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl',
          done ? 'bg-neutral-soft text-faint' : occ.state === 'overdue' ? 'bg-danger-soft text-danger' : 'bg-neutral-soft text-muted',
        )}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('font-medium leading-snug', done && 'text-muted line-through decoration-faint')}>{occ.rule.title}</span>
        <span className="text-sm text-muted">
          até {formatDateShort(occ.dueDate)}
          {!done && (
            <>
              {' · '}
              <span className={occ.state === 'overdue' ? 'font-semibold text-danger' : occ.state === 'today' ? 'font-semibold text-warning' : undefined}>
                {dueLabel(today, occ.dueDate)}
              </span>
            </>
          )}
        </span>
      </span>
      {done ? (
        <Badge tone="success" icon={CircleCheck}>
          {occ.state === 'notApplicable' ? 'Não se aplica' : DONE_TEXT[occ.rule.kind]}
        </Badge>
      ) : occ.state === 'overdue' ? (
        <Badge tone="danger">Em atraso</Badge>
      ) : null}
    </button>
  )
}

export function ObligationsScreen() {
  const data = useData()
  const today = useToday()
  const [occ, setOcc] = useState<Occurrence | null>(null)
  const [showDone, setShowDone] = useState(false)

  const { overdue, upcomingByMonth, done, paidThisYear } = useMemo(() => {
    const all = listOccurrences(data, addDays(today, -400), addDays(today, 366), today)
    const overdue = all.filter((o) => o.state === 'overdue')
    const upcoming = all.filter((o) => o.state === 'today' || o.state === 'upcoming')
    const upcomingByMonth = new Map<string, Occurrence[]>()
    for (const o of upcoming) {
      const p = periodOf(o.dueDate)
      upcomingByMonth.set(p, [...(upcomingByMonth.get(p) ?? []), o])
    }
    const done = all.filter((o) => o.state === 'done' || o.state === 'notApplicable').reverse()
    const year = String(isoParts(today)[0])
    const paidThisYear = data.obligationRecords
      .filter((r) => r.status === 'done' && r.amountPaid && (r.date ?? r.originalDate).startsWith(year))
      .reduce((s, r) => s + (r.amountPaid ?? 0), 0)
    return { overdue, upcomingByMonth, done, paidThisYear }
  }, [data, today])

  const hasRules = data.obligationRules.some((r) => r.active)

  return (
    <>
      <AppBar title="Obrigações" actions={<IconButton icon={SlidersHorizontal} label="Gerir prazos" to="/obrigacoes/prazos" />} />
      <Page withNav>
        <Card className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm text-muted">Pago ao Estado em {isoParts(today)[0]}</span>
          <Money cents={paidThisYear} className="text-lg font-bold" />
        </Card>

        {!hasRules && (
          <Card>
            <EmptyState icon={SlidersHorizontal} title="Sem prazos ativos" text="Ativa ou cria prazos em «Gerir prazos»." />
          </Card>
        )}

        {overdue.length > 0 && (
          <Section title="Em atraso">
            <ListCard>
              {overdue.map((o) => (
                <ObligationRow key={o.rule.id + o.originalDate} occ={o} today={today} onOpen={() => setOcc(o)} />
              ))}
            </ListCard>
          </Section>
        )}

        {[...upcomingByMonth.entries()].map(([period, list]) => (
          <Section key={period} title={formatPeriodPT(period).replace(/^./, (c) => c.toUpperCase())}>
            <ListCard>
              {list.map((o) => (
                <ObligationRow key={o.rule.id + o.originalDate} occ={o} today={today} onOpen={() => setOcc(o)} />
              ))}
            </ListCard>
          </Section>
        ))}

        {done.length > 0 && (
          <Section
            title="Feitas"
            action={
              <button type="button" onClick={() => setShowDone((v) => !v)} className="rounded-lg px-2 py-1.5 text-sm font-semibold text-primary-ink">
                {showDone ? 'Esconder' : `Mostrar (${done.length})`}
              </button>
            }
          >
            {showDone && (
              <ListCard>
                {done.map((o) => (
                  <ObligationRow key={o.rule.id + o.originalDate} occ={o} today={today} onOpen={() => setOcc(o)} />
                ))}
              </ListCard>
            )}
          </Section>
        )}

        <p className="flex gap-2 px-1 text-xs leading-relaxed text-muted">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          Prazos de referência (2026). Se o prazo calhar a um fim de semana ou feriado, passa para o dia útil seguinte; a app mostra a data
          normal para teres margem. Confirma sempre no Portal das Finanças e na Segurança Social Direta.
        </p>
      </Page>
      <ObligationSheet occ={occ} onClose={() => setOcc(null)} />
    </>
  )
}
