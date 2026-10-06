import { CalendarDays } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { calendarEvents, monthGrid, monthSummary, type CalendarEvent } from '../../domain/calendar'
import { formatDateLong, isoParts, periodOf, WEEKDAYS_SHORT_PT } from '../../domain/dates'
import type { Occurrence } from '../../domain/obligations'
import type { CalendarColorMode } from '../../domain/types'
import { commit, useData } from '../../data/app'
import { cn } from '../components/cn'
import { Segmented } from '../components/Form'
import { AppBar, Card, EmptyState, ListCard, Page, Section } from '../components/Layout'
import { MonthSwitcher } from '../components/Nav'
import { PayerAvatar } from '../components/Payer'
import { Money } from '../components/Status'
import { useToday } from '../hooks'
import { ObligationSheet } from '../sheets/ObligationSheet'
import { ReceiveSheet, type ReceiveTarget } from '../sheets/ReceiveSheet'
import { ReceiveButton } from './HomeScreen'
import { ObligationRow } from './ObligationsScreen'

const isDone = (e: CalendarEvent) => e.kind === 'obligation' && (e.state === 'done' || e.state === 'notApplicable')

function Dot({ e, mode }: { e: CalendarEvent; mode: CalendarColorMode }) {
  if (e.kind === 'obligation') {
    return <span className={cn('size-2 rounded-[2px]', isDone(e) ? 'bg-faint' : 'bg-danger')} />
  }
  if (mode === 'payer') {
    return e.kind === 'received' ? (
      <span className="size-2 rounded-full" style={{ background: e.color }} />
    ) : (
      <span className="size-2 rounded-full border-2" style={{ borderColor: e.color }} />
    )
  }
  if (e.kind === 'received') return <span className="size-2 rounded-full bg-success" />
  return <span className={cn('size-2 rounded-full', e.overdue ? 'bg-warning' : 'bg-info')} />
}

export function CalendarScreen() {
  const data = useData()
  const today = useToday()
  const [period, setPeriod] = useState(periodOf(today))
  const [selected, setSelected] = useState<string | null>(today)
  const [receiving, setReceiving] = useState<ReceiveTarget | null>(null)
  const [occ, setOcc] = useState<Occurrence | null>(null)
  const mode = data.settings.calendarColorMode

  const weeks = useMemo(() => monthGrid(period), [period])
  const events = useMemo(() => calendarEvents(data, period, today), [data, period, today])
  const summary = useMemo(() => monthSummary(events), [events])
  const day = selected && periodOf(selected) === period ? selected : null
  const dayEvents = day ? (events[day] ?? []) : []

  const changePeriod = (p: string) => {
    setPeriod(p)
    setSelected(p === periodOf(today) ? today : null)
  }

  return (
    <>
      <AppBar title="Calendário" />
      <Page withNav>
        <MonthSwitcher period={period} onChange={changePeriod} today={today} />
        <Segmented
          label="Cores do calendário"
          value={mode}
          onChange={(v) => commit((d) => ({ ...d, settings: { ...d.settings, calendarColorMode: v } }), { touch: false })}
          options={[
            { value: 'status', label: 'Por estado' },
            { value: 'payer', label: 'Por pagador' },
          ]}
        />

        <Card className="p-2">
          <div className="grid grid-cols-7 pb-1 text-center text-xs font-semibold text-faint" aria-hidden>
            {WEEKDAYS_SHORT_PT.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div role="grid" aria-label="Dias do mês" className="flex flex-col gap-1">
            {weeks.map((week) => (
              <div role="row" key={week[0]} className="grid grid-cols-7 gap-1">
                {week.map((d) => {
                  const inMonth = periodOf(d) === period
                  const list = inMonth ? (events[d] ?? []) : []
                  const isToday = d === today
                  const isSel = d === day
                  const dayNum = isoParts(d)[2]
                  return (
                    <button
                      role="gridcell"
                      key={d}
                      type="button"
                      disabled={!inMonth}
                      onClick={() => setSelected(d)}
                      aria-selected={isSel}
                      aria-label={`${formatDateLong(d)}${list.length ? `, ${list.length} ${list.length === 1 ? 'evento' : 'eventos'}` : ''}`}
                      className={cn(
                        'flex min-h-12 flex-col items-center gap-1 rounded-xl pb-1.5 pt-1 transition-colors',
                        inMonth ? 'hover:bg-surface-2' : 'opacity-35',
                        isSel && 'bg-primary-soft hover:bg-primary-soft',
                      )}
                    >
                      <span
                        className={cn(
                          'tnum flex size-7 items-center justify-center rounded-full text-sm',
                          isToday ? 'bg-primary font-bold text-white' : 'font-medium',
                        )}
                      >
                        {dayNum}
                      </span>
                      <span className="flex h-2 items-center gap-0.5">
                        {list.slice(0, 3).map((e, i) => (
                          <Dot key={i} e={e} mode={mode} />
                        ))}
                        {list.length > 3 && <span className="text-[9px] font-bold leading-none text-muted">+</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </Card>

        <Legend mode={mode} />

        <Section title={day ? formatDateLong(day) : 'Escolhe um dia'}>
          {!day ? (
            <Card>
              <EmptyState icon={CalendarDays} title="Toca num dia" text="Mostra o que recebeste, o que está previsto e os prazos desse dia." />
            </Card>
          ) : dayEvents.length === 0 ? (
            <Card>
              <p className="px-4 py-4 text-sm text-muted">Nada neste dia.</p>
            </Card>
          ) : (
            <ListCard>
              {dayEvents.map((e, i) =>
                e.kind === 'obligation' ? (
                  <ObligationRow key={i} occ={e.occurrence} today={today} onOpen={() => setOcc(e.occurrence)} />
                ) : (
                  <div key={i} className="flex min-h-16 items-center gap-3 px-4 py-3">
                    <Link to={e.jobId ? `/trabalhos/${e.jobId}` : '/definicoes/fixos'} className="flex min-w-0 flex-1 items-center gap-3">
                      <PayerAvatar name={e.payer || e.title} color={e.color} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{e.title}</span>
                        <span className="truncate text-sm text-muted">
                          {e.kind === 'received'
                            ? `Recebido · ${data.methods.find((m) => m.id === e.methodId)?.name ?? ''}`
                            : e.virtual
                              ? 'Rendimento fixo previsto'
                              : e.overdue
                                ? 'Previsto · em atraso'
                                : 'Previsto'}
                        </span>
                      </span>
                      <Money cents={e.amount} className={e.kind === 'received' ? 'font-semibold text-success' : 'font-semibold'} />
                    </Link>
                    {e.kind === 'expected' && !e.virtual && e.jobId && e.installmentId && (
                      <ReceiveButton onClick={() => setReceiving({ jobId: e.jobId!, installmentId: e.installmentId! })} />
                    )}
                  </div>
                ),
              )}
            </ListCard>
          )}
        </Section>

        <Card className="grid grid-cols-3 divide-x divide-line">
          <SummaryCell label="Recebido" value={<Money cents={summary.received} compact />} />
          <SummaryCell label="Previsto" value={<Money cents={summary.expected} compact />} />
          <SummaryCell label="Prazos por fazer" value={<span className="tnum">{summary.obligationsPending}</span>} />
        </Card>
      </Page>
      <ReceiveSheet target={receiving} onClose={() => setReceiving(null)} />
      <ObligationSheet occ={occ} onClose={() => setOcc(null)} />
    </>
  )
}

function SummaryCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-3 text-center">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-[15px] font-bold">{value}</span>
    </div>
  )
}

function Legend({ mode }: { mode: CalendarColorMode }) {
  const item = (dot: React.ReactNode, text: string) => (
    <span className="inline-flex items-center gap-1.5">
      {dot}
      {text}
    </span>
  )
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-xs text-muted">
      {mode === 'status' ? (
        <>
          {item(<span className="size-2 rounded-full bg-success" />, 'Recebido')}
          {item(<span className="size-2 rounded-full bg-info" />, 'Previsto')}
          {item(<span className="size-2 rounded-full bg-warning" />, 'Em atraso')}
        </>
      ) : (
        <>
          {item(<span className="size-2 rounded-full bg-muted" />, 'Recebido (cor do pagador)')}
          {item(<span className="size-2 rounded-full border-2 border-muted" />, 'Previsto')}
        </>
      )}
      {item(<span className="size-2 rounded-[2px] bg-danger" />, 'Prazo por fazer')}
      {item(<span className="size-2 rounded-[2px] bg-faint" />, 'Prazo feito')}
    </div>
  )
}
