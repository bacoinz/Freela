import { CheckCheck, Circle, CircleCheck, Pencil, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { formatDateShort, formatPeriodPT } from '../../domain/dates'
import { currentPlan, investOverview, pctText, type PendingInvestItem } from '../../domain/invest'
import { formatMoney } from '../../domain/money'
import { markInvested, undoInvested } from '../../domain/ops'
import type { InvestPart } from '../../domain/types'
import { commit, useData } from '../../data/app'
import { Button, IconButton } from '../components/Button'
import { cn } from '../components/cn'
import { confirm, toast, toastError } from '../components/Feedback'
import { AppBar, Card, EmptyState, ListCard, Page, Section } from '../components/Layout'
import { Money } from '../components/Status'
import { useToday } from '../hooks'

const HISTORY_PREVIEW = 10
const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase())
const monthName = (period: string) => formatPeriodPT(period).split(' de ')[0]!
const partsText = (parts: InvestPart[]) =>
  parts
    .filter((p) => p.amount > 0)
    .map((p) => `${p.name} ${formatMoney(p.amount)}`)
    .join(' · ')

/** Página do investimento: o que falta investir (por mês), a divisão pelos destinos e o que já foi investido. */
export function InvestScreen() {
  const data = useData()
  const today = useToday()
  const o = useMemo(() => investOverview(data, today), [data, today])
  const plan = currentPlan(data, today)
  const [showAll, setShowAll] = useState(false)

  const mark = (items: PendingInvestItem[], message: string) => {
    try {
      commit((d, ctx) => markInvested(d, items.map((i) => ({ jobId: i.job.id, installmentId: i.installment.id })), ctx))
      toast(message)
    } catch (e) {
      toastError(e)
    }
  }

  const undo = async (jobId: string, installmentId: string) => {
    const ok = await confirm({ title: 'Anular o investimento?', message: 'Volta a contar como «por investir».', confirmLabel: 'Anular' })
    if (!ok) return
    commit((d, ctx) => undoInvested(d, jobId, installmentId, ctx))
    toast('Investimento anulado')
  }

  // Destinos do plano atual primeiro; depois os de planos antigos que ainda tenham valores por investir.
  const pendingFor = (id: string) => o.pendingParts.find((p) => p.destinationId === id)?.amount ?? 0
  const oldPending = o.pendingParts.filter((p) => p.amount > 0 && !plan.destinations.some((d) => d.id === p.destinationId))

  return (
    <>
      <AppBar title="Investimento" back="/" actions={<IconButton icon={Pencil} label="Editar a divisão do investimento" to="/definicoes/investimento" />} />
      <Page>
        <Card className="p-5">
          <p className="text-sm font-medium text-muted">Por investir</p>
          <Money cents={o.pendingTotal} display className="mt-1 block text-[34px] font-bold leading-tight tracking-tight" />
          <p className="mt-1 text-sm text-muted">{pctText(plan.pct)}% de cada pagamento recebido</p>
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {plan.destinations.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-sm text-muted">
                    {pctText(d.pct)}%{d.where && ` · ${d.where}`}
                  </span>
                </span>
                <Money cents={pendingFor(d.id)} className="font-semibold" />
              </li>
            ))}
            {oldPending.map((p) => (
              <li key={p.destinationId} className="flex items-center gap-3 py-2.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-sm text-muted">de um plano anterior</span>
                </span>
                <Money cents={p.amount} className="font-semibold" />
              </li>
            ))}
          </ul>
        </Card>

        <Section title="Por investir">
          {o.months.length === 0 ? (
            <Card>
              <EmptyState icon={CircleCheck} title="Está tudo investido" text="Quando receberes um pagamento, a parte para investir aparece aqui." />
            </Card>
          ) : (
            o.months.map((m) => (
              <Card key={m.period} className="overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{cap(formatPeriodPT(m.period))}</span>
                    <Money cents={m.total} className="font-bold" />
                  </div>
                  <Button
                    size="sm"
                    variant="tonal"
                    icon={CheckCheck}
                    onClick={() => mark(m.items, `Investido ${formatMoney(m.total)} de ${monthName(m.period)}`)}
                  >
                    Já investi tudo deste mês
                  </Button>
                </div>
                <div className="divide-y divide-line">
                  {m.items.map((item) => (
                    <div key={item.installment.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                      <Link to={`/trabalhos/${item.job.id}`} className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">
                          {item.job.title}
                          {item.job.period && <span className="text-muted"> · {monthName(item.job.period)}</span>}
                        </span>
                        <span className="text-sm text-muted">
                          <Money cents={item.amount} className="font-semibold text-ink" /> · recebido a {formatDateShort(item.installment.receivedDate!)}
                        </span>
                        <span className="text-xs text-muted">{partsText(item.parts)}</span>
                      </Link>
                      <MarkButton onClick={() => mark([item], `Investido ${formatMoney(item.amount)}`)} />
                    </div>
                  ))}
                </div>
              </Card>
            ))
          )}
        </Section>

        <Section title="Histórico de investimentos">
          {o.invested.length === 0 ? (
            <Card>
              <p className="px-4 py-4 text-sm text-muted">Ainda não marcaste nada como investido.</p>
            </Card>
          ) : (
            <ListCard>
              {(showAll ? o.invested : o.invested.slice(0, HISTORY_PREVIEW)).map(({ job, installment }) => (
                <div key={installment.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                  <Link to={`/trabalhos/${job.id}`} className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{job.title}</span>
                    <span className="text-sm text-muted">
                      investido a {formatDateShort(installment.invested!.date)} · {partsText(installment.invested!.parts)}
                    </span>
                  </Link>
                  <IconButton icon={RotateCcw} label="Anular investimento" onClick={() => void undo(job.id, installment.id)} />
                </div>
              ))}
            </ListCard>
          )}
          {!showAll && o.invested.length > HISTORY_PREVIEW && (
            <Button variant="secondary" onClick={() => setShowAll(true)}>
              Mostrar todos ({o.invested.length})
            </Button>
          )}
        </Section>
      </Page>
    </>
  )
}

/** Botão «Investido» de um pagamento: cinzento; fica verde ao tocar. */
function MarkButton({ onClick }: { onClick: () => void }) {
  const [pressed, setPressed] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        setPressed(true)
        onClick()
      }}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors',
        pressed ? 'bg-success-soft text-success' : 'bg-neutral-soft text-ink active:bg-success-soft active:text-success',
      )}
    >
      {pressed ? <CircleCheck aria-hidden className="size-4" /> : <Circle aria-hidden className="size-4" />}
      Investido
    </button>
  )
}

