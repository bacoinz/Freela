import { ChevronRight, Circle, CircleCheck, PiggyBank, Plus, Repeat, Settings, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { formatDateShort, formatDayMonth, formatPeriodPT, periodOf } from '../../domain/dates'
import { paidCount } from '../../domain/installments'
import { currentPlan, pctText } from '../../domain/invest'
import { formatMoney } from '../../domain/money'
import { payerColor, payerLabel } from '../../domain/payers'
import type { Occurrence } from '../../domain/obligations'
import { useData } from '../../data/app'
import { Fab, IconButton } from '../components/Button'
import { cn } from '../components/cn'
import { AppBar, Card, EmptyState, ListCard, Page, Section, TextLink } from '../components/Layout'
import { MonthSwitcher } from '../components/Nav'
import { PayerAvatar } from '../components/Payer'
import { Badge, Money } from '../components/Status'
import { useToday } from '../hooks'
import { monthOverview, type PendingItem } from '../logic/home'
import { dueLabel, sinceLabel } from '../logic/relative'
import { ObligationRow } from './ObligationsScreen'
import { ObligationSheet } from '../sheets/ObligationSheet'
import { ReceiveSheet, type ReceiveTarget } from '../sheets/ReceiveSheet'

export function HomeScreen() {
  const data = useData()
  const today = useToday()
  const [period, setPeriod] = useState(periodOf(today))
  const [receiving, setReceiving] = useState<ReceiveTarget | null>(null)
  const [occ, setOcc] = useState<Occurrence | null>(null)
  const o = useMemo(() => monthOverview(data, period, today), [data, period, today])
  const month = formatPeriodPT(period).split(' de ')[0]
  const methodName = (id?: string) => data.methods.find((m) => m.id === id)?.name ?? ''


  return (
    <>
      <AppBar title="Freela" logo={<img src="/icon.svg" alt="" className="size-8 rounded-[9px]" />} actions={<IconButton icon={Settings} label="Definições" to="/definicoes" />} />
      <Page withNav>
        <MonthSwitcher period={period} onChange={setPeriod} today={today} />

        <Card className="p-5">
          <p className="text-sm font-medium text-muted">Recebido em {month}</p>
          <Money cents={o.received} display className="mt-1 block text-[34px] font-bold leading-tight tracking-tight" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <InvestStat pct={currentPlan(data, today).pct} pending={o.investPending} pendingMonth={o.investPendingMonth} />
            <MiniStat icon={Wallet} label="Fica para ti" cents={o.kept} tone="success" />
          </div>
          {o.statePaid > 0 && (
            <p className="mt-3 text-sm text-muted">
              Pago ao Estado este mês: <Money cents={o.statePaid} className="font-semibold text-ink" />
            </p>
          )}
        </Card>

        <Section title="A receber" action={o.pending.count > 0 && <TextLink to="/trabalhos">Ver tudo</TextLink>}>
          {o.pending.count === 0 ? (
            <Card>
              <EmptyState icon={CircleCheck} title="Está tudo recebido" text="Os trabalhos por receber aparecem aqui." />
            </Card>
          ) : (
            <>
              <p className="px-1 text-sm text-muted">
                <Money cents={o.pending.total} className="font-semibold text-ink" /> em {o.pending.count}{' '}
                {o.pending.count === 1 ? 'trabalho' : 'trabalhos'}
                {o.pending.overdueCount > 0 && (
                  <span className="font-semibold text-danger"> · {o.pending.overdueCount} em atraso</span>
                )}
              </p>
              <ListCard>
                {o.pending.items.slice(0, 5).map((item) => (
                  <PendingRow
                    key={item.job.id}
                    item={item}
                    today={today}
                    payer={payerLabel(item.job, data.payers)}
                    color={payerColor(item.job, data.payers)}
                    receiving={receiving?.installmentId === item.installment.id}
                    onReceive={() => setReceiving({ jobId: item.job.id, installmentId: item.installment.id })}
                  />
                ))}
              </ListCard>
            </>
          )}
        </Section>

        <Section title="Próximos prazos" action={<TextLink to="/obrigacoes">Ver tudo</TextLink>}>
          {o.nextObligations.length === 0 ? (
            <Card>
              <EmptyState icon={CircleCheck} title="Sem prazos nos próximos 30 dias" />
            </Card>
          ) : (
            <ListCard>
              {o.nextObligations.slice(0, 3).map((x) => (
                <ObligationRow key={x.rule.id + x.originalDate} occ={x} today={today} onOpen={() => setOcc(x)} />
              ))}
            </ListCard>
          )}
        </Section>

        {o.fixed.length > 0 && (
          <Section title="Rendimento fixo">
            <ListCard>
              {o.fixed.map((f) => (
                <div key={f.recurringId} className="flex min-h-16 items-center gap-3 px-4 py-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-neutral-soft text-muted">
                    <Repeat aria-hidden className="size-5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{f.title}</span>
                    <span className="text-sm text-muted">
                      <Money cents={f.amount} /> · {f.period !== period && `${formatPeriodPT(f.period).split(' de ')[0]} · `}
                      {f.received ? 'recebido' : `previsto ${formatDayMonth(f.dueDate)}`}
                    </span>
                  </div>
                  {f.received ? (
                    <Badge tone="success" icon={CircleCheck}>
                      Recebido
                    </Badge>
                  ) : (
                    f.jobId && (
                      <ReceiveButton
                        active={receiving?.jobId === f.jobId}
                        onClick={() => {
                          const job = data.jobs.find((j) => j.id === f.jobId)
                          const inst = job?.installments.find((i) => !i.receivedDate)
                          if (job && inst) setReceiving({ jobId: job.id, installmentId: inst.id })
                        }}
                      />
                    )
                  )}
                </div>
              ))}
            </ListCard>
          </Section>
        )}

        {o.recent.length > 0 && (
          <Section title="Últimos recebimentos">
            <ListCard>
              {o.recent.map(({ job, installment }) => (
                <Link key={installment.id} to={`/trabalhos/${job.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <PayerAvatar name={payerLabel(job, data.payers)} color={payerColor(job, data.payers)} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{job.title}</span>
                    <span className="truncate text-sm text-muted">
                      {sinceLabel(today, installment.receivedDate!)} · {methodName(installment.methodId)}
                    </span>
                  </div>
                  <Money cents={installment.amount} className="font-semibold text-success" />
                </Link>
              ))}
            </ListCard>
          </Section>
        )}
      </Page>
      <Fab to="/trabalhos/novo" label="Trabalho" icon={Plus} />
      <ReceiveSheet target={receiving} onClose={() => setReceiving(null)} />
      <ObligationSheet occ={occ} onClose={() => setOcc(null)} />
    </>
  )
}

function MiniStat({ icon: Icon, label, cents }: { icon: typeof Wallet; label: string; cents: number; tone: 'success' }) {
  return (
    <div className="rounded-xl bg-success-soft px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
        <Icon aria-hidden className="size-4" />
        {label}
      </p>
      <Money cents={cents} display className="mt-0.5 block text-lg font-bold" />
    </div>
  )
}

/** Botão para marcar um pagamento como recebido: cinzento; fica verde ao tocar (e enquanto a folha está aberta). */
export function ReceiveButton({ onClick, active = false }: { onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors',
        active ? 'bg-success-soft text-success' : 'bg-neutral-soft text-ink active:bg-success-soft active:text-success',
      )}
    >
      {active ? <CircleCheck aria-hidden className="size-4" /> : <Circle aria-hidden className="size-4" />}
      Recebido
    </button>
  )
}

/** Cartão «Para investir» do Início: mostra o que falta investir e abre a página do investimento. */
function InvestStat({ pct, pending, pendingMonth }: { pct: number; pending: number; pendingMonth: number }) {
  return (
    <Link
      to="/investir"
      aria-label={`Para investir: ${formatMoney(pending)}. Abrir o investimento`}
      className="flex flex-col rounded-xl bg-info-soft px-3 py-2.5 ring-1 ring-info/30 transition hover:brightness-95 active:scale-[0.98]"
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold text-info">
        <PiggyBank aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">Para investir ({pctText(pct)}%)</span>
        <ChevronRight aria-hidden className="-mr-1 size-4 shrink-0" />
      </span>
      <Money cents={pending} display className="mt-0.5 block text-lg font-bold" />
      <span className="text-xs text-info">
        {pending > 0 && (pendingMonth > 0 ? `deste mês: ${formatMoney(pendingMonth)}` : 'de meses anteriores')}
      </span>
    </Link>
  )
}

function PendingRow({ item, today, payer, color, receiving, onReceive }: { item: PendingItem; today: string; payer: string; color: string; receiving: boolean; onReceive: () => void }) {
  const { job, installment } = item
  const n = job.installments.length
  return (
    <div className="flex min-h-16 items-center gap-3 px-4 py-3">
      <Link to={`/trabalhos/${job.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <PayerAvatar name={payer} color={color} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{job.title}</span>
          <span className="text-sm text-muted">
            <Money cents={installment.amount} className="font-semibold text-ink" />
            {job.period && ` · ${formatPeriodPT(job.period).split(' de ')[0]}`}
            {n > 1 && ` · ${paidCount(job)}/${n} pagos`}
            {' · '}
            <span className={item.overdue ? 'font-medium text-danger' : undefined}>
              {installment.dueDate ? dueLabel(today, installment.dueDate) : `desde ${formatDateShort(job.workDate)}`}
            </span>
          </span>
        </span>
      </Link>
      <ReceiveButton onClick={onReceive} active={receiving} />
    </div>
  )
}
