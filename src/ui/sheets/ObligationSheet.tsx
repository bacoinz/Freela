import { CalendarClock, RotateCcw } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { formatDateLong, formatDateShort } from '../../domain/dates'
import { formatMoney } from '../../domain/money'
import { actionLabel, type Occurrence } from '../../domain/obligations'
import { markOccurrence, setOccurrenceDueDate, unmarkOccurrence } from '../../domain/ops'
import type { Cents, ObligationKind } from '../../domain/types'
import { commit, useData } from '../../data/app'
import { Button } from '../components/Button'
import { toast, toastError } from '../components/Feedback'
import { DateInput, Field, MoneyInput } from '../components/Form'
import { Sheet } from '../components/Sheet'
import { useToday } from '../hooks'
import { ruleIcon } from '../obligationIcons'
import { dueLabel } from '../logic/relative'


const DONE_TEXT: Record<ObligationKind, string> = { pagamento: 'Pago', declaracao: 'Entregue', outro: 'Feito' }

/** Ações sobre uma ocorrência de uma obrigação. */
export function ObligationSheet({ occ, onClose }: { occ: Occurrence | null; onClose: () => void }) {
  const data = useData()
  const today = useToday()
  const ids = { date: useId(), amount: useId(), due: useId() }
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState<Cents | null>(null)
  const [editingDue, setEditingDue] = useState(false)
  const [newDue, setNewDue] = useState('')

  useEffect(() => {
    if (!occ) return
    setDate(today)
    setEditingDue(false)
    setNewDue(occ.dueDate)
    const lastPaid = [...data.obligationRecords]
      .filter((r) => r.ruleId === occ.rule.id && r.amountPaid)
      .sort((a, b) => b.originalDate.localeCompare(a.originalDate))[0]?.amountPaid
    setAmount(occ.rule.defaultAmount ?? lastPaid ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occ?.rule.id, occ?.originalDate])

  if (!occ) return <Sheet open={false} onClose={onClose} title="" children={null} />

  const { rule } = occ
  const Icon = ruleIcon(rule)
  const done = occ.state === 'done' || occ.state === 'notApplicable'
  const run = (fn: Parameters<typeof commit>[0], msg: string) => {
    try {
      commit(fn)
      toast(msg)
      onClose()
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <Sheet open onClose={onClose} title={rule.title}>
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-neutral-soft text-muted">
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="flex flex-col">
          <span className="font-semibold">Prazo: {formatDateLong(occ.dueDate)}</span>
          {!done && <span className={occ.state === 'overdue' ? 'text-sm font-medium text-danger' : 'text-sm text-muted'}>{dueLabel(today, occ.dueDate)}</span>}
          {occ.dueDate !== occ.originalDate && <span className="text-sm text-muted">Prazo alterado (era {formatDateShort(occ.originalDate)})</span>}
        </div>
      </div>
      {rule.notes && <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm leading-relaxed text-muted">{rule.notes}</p>}

      {done ? (
        <>
          <p className="rounded-xl bg-success-soft px-3 py-3 font-medium text-success">
            {occ.state === 'notApplicable'
              ? 'Marcado como "não se aplica".'
              : `${DONE_TEXT[rule.kind]}${occ.record?.date ? ` a ${formatDateShort(occ.record.date)}` : ''}${occ.record?.amountPaid ? ` · ${formatMoney(occ.record.amountPaid)}` : ''}`}
          </p>
          <Button variant="secondary" icon={RotateCcw} onClick={() => run((d) => unmarkOccurrence(d, rule.id, occ.originalDate), 'Marcação anulada')}>
            Anular
          </Button>
        </>
      ) : (
        <>
          <Field label={rule.kind === 'pagamento' ? 'Data do pagamento' : 'Data'} htmlFor={ids.date}>
            <DateInput id={ids.date} value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
          </Field>
          {rule.kind === 'pagamento' && (
            <Field label="Valor pago" htmlFor={ids.amount} optional hint="Conta para o total pago ao Estado nas estatísticas.">
              <MoneyInput id={ids.amount} value={amount} onChange={setAmount} />
            </Field>
          )}
          <Button
            size="lg"
            onClick={() =>
              run(
                (d) => markOccurrence(d, rule.id, occ.originalDate, 'done', { date, amountPaid: amount ?? undefined }),
                `${DONE_TEXT[rule.kind]} ✓`,
              )
            }
          >
            Marcar como {actionLabel(rule.kind).toLowerCase()}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => run((d) => markOccurrence(d, rule.id, occ.originalDate, 'notApplicable'), 'Marcado como "não se aplica"')}>
              Não se aplica
            </Button>
            <Button variant="secondary" icon={CalendarClock} onClick={() => setEditingDue((v) => !v)}>
              Alterar prazo
            </Button>
          </div>
          {editingDue && (
            <div className="flex items-end gap-2">
              <Field label="Novo prazo" htmlFor={ids.due} className="flex-1" hint="Útil quando há prorrogação.">
                <DateInput id={ids.due} value={newDue} onChange={(e) => setNewDue(e.target.value)} />
              </Field>
              <Button
                className="mb-[26px]"
                onClick={() => run((d) => setOccurrenceDueDate(d, rule.id, occ.originalDate, newDue || undefined), 'Prazo alterado')}
              >
                Guardar
              </Button>
            </div>
          )}
        </>
      )}
    </Sheet>
  )
}
