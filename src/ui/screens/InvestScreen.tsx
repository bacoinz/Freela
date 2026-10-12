import { CheckCheck, Circle, CircleCheck, PiggyBank, Plus, RotateCcw, X } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { addMonths, formatDateShort, formatPeriodPT, periodOf } from '../../domain/dates'
import { currentPlan, investOverview, pctText, type PendingInvestItem } from '../../domain/invest'
import { formatMoney } from '../../domain/money'
import { markInvested, setInvestPlan, undoInvested } from '../../domain/ops'
import type { InvestPart, InvestPlan } from '../../domain/types'
import { commit, useData } from '../../data/app'
import { uuid } from '../../data/ids'
import { Button, IconButton } from '../components/Button'
import { cn } from '../components/cn'
import { confirm, toast, toastError } from '../components/Feedback'
import { Field, inputClass } from '../components/Form'
import { AppBar, Card, EmptyState, ListCard, Page, Section } from '../components/Layout'
import { Money } from '../components/Status'
import { useToday } from '../hooks'

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
      <AppBar title="Investimento" back="/" />
      <Page>
        <Card className="p-5">
          <p className="text-sm font-medium text-muted">Por investir</p>
          <Money cents={o.pendingTotal} display className="mt-1 block text-[34px] font-bold leading-tight tracking-tight" />
          <p className="mt-1 text-sm text-muted">
            {pctText(plan.pct)}% de cada pagamento recebido ·{' '}
            <Link to="/definicoes" className="font-semibold text-primary-ink underline">
              mudar nas Definições
            </Link>
          </p>
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

        <Section title="Divisão do investimento">
          <PlanEditor plan={plan} plans={data.settings.investPlans} period={periodOf(today)} />
        </Section>

        <Section title="Já investido">
          <Card className="p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted">Desde o início</span>
              <Money cents={o.investedTotal} className="text-xl font-bold" />
            </div>
            {o.investedParts.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {o.investedParts.map((p) => (
                  <li key={p.destinationId} className="flex justify-between gap-3">
                    <span className="text-muted">{p.name}</span>
                    <Money cents={p.amount} className="font-semibold" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {o.recent.length > 0 && (
            <ListCard>
              {o.recent.map(({ job, installment }) => (
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

interface DestRow {
  key: string
  id: string
  name: string
  where: string
  pct: string
}

const num = (t: string) => Number(t.trim().replace(',', '.'))
const toRows = (plan: InvestPlan): DestRow[] =>
  plan.destinations.map((d) => ({ key: uuid(), id: d.id, name: d.name, where: d.where ?? '', pct: pctText(d.pct) }))

/** Edita a % para investir e os destinos; grava para o mês atual (os anteriores ficam como estavam). */
function PlanEditor({ plan, plans, period }: { plan: InvestPlan; plans: InvestPlan[]; period: string }) {
  const ids = { pct: useId() }
  const [pct, setPct] = useState(pctText(plan.pct))
  const [rows, setRows] = useState<DestRow[]>(() => toRows(plan))
  const planKey = JSON.stringify(plan)
  useEffect(() => {
    setPct(pctText(plan.pct))
    setRows(toRows(plan))
    // Recomeça quando o plano guardado muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey])

  const sum = Math.round(rows.reduce((s, r) => s + (Number.isFinite(num(r.pct)) ? num(r.pct) : 0), 0) * 100) / 100
  const update = (key: string, patch: Partial<DestRow>) => setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const add = () => setRows((cur) => [...cur, { key: uuid(), id: '', name: '', where: '', pct: pctText(Math.max(0, 100 - sum)) }])
  const remove = (key: string) => setRows((cur) => cur.filter((r) => r.key !== key))

  const save = () => {
    try {
      commit((d, ctx) =>
        setInvestPlan(d, { pct: num(pct), destinations: rows.map((r) => ({ id: r.id, name: r.name, where: r.where, pct: num(r.pct) })) }, ctx),
      )
      toast(`Guardado — conta a partir de ${formatPeriodPT(period)}`)
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-3 p-4">
        <Field label="Percentagem para investir" htmlFor={ids.pct} hint="De cada pagamento recebido.">
          <div className="flex items-center gap-2">
            <input id={ids.pct} inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} className={cn(inputClass, 'tnum h-11 w-20 text-center')} />
            <span className="text-muted">%</span>
          </div>
        </Field>
      </Card>
      {rows.map((r, i) => (
        <DestinationEditor
          key={r.key}
          row={r}
          index={i}
          canRemove={rows.length > 1}
          onChange={(patch) => update(r.key, patch)}
          onRemove={() => remove(r.key)}
        />
      ))}
      <Button variant="tonal" icon={Plus} onClick={add} disabled={rows.length >= 10}>
        Acrescentar destino
      </Button>
      <p className={cn('px-1 text-sm font-medium', sum === 100 ? 'text-success' : 'text-warning')}>
        Os destinos somam {pctText(sum)}%
        {sum === 100 ? ' ✓' : sum < 100 ? ` — faltam ${pctText(100 - sum)}%` : ` — sobram ${pctText(sum - 100)}%`}
      </p>
      <Button icon={CircleCheck} onClick={save}>
        Guardar
      </Button>
      <p className="px-1 text-sm text-muted">
        Conta a partir de {formatPeriodPT(period)}. Os meses anteriores mantêm a % e a divisão que tinham, e o que já marcaste como investido não muda.
      </p>
      {plans.length > 1 && <PlanHistory plans={plans} />}
    </div>
  )
}

function DestinationEditor({
  row,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  row: DestRow
  index: number
  canRemove: boolean
  onChange: (patch: Partial<DestRow>) => void
  onRemove: () => void
}) {
  const ids = { name: useId(), where: useId(), pct: useId() }
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold">
          <PiggyBank aria-hidden className="size-4 text-info" />
          Destino {index + 1}
        </span>
        {canRemove && <IconButton icon={X} label={`Remover o destino ${index + 1}`} onClick={onRemove} className="-my-2 -mr-2" />}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Nome" htmlFor={ids.name}>
          <input id={ids.name} value={row.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Ex.: Conta poupança" className={inputClass} />
        </Field>
        <Field label="%" htmlFor={ids.pct}>
          <input id={ids.pct} inputMode="decimal" value={row.pct} onChange={(e) => onChange({ pct: e.target.value })} className={cn(inputClass, 'tnum w-20 text-center')} />
        </Field>
      </div>
      <Field label="Onde" htmlFor={ids.where} optional>
        <input id={ids.where} value={row.where} onChange={(e) => onChange({ where: e.target.value })} placeholder="Ex.: CGD, Binance…" className={inputClass} />
      </Field>
    </Card>
  )
}

/** Planos ao longo do tempo: «Até setembro: 15% (…) · Desde outubro: 20% (…)». */
function PlanHistory({ plans }: { plans: InvestPlan[] }) {
  return (
    <Card className="p-4">
      <p className="text-sm font-semibold">Histórico</p>
      <ul className="mt-2 flex flex-col gap-2 text-sm">
        {plans.map((p, i) => {
          const next = plans[i + 1]
          const when =
            i === 0 ? `Até ${formatPeriodPT(addMonths(next!.from, -1))}` : next ? `${cap(formatPeriodPT(p.from))} a ${formatPeriodPT(addMonths(next.from, -1))}` : `Desde ${formatPeriodPT(p.from)}`
          return (
            <li key={p.from} className="flex flex-col">
              <span className="font-medium">
                {when}: {pctText(p.pct)}%
              </span>
              <span className="text-muted">{p.destinations.map((d) => `${d.name} ${pctText(d.pct)}%`).join(' · ')}</span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
