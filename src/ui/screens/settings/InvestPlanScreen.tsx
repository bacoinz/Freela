import { CircleCheck, PiggyBank, Plus, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { addMonths, formatPeriodPT, periodOf } from '../../../domain/dates'
import { currentPlan, pctText } from '../../../domain/invest'
import { setInvestPlan } from '../../../domain/ops'
import type { InvestPlan } from '../../../domain/types'
import { commit, useData } from '../../../data/app'
import { uuid } from '../../../data/ids'
import { Button, IconButton } from '../../components/Button'
import { cn } from '../../components/cn'
import { toast, toastError } from '../../components/Feedback'
import { Field, inputClass } from '../../components/Form'
import { AppBar, Card, Page } from '../../components/Layout'
import { useToday } from '../../hooks'

const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase())

/** Definições → Divisão do investimento: a % e os destinos (nome, % e onde), com o histórico. */
export function InvestPlanScreen() {
  const data = useData()
  const today = useToday()
  return (
    <>
      <AppBar title="Divisão do investimento" back="/investir" />
      <Page>
        <PlanEditor plan={currentPlan(data, today)} plans={data.settings.investPlans} period={periodOf(today)} />
      </Page>
    </>
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
