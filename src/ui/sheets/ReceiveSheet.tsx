import { Check } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { formatPeriodPT, periodOf } from '../../domain/dates'
import { pctText, planFor } from '../../domain/invest'
import { formatMoney, percentOf } from '../../domain/money'
import { receive } from '../../domain/ops'
import { isReceived } from '../../domain/installments'
import { payerLabel } from '../../domain/payers'
import type { Cents } from '../../domain/types'
import { commit, useData } from '../../data/app'
import { Button } from '../components/Button'
import { toast, toastError } from '../components/Feedback'
import { Chip, ChipRow, DateInput, Field, MoneyInput } from '../components/Form'
import { Sheet } from '../components/Sheet'
import { lastUsedMethodId, useToday } from '../hooks'

export interface ReceiveTarget {
  jobId: string
  installmentId: string
}

/** "Recebido": confirma valor, data e método de uma prestação. */
export function ReceiveSheet({ target, onClose }: { target: ReceiveTarget | null; onClose: () => void }) {
  const data = useData()
  const today = useToday()
  const ids = { amount: useId(), date: useId() }
  const job = target ? data.jobs.find((j) => j.id === target.jobId) : undefined
  const inst = job?.installments.find((i) => i.id === target?.installmentId)

  const [amount, setAmount] = useState<Cents | null>(null)
  const [date, setDate] = useState(today)
  const [methodId, setMethodId] = useState('')

  const methods = data.methods.filter((m) => !m.archived || m.id === methodId)

  useEffect(() => {
    if (!inst) return
    setAmount(inst.amount)
    setDate(today)
    setMethodId(inst.expectedMethodId ?? lastUsedMethodId(data) ?? data.methods.find((m) => !m.archived)?.id ?? '')
    // Só quando muda a prestação a receber.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.installmentId])

  if (!job || !inst) return <Sheet open={false} onClose={onClose} title="" children={null} />

  // A % que conta é a do mês em que recebes.
  const pct = planFor(data.settings.investPlans, periodOf(date)).pct
  const otherPending = job.installments.some((i) => i.id !== inst.id && !isReceived(i))
  let note: string | null = null
  if (amount !== null && amount > 0 && amount < inst.amount) {
    note = `Os ${formatMoney(inst.amount - amount)} que faltam ficam como uma nova prestação por receber.`
  } else if (amount !== null && amount > inst.amount) {
    note = otherPending
      ? `A diferença (${formatMoney(amount - inst.amount)}) é descontada nas prestações seguintes.`
      : `O total do trabalho passa para ${formatMoney(job.installments.reduce((s, i) => s + i.amount, 0) - inst.amount + amount)}.`
  }

  const save = () => {
    if (amount === null || amount <= 0) return
    if (!methodId) {
      toast('Escolhe o método de pagamento.', 'error')
      return
    }
    try {
      commit((d, ctx) => receive(d, job.id, inst.id, { amount, date, methodId }, ctx))
      toast(`Recebido ${formatMoney(amount)} · para investir ${formatMoney(percentOf(amount, pct))}`)
      onClose()
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Marcar como recebido"
      footer={
        <Button block size="lg" icon={Check} onClick={save} disabled={amount === null || amount <= 0}>
          Confirmar
        </Button>
      }
    >
      <p className="text-[15px] text-muted">
        <span className="font-semibold text-ink">{job.title}</span>
        {job.period && ` · ${formatPeriodPT(job.period).split(' de ')[0]}`} · {payerLabel(job, data.payers)}
      </p>
      <Field
        label="Valor recebido"
        htmlFor={ids.amount}
        hint={note ?? (amount ? `${pctText(pct)}% para investir: ${formatMoney(percentOf(amount, pct))}` : undefined)}
      >
        <MoneyInput id={ids.amount} value={amount} onChange={setAmount} large />
      </Field>
      <Field label="Data" htmlFor={ids.date}>
        <DateInput id={ids.date} value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
      </Field>
      <Field label="Como recebeste">
        <ChipRow label="Método de pagamento">
          {methods.map((m) => (
            <Chip key={m.id} selected={methodId === m.id} onClick={() => setMethodId(m.id)}>
              {m.name}
            </Chip>
          ))}
        </ChipRow>
      </Field>
    </Sheet>
  )
}
