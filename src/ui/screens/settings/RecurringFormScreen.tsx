import { Check, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { MONTHS_SHORT_PT, periodOf } from '../../../domain/dates'
import { addPayer, applyRecurring, removeRecurring, upsertRecurring, type PayerInput } from '../../../domain/ops'
import type { Cents, RecurringIncome } from '../../../domain/types'
import { commit, useData } from '../../../data/app'
import { BottomBar, Button } from '../../components/Button'
import { cn } from '../../components/cn'
import { confirm, toast, toastError } from '../../components/Feedback'
import { Chip, ChipRow, Field, MoneyInput, Select, TextInput, Toggle, inputClass } from '../../components/Form'
import { AppBar, Card, Page } from '../../components/Layout'
import { PayerPicker } from '../../components/Payer'
import { useToday } from '../../hooks'

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const SCHOOL_YEAR = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7]

export function RecurringFormScreen() {
  const { id } = useParams()
  const data = useData()
  const today = useToday()
  const navigate = useNavigate()
  const isNew = id === 'novo'
  const rec = isNew ? undefined : data.recurring.find((r) => r.id === id)
  const ids = { title: useId(), payer: useId(), amount: useId(), day: useId(), method: useId(), start: useId() }

  const [title, setTitle] = useState(rec?.title ?? '')
  const [payer, setPayer] = useState<PayerInput | null>(rec ? { kind: 'saved', id: rec.payerId } : null)
  const [categoryId, setCategoryId] = useState(rec?.categoryId ?? data.categories.find((c) => !c.archived)?.id ?? '')
  const [amount, setAmount] = useState<Cents | null>(rec?.amount ?? null)
  const [day, setDay] = useState(String(rec?.dayOfMonth ?? 5))
  const [methodId, setMethodId] = useState(rec?.methodId ?? '')
  const [months, setMonths] = useState<number[]>(rec?.months ?? ALL)
  const [startPeriod, setStartPeriod] = useState(rec?.startPeriod ?? periodOf(today))
  const [active, setActive] = useState(rec?.active ?? true)

  if (!isNew && !rec) return <Navigate to="/definicoes/fixos" replace />

  const toggleMonth = (m: number) => setMonths((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))

  const save = () => {
    const dayN = Number(day)
    if (!payer) {
      toast('Indica quem paga.', 'error')
      return
    }
    try {
      commit((d, ctx) => {
        let next = d
        let payerId: string
        if (payer.kind === 'saved') payerId = payer.id
        else {
          const r = addPayer(next, payer.name, ctx)
          next = r.data
          payerId = r.id
        }
        const fields: Omit<RecurringIncome, 'id'> & { id?: string } = {
          id: rec?.id,
          title,
          categoryId,
          payerId,
          amount: amount ?? 0,
          dayOfMonth: Number.isInteger(dayN) ? dayN : 0,
          months,
          startPeriod,
          skippedPeriods: rec?.skippedPeriods ?? [],
          active,
        }
        if (methodId) fields.methodId = methodId
        // Cria já o trabalho deste mês (se se aplicar).
        return applyRecurring(upsertRecurring(next, fields, ctx).data, ctx)
      })
      toast('Rendimento fixo guardado')
      navigate('/definicoes/fixos', { replace: true })
    } catch (e) {
      toastError(e)
    }
  }

  const remove = async () => {
    if (!rec) return
    const ok = await confirm({
      title: 'Eliminar rendimento fixo?',
      message: 'Os meses já criados ficam nos teus trabalhos; deixam de ser criados meses novos.',
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    commit((d) => removeRecurring(d, rec.id))
    toast('Rendimento fixo eliminado')
    navigate('/definicoes/fixos', { replace: true })
  }

  return (
    <>
      <AppBar title={isNew ? 'Novo rendimento fixo' : 'Rendimento fixo'} back="/definicoes/fixos" />
      <Page withBottomBar>
        <Field label="Descrição" htmlFor={ids.title}>
          <TextInput id={ids.title} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Aulas — Escola de Música" />
        </Field>
        <Field label="Quem paga" htmlFor={ids.payer} hint="Os rendimentos fixos usam pagadores guardados.">
          <PayerPicker id={ids.payer} value={payer} onChange={setPayer} payers={data.payers} jobs={data.jobs} savedOnly />
        </Field>
        <Field label="Tipo de trabalho">
          <ChipRow label="Categoria">
            {data.categories
              .filter((c) => !c.archived || c.id === categoryId)
              .map((c) => (
                <Chip key={c.id} selected={categoryId === c.id} onClick={() => setCategoryId(c.id)} color={c.color}>
                  {c.name}
                </Chip>
              ))}
          </ChipRow>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor por mês" htmlFor={ids.amount}>
            <MoneyInput id={ids.amount} value={amount} onChange={setAmount} />
          </Field>
          <Field label="Dia do pagamento" htmlFor={ids.day}>
            <Select id={ids.day} value={day} onChange={(e) => setDay(e.target.value)}>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i} value={String(i + 1)}>
                  dia {i + 1}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Como costuma pagar" htmlFor={ids.method} optional>
          <Select id={ids.method} value={methodId} onChange={(e) => setMethodId(e.target.value)}>
            <option value="">—</option>
            {data.methods
              .filter((m) => !m.archived)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </Select>
        </Field>
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">Meses com pagamento</span>
            <div className="flex shrink-0 gap-1 whitespace-nowrap">
              <button type="button" className="rounded-lg px-2 py-1.5 text-sm font-semibold text-primary-ink" onClick={() => setMonths(ALL)}>
                Todos
              </button>
              <button type="button" className="rounded-lg px-2 py-1.5 text-sm font-semibold text-primary-ink" onClick={() => setMonths(SCHOOL_YEAR)}>
                Set–Jul
              </button>
            </div>
          </div>
          <ChipRow label="Meses">
            {MONTHS_SHORT_PT.map((m, i) => (
              <Chip key={m} selected={months.includes(i + 1)} onClick={() => toggleMonth(i + 1)}>
                {m}
              </Chip>
            ))}
          </ChipRow>
        </Card>
        <Field label="Começa em" htmlFor={ids.start} hint="Mês a partir do qual a app cria os pagamentos «a receber».">
          <input id={ids.start} type="month" value={startPeriod} onChange={(e) => e.target.value && setStartPeriod(e.target.value)} className={cn(inputClass, 'tnum')} />
        </Field>
        <Card>
          <Toggle checked={active} onChange={setActive} label="Ativo" description="Pausa nas férias ou quando deixar de haver pagamento." />
        </Card>
        {rec && (
          <Button variant="danger-outline" icon={Trash2} onClick={() => void remove()}>
            Eliminar rendimento fixo
          </Button>
        )}
      </Page>
      <BottomBar>
        <Button block size="lg" icon={Check} onClick={save}>
          Guardar
        </Button>
      </BottomBar>
    </>
  )
}
