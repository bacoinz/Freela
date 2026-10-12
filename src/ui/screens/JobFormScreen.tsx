import { Check, Plus, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Navigate, useBlocker, useNavigate, useParams } from 'react-router'
import { jobTotal } from '../../domain/installments'
import { currentPlan } from '../../domain/invest'
import { formatMoney, percentOf } from '../../domain/money'
import { addJob, updateJob, type JobInput, type PayerInput } from '../../domain/ops'
import type { AppData, Cents, ISODate, Job } from '../../domain/types'
import { commit, useData } from '../../data/app'
import { uuid } from '../../data/ids'
import { BottomBar, Button, IconButton } from '../components/Button'
import { choose, toast, toastError } from '../components/Feedback'
import { Chip, ChipRow, DateInput, Field, MoneyInput, Segmented, Select, TextArea, TextInput } from '../components/Form'
import { AppBar, Card, Page } from '../components/Layout'
import { PayerPicker } from '../components/Payer'
import { lastUsedMethodId, useToday } from '../hooks'
import {
  addRow,
  applyTotal,
  editRowAmount,
  isLockedRow,
  removeRow,
  resplit,
  rowsForMode,
  rowsToInput,
  type EditorMode,
  type EditorRow,
  type RowDefaults,
} from '../logic/installmentsEditor'
import { installmentLabel } from '../logic/texts'

const newKey = () => uuid()

interface FormState {
  total: Cents | null
  title: string
  categoryId: string
  payer: PayerInput | null
  workDate: ISODate
  mode: EditorMode
  rows: EditorRow[]
  notes: string
}

/** Método a sugerir: o último usado, ou o primeiro da lista. */
function defaultMethodId(data: AppData): string {
  return lastUsedMethodId(data) ?? data.methods.find((m) => !m.archived)?.id ?? ''
}

/** Um trabalho de hoje ou de antes fica pago por defeito; um trabalho futuro fica pendente. */
function rowDefaults(data: AppData, workDate: ISODate, today: ISODate): RowDefaults {
  return { paid: workDate <= today, methodId: defaultMethodId(data) }
}

function initialState(data: AppData, job: Job | undefined, today: ISODate): FormState {
  if (job) {
    const n = job.installments.length
    return {
      total: jobTotal(job),
      title: job.title,
      categoryId: job.categoryId,
      payer: job.payerId ? { kind: 'saved', id: job.payerId } : { kind: 'oneoff', name: job.payerName ?? '' },
      workDate: job.workDate,
      mode: n === 1 ? 'single' : n === 2 ? 'two' : 'custom',
      rows: job.installments.map((i) => {
        const r: EditorRow = { key: newKey(), id: i.id, amount: i.amount, dueDate: i.dueDate ?? '' }
        if (i.expectedMethodId) r.expectedMethodId = i.expectedMethodId
        if (i.receivedDate) r.received = { date: i.receivedDate, methodId: i.methodId ?? '' }
        return r
      }),
      notes: job.notes ?? '',
    }
  }
  return {
    total: null,
    title: '',
    categoryId: data.categories.find((c) => !c.archived)?.id ?? '',
    payer: null,
    workDate: today,
    mode: 'single',
    rows: rowsForMode('single', 0, today, [], newKey, rowDefaults(data, today, today)),
    notes: '',
  }
}

export function JobFormScreen() {
  const { id } = useParams()
  const data = useData()
  const today = useToday()
  const navigate = useNavigate()
  const editing = id ? data.jobs.find((j) => j.id === id) : undefined
  const ids = { total: useId(), title: useId(), payer: useId(), date: useId(), notes: useId() }

  const [f, setF] = useState<FormState>(() => initialState(data, editing, today))
  const [manualSplit, setManualSplit] = useState(!!editing)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const saving = useRef(false)

  const set = (patch: Partial<FormState>) => {
    setF((s) => ({ ...s, ...patch }))
    setDirty(true)
  }

  // Sair sem guardar? (inclui o botão "voltar" do Android)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saving.current && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    void choose('Sair sem guardar?', [{ value: true, label: 'Sair sem guardar', tone: 'danger' }], 'As alterações a este trabalho perdem-se.').then((r) =>
      r ? blocker.proceed() : blocker.reset(),
    )
  }, [blocker])

  // % para investir deste mês (cada pagamento usa a do mês em que é recebido).
  const investPct = currentPlan(data, today).pct
  const rowsSum = f.rows.reduce((s, r) => s + r.amount, 0)
  const categories = data.categories.filter((c) => !c.archived || c.id === f.categoryId)
  const methods = data.methods.filter((m) => !m.archived)

  if (id && !editing) return <Navigate to="/trabalhos" replace />

  const changeTotal = (total: Cents | null) => {
    const t = total ?? 0
    set({ total, rows: manualSplit ? applyTotal(f.rows, t) : resplit(f.rows, t) })
  }

  const changeMode = (mode: EditorMode) => {
    setManualSplit(false)
    set({ mode, rows: rowsForMode(mode, f.total ?? 0, f.workDate, f.rows, newKey, rowDefaults(data, f.workDate, today)) })
  }

  const changeWorkDate = (workDate: ISODate) => {
    // Pagamentos com a mesma data do trabalho acompanham a mudança.
    const rows = f.rows.map((r) =>
      r.received && r.received.date === f.workDate ? { ...r, received: { ...r.received, date: workDate > today ? today : workDate } } : r,
    )
    set({ workDate, rows })
  }

  const updateRow = (key: string, patch: Partial<EditorRow>) => set({ rows: f.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) })

  const changeRowAmount = (key: string, amount: Cents | null) => {
    setManualSplit(true)
    const rows = editRowAmount(f.rows, key, amount ?? 0, f.total ?? 0)
    set({ rows, total: rows.reduce((s, r) => s + r.amount, 0) })
  }

  /** Pendente ↔ pago (por defeito na data do trabalho, ou hoje se o trabalho for no futuro). */
  const togglePending = (row: EditorRow) => {
    if (row.received) {
      const { received, ...rest } = row
      set({ rows: f.rows.map((r) => (r.key === row.key ? { ...rest, expectedMethodId: received.methodId || undefined } : r)) })
    } else {
      const date = f.workDate > today ? today : f.workDate
      updateRow(row.key, { received: { date, methodId: row.expectedMethodId ?? defaultMethodId(data) } })
    }
  }

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (!f.total || f.total <= 0) e.total = 'Indica o valor do trabalho.'
    if (!f.title.trim()) e.title = 'Escreve uma descrição (ex.: «Concerto no Hot Clube»).'
    if (!f.payer) e.payer = 'Indica quem paga.'
    // Sem total, basta o aviso do total (em "De uma vez" o valor do pagamento nem aparece).
    if (f.total && f.rows.some((r) => r.amount <= 0)) e.rows = 'Cada pagamento tem de ter um valor maior do que zero — revê os valores.'
    if (f.rows.some((r) => r.received && !r.received.methodId)) e.rows = 'Indica como foi feito cada pagamento.'
    return e
  }

  const save = () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) {
      toast('Falta corrigir alguns campos.', 'error')
      document.querySelector('[role="alert"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }
    const input: JobInput = {
      title: f.title,
      categoryId: f.categoryId,
      payer: f.payer!,
      workDate: f.workDate,
      notes: f.notes,
      installments: rowsToInput(f.rows),
    }
    try {
      saving.current = true
      let targetId = editing?.id ?? ''
      commit((d, ctx) => {
        if (editing) return updateJob(d, editing.id, input, ctx)
        const r = addJob(d, input, ctx)
        targetId = r.id
        return r.data
      })
      toast(editing ? 'Alterações guardadas' : 'Trabalho guardado')
      navigate(`/trabalhos/${targetId}`, { replace: true })
    } catch (err) {
      saving.current = false
      toastError(err)
    }
  }

  const single = f.mode === 'single'

  return (
    <>
      <AppBar title={editing ? 'Editar trabalho' : 'Novo trabalho'} back="/trabalhos" />
      <Page withBottomBar>
        <Field
          label="Valor total"
          htmlFor={ids.total}
          error={errors.total}
          hint={f.total ? `Para investir (${String(investPct).replace('.', ',')}%): ${formatMoney(percentOf(f.total, investPct))}` : undefined}
        >
          <MoneyInput id={ids.total} value={f.total} onChange={changeTotal} large autoFocus={!editing} invalid={!!errors.total} />
        </Field>

        <Field label="Descrição" htmlFor={ids.title} error={errors.title}>
          <TextInput
            id={ids.title}
            value={f.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Ex.: Concerto no Hot Clube"
            aria-invalid={!!errors.title || undefined}
            autoCapitalize="sentences"
          />
        </Field>

        <Field label="Tipo de trabalho">
          <ChipRow label="Categoria">
            {categories.map((c) => (
              <Chip key={c.id} selected={f.categoryId === c.id} onClick={() => set({ categoryId: c.id })} color={c.color}>
                {c.name}
              </Chip>
            ))}
          </ChipRow>
        </Field>

        <Field label="Quem paga" htmlFor={ids.payer} error={errors.payer}>
          <PayerPicker id={ids.payer} value={f.payer} onChange={(payer) => set({ payer })} payers={data.payers} jobs={data.jobs} invalid={!!errors.payer} />
        </Field>

        <Field label="Data do trabalho" htmlFor={ids.date}>
          <DateInput id={ids.date} value={f.workDate} onChange={(e) => e.target.value && changeWorkDate(e.target.value)} />
        </Field>

        <div className="flex flex-col gap-3">
          <Field label="Como vais receber">
            <Segmented
              label="Como vais receber"
              value={f.mode}
              onChange={changeMode}
              options={[
                { value: 'single', label: 'De uma vez' },
                { value: 'two', label: '2 vezes' },
                { value: 'custom', label: 'Personalizado' },
              ]}
            />
          </Field>
          {f.rows.map((row, i) => (
            <PaymentEditor
              key={row.key}
              row={row}
              label={installmentLabel(i, f.rows.length)}
              showAmount={!single}
              methods={methods}
              today={today}
              canRemove={f.mode === 'custom' && f.rows.length > 1 && !isLockedRow(row)}
              onAmount={(a) => changeRowAmount(row.key, a)}
              onPatch={(p) => updateRow(row.key, p)}
              onTogglePending={() => togglePending(row)}
              onRemove={() => set({ rows: removeRow(f.rows, row.key, f.total ?? 0) })}
            />
          ))}
          {f.mode === 'custom' && (
            <Button
              variant="tonal"
              icon={Plus}
              onClick={() => {
                setManualSplit(false)
                set({ rows: addRow(f.rows, f.total ?? 0, newKey) })
              }}
            >
              Adicionar pagamento
            </Button>
          )}
          {errors.rows && (
            <p role="alert" className="px-0.5 text-sm font-medium text-danger">
              {errors.rows}
            </p>
          )}
          {!single && f.total !== null && rowsSum !== f.total && (
            <p className="px-0.5 text-sm text-warning">Os pagamentos somam {formatMoney(rowsSum)}.</p>
          )}
        </div>

        <Field label="Notas" htmlFor={ids.notes} optional>
          <TextArea id={ids.notes} value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Ex.: morada, contacto, o que ficou combinado…" />
        </Field>
      </Page>
      <BottomBar>
        <Button block size="lg" icon={Check} onClick={save}>
          Guardar
        </Button>
      </BottomBar>
    </>
  )
}

interface PaymentEditorProps {
  row: EditorRow
  label: string
  showAmount: boolean
  methods: AppData['methods']
  today: ISODate
  canRemove: boolean
  onAmount: (c: Cents | null) => void
  onPatch: (p: Partial<EditorRow>) => void
  onTogglePending: () => void
  onRemove: () => void
}

/** Um pagamento: valor (quando há vários), "Pendente" e, se já foi pago, quando e como. */
function PaymentEditor({ row, label, showAmount, methods, today, canRemove, onAmount, onPatch, onTogglePending, onRemove }: PaymentEditorProps) {
  const ids = { amount: useId(), pending: useId(), date: useId(), method: useId() }
  const pending = !row.received
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{label}</span>
        {canRemove && <IconButton icon={X} label={`Remover ${label}`} onClick={onRemove} className="-my-2 -mr-2" />}
      </div>
      {showAmount && (
        <Field label="Valor" htmlFor={ids.amount}>
          <MoneyInput id={ids.amount} value={row.amount || null} onChange={onAmount} />
        </Field>
      )}
      <label htmlFor={ids.pending} className="flex min-h-11 cursor-pointer items-center gap-3">
        <input id={ids.pending} type="checkbox" checked={pending} onChange={onTogglePending} className="size-5 accent-[var(--primary)]" />
        <span className="flex flex-col">
          <span className="font-medium">Pendente</span>
          <span className="text-sm text-muted">{pending ? 'Ainda não recebeste — marcas quando chegar.' : 'Já recebeste este pagamento.'}</span>
        </span>
      </label>
      {row.received && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pago a" htmlFor={ids.date}>
            <DateInput
              id={ids.date}
              value={row.received.date}
              max={today}
              onChange={(e) => onPatch({ received: { ...row.received!, date: e.target.value || today } })}
            />
          </Field>
          <Field label="Como" htmlFor={ids.method}>
            <Select id={ids.method} value={row.received.methodId} onChange={(e) => onPatch({ received: { ...row.received!, methodId: e.target.value } })}>
              <option value="">Escolher…</option>
              {methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}
    </Card>
  )
}
