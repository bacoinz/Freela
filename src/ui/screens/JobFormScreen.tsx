import { Check, Plus, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Navigate, useBlocker, useNavigate, useParams } from 'react-router'
import { jobTotal } from '../../domain/installments'
import { formatMoney, percentOf } from '../../domain/money'
import { addJob, updateJob, type JobInput, type PayerInput } from '../../domain/ops'
import type { AppData, Cents, ISODate, Job } from '../../domain/types'
import { commit, useData } from '../../data/app'
import { uuid } from '../../data/ids'
import { BottomBar, Button, IconButton } from '../components/Button'
import { choose, toast, toastError } from '../components/Feedback'
import { Chip, ChipRow, DateInput, Field, MoneyInput, Segmented, Select, TextArea, TextInput, inputClass } from '../components/Form'
import { AppBar, Card, Page } from '../components/Layout'
import { PayerPicker } from '../components/Payer'
import { lastUsedMethodId, useToday } from '../hooks'
import {
  addRow,
  applyTotal,
  editRowAmount,
  removeRow,
  resplit,
  rowsForMode,
  rowsToInput,
  type EditorMode,
  type EditorRow,
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
  investPct: string
  notes: string
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
      investPct: String(job.investPct).replace('.', ','),
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
    rows: rowsForMode('single', 0, today, [], newKey),
    investPct: String(data.settings.investPct).replace('.', ','),
    notes: '',
  }
}

const parsePct = (s: string) => {
  const n = Number(s.replace(',', '.').trim())
  return s.trim() !== '' && Number.isFinite(n) ? n : NaN
}

export function JobFormScreen() {
  const { id } = useParams()
  const data = useData()
  const today = useToday()
  const navigate = useNavigate()
  const editing = id ? data.jobs.find((j) => j.id === id) : undefined
  const ids = { total: useId(), title: useId(), payer: useId(), date: useId(), pct: useId(), notes: useId() }

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

  const pct = parsePct(f.investPct)
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
    set({ mode, rows: rowsForMode(mode, f.total ?? 0, f.workDate, f.rows, newKey) })
  }

  const changeWorkDate = (workDate: ISODate) => {
    // A 1.ª prestação acompanha a data do trabalho se ainda estava igual.
    const rows = f.rows.map((r, i) => (i === 0 && !r.received && r.dueDate === f.workDate ? { ...r, dueDate: workDate } : r))
    set({ workDate, rows })
  }

  const updateRow = (key: string, patch: Partial<EditorRow>) => set({ rows: f.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) })

  const changeRowAmount = (key: string, amount: Cents | null) => {
    setManualSplit(true)
    const rows = editRowAmount(f.rows, key, amount ?? 0, f.total ?? 0)
    set({ rows, total: rows.reduce((s, r) => s + r.amount, 0) })
  }

  const toggleReceived = (row: EditorRow) => {
    if (row.received) {
      const { received: _r, ...rest } = row
      set({ rows: f.rows.map((r) => (r.key === row.key ? rest : r)) })
    } else {
      updateRow(row.key, { received: { date: today, methodId: row.expectedMethodId ?? lastUsedMethodId(data) ?? methods[0]?.id ?? '' } })
    }
  }

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (!f.total || f.total <= 0) e.total = 'Indica o valor do trabalho.'
    if (!f.title.trim()) e.title = 'Escreve uma descrição (ex.: «Concerto no Hot Clube»).'
    if (!f.payer) e.payer = 'Indica quem paga.'
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) e.pct = 'Escreve uma percentagem entre 0 e 100.'
    if (f.rows.some((r) => r.amount <= 0)) e.rows = 'Cada prestação tem de ter um valor maior do que zero — revê os valores.'
    if (f.rows.some((r) => r.received && !r.received.methodId)) e.rows = 'Indica o método de cada prestação já recebida.'
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
      investPct: pct,
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

  return (
    <>
      <AppBar title={editing ? 'Editar trabalho' : 'Novo trabalho'} back="/trabalhos" />
      <Page withBottomBar>
        <Field label="Valor total" htmlFor={ids.total} error={errors.total}>
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
            <InstallmentEditor
              key={row.key}
              row={row}
              label={installmentLabel(i, f.rows.length)}
              methods={methods}
              today={today}
              canRemove={f.mode === 'custom' && f.rows.length > 1 && !row.received}
              onAmount={(a) => changeRowAmount(row.key, a)}
              onPatch={(p) => updateRow(row.key, p)}
              onToggleReceived={() => toggleReceived(row)}
              onRemove={() => set({ rows: removeRow(f.rows, row.key, f.total ?? 0) })}
            />
          ))}
          {f.mode === 'custom' && (
            <Button variant="tonal" icon={Plus} onClick={() => { setManualSplit(false); set({ rows: addRow(f.rows, f.total ?? 0, newKey) }) }}>
              Adicionar prestação
            </Button>
          )}
          {errors.rows && (
            <p role="alert" className="px-0.5 text-sm font-medium text-danger">
              {errors.rows}
            </p>
          )}
          {f.total !== null && rowsSum !== f.total && (
            <p className="px-0.5 text-sm text-warning">As prestações somam {formatMoney(rowsSum)}.</p>
          )}
        </div>

        <Field
          label="Percentagem para investir"
          htmlFor={ids.pct}
          error={errors.pct}
          hint={Number.isFinite(pct) && f.total ? `${f.investPct}% de ${formatMoney(f.total)} = ${formatMoney(percentOf(f.total, pct))} para investir` : undefined}
        >
          <div className="relative">
            <input
              id={ids.pct}
              inputMode="decimal"
              value={f.investPct}
              onChange={(e) => set({ investPct: e.target.value })}
              className={`${inputClass} tnum pr-10`}
              aria-invalid={!!errors.pct || undefined}
            />
            <span aria-hidden className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted">
              %
            </span>
          </div>
        </Field>

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

interface InstallmentEditorProps {
  row: EditorRow
  label: string
  methods: AppData['methods']
  today: ISODate
  canRemove: boolean
  onAmount: (c: Cents | null) => void
  onPatch: (p: Partial<EditorRow>) => void
  onToggleReceived: () => void
  onRemove: () => void
}

function InstallmentEditor({ row, label, methods, today, canRemove, onAmount, onPatch, onToggleReceived, onRemove }: InstallmentEditorProps) {
  const ids = { amount: useId(), due: useId(), method: useId(), rdate: useId(), rmethod: useId() }
  const methodOptions = useMemo(() => methods, [methods])
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{label}</span>
        {canRemove && <IconButton icon={X} label={`Remover ${label}`} onClick={onRemove} className="-my-2 -mr-2" />}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor" htmlFor={ids.amount}>
          <MoneyInput id={ids.amount} value={row.amount || null} onChange={onAmount} />
        </Field>
        <Field label="Data prevista" htmlFor={ids.due} optional>
          <DateInput id={ids.due} value={row.dueDate} onChange={(e) => onPatch({ dueDate: e.target.value })} />
        </Field>
      </div>
      {!row.received && (
        <Field label="Método previsto" htmlFor={ids.method} optional>
          <Select id={ids.method} value={row.expectedMethodId ?? ''} onChange={(e) => onPatch({ expectedMethodId: e.target.value || undefined })}>
            <option value="">—</option>
            {methodOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input type="checkbox" checked={!!row.received} onChange={onToggleReceived} className="size-5 accent-[var(--primary)]" />
        <span className="font-medium">Já recebi</span>
      </label>
      {row.received && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Recebido a" htmlFor={ids.rdate}>
            <DateInput
              id={ids.rdate}
              value={row.received.date}
              max={today}
              onChange={(e) => onPatch({ received: { ...row.received!, date: e.target.value || today } })}
            />
          </Field>
          <Field label="Como" htmlFor={ids.rmethod}>
            <Select id={ids.rmethod} value={row.received.methodId} onChange={(e) => onPatch({ received: { ...row.received!, methodId: e.target.value } })}>
              <option value="">Escolher…</option>
              {methodOptions.map((m) => (
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
