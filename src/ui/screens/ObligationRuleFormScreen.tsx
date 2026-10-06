import { Check, Trash2 } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { addDays, formatDateShort, MONTHS_PT, MONTHS_SHORT_PT } from '../../domain/dates'
import { reminderDates, scheduleDatesBetween } from '../../domain/obligations'
import { removeObligationRule, upsertObligationRule } from '../../domain/ops'
import type { ObligationRule } from '../../domain/types'
import { commit, useData } from '../../data/app'
import { BottomBar, Button } from '../components/Button'
import { confirm, toast, toastError } from '../components/Feedback'
import { Chip, ChipRow, DateInput, Field, MoneyInput, Segmented, Select, TextArea, TextInput, Toggle, inputClass } from '../components/Form'
import { AppBar, Card, Page } from '../components/Layout'
import { useToday } from '../hooks'
import { formToRule, ruleToForm, type FromType, type RuleForm, type SchedType } from '../logic/ruleForm'
import { reminderText, scheduleText } from '../logic/texts'

export function ObligationRuleFormScreen() {
  const { id } = useParams()
  const data = useData()
  const today = useToday()
  const navigate = useNavigate()
  const isNew = id === 'novo'
  const rule = isNew ? undefined : data.obligationRules.find((r) => r.id === id)
  const [f, setF] = useState<RuleForm>(() => ruleToForm(rule, today))
  const [error, setError] = useState<string | null>(null)
  const ids = { title: useId(), day: useId(), amount: useId(), notes: useId() }
  const set = (p: Partial<RuleForm>) => setF((s) => ({ ...s, ...p }))

  const built = useMemo(() => formToRule(f), [f])
  const preview = useMemo(() => {
    if (typeof built === 'string') return null
    const next = scheduleDatesBetween(built.schedule, today, addDays(today, 730)).slice(0, 3)
    const draft: ObligationRule = { id: 'x', title: f.title || 'Prazo', kind: f.kind, schedule: built.schedule, reminders: built.reminders, active: true, startDate: today }
    const first = next[0]
    const rem = first ? reminderDates({ rule: draft, originalDate: first, dueDate: first, state: 'upcoming' }, today, addDays(first, 60)).slice(0, 8) : []
    return { next, rem, text: reminderText(draft), sched: scheduleText(built.schedule) }
  }, [built, f.title, f.kind, today])

  if (!isNew && !rule) return <Navigate to="/obrigacoes/prazos" replace />

  const save = () => {
    if (typeof built === 'string') {
      setError(built)
      return
    }
    if (!f.title.trim()) {
      setError('Escreve uma descrição para o prazo.')
      return
    }
    try {
      commit((d, ctx) =>
        upsertObligationRule(
          d,
          {
            ...(rule ?? {}),
            id: rule?.id,
            title: f.title,
            kind: f.kind,
            schedule: built.schedule,
            reminders: built.reminders,
            defaultAmount: f.kind === 'pagamento' && f.defaultAmount ? f.defaultAmount : undefined,
            active: f.active,
            startDate: rule?.startDate ?? today,
            notes: f.notes.trim() || undefined,
          },
          ctx,
        ).data,
      )
      toast('Prazo guardado')
      navigate('/obrigacoes/prazos', { replace: true })
    } catch (e) {
      toastError(e)
    }
  }

  const remove = async () => {
    if (!rule) return
    const ok = await confirm({ title: 'Eliminar este prazo?', message: 'Se já tiver histórico (pagos/entregues), fica apenas desligado.', confirmLabel: 'Eliminar', danger: true })
    if (!ok) return
    commit((d) => removeObligationRule(d, rule.id))
    toast('Prazo eliminado')
    navigate('/obrigacoes/prazos', { replace: true })
  }

  const toggleMonth = (m: number) => set({ months: f.months.includes(m) ? f.months.filter((x) => x !== m) : [...f.months, m] })

  return (
    <>
      <AppBar title={isNew ? 'Novo prazo' : 'Editar prazo'} back="/obrigacoes/prazos" />
      <Page withBottomBar>
        <Field label="Descrição" htmlFor={ids.title}>
          <TextInput id={ids.title} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ex.: Pagar seguro do instrumento" />
        </Field>
        <Field label="Tipo">
          <Segmented
            label="Tipo"
            value={f.kind}
            onChange={(kind) => set({ kind })}
            options={[
              { value: 'pagamento', label: 'Pagamento' },
              { value: 'declaracao', label: 'Declaração' },
              { value: 'outro', label: 'Outro' },
            ]}
          />
        </Field>

        <Card className="flex flex-col gap-4 p-4">
          <p className="font-semibold">Quando é o prazo</p>
          <Select value={f.schedType} onChange={(e) => set({ schedType: e.target.value as SchedType })} aria-label="Repetição">
            <option value="monthly">Todos os meses</option>
            <option value="months">Em meses escolhidos</option>
            <option value="yearly">Todos os anos</option>
            <option value="once">Só uma vez</option>
          </Select>
          {f.schedType === 'once' ? (
            <Field label="Data">
              <DateInput value={f.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
            </Field>
          ) : (
            <>
              {f.schedType === 'months' && (
                <ChipRow label="Meses">
                  {MONTHS_SHORT_PT.map((m, i) => (
                    <Chip key={m} selected={f.months.includes(i + 1)} onClick={() => toggleMonth(i + 1)}>
                      {m}
                    </Chip>
                  ))}
                </ChipRow>
              )}
              <div className="grid grid-cols-2 gap-3">
                {f.schedType === 'yearly' && (
                  <Field label="Mês">
                    <Select value={f.month} onChange={(e) => set({ month: Number(e.target.value) })}>
                      {MONTHS_PT.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <Field label="Dia" htmlFor={ids.day}>
                  <Select id={ids.day} value={f.day} onChange={(e) => set({ day: e.target.value })}>
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i} value={String(i + 1)}>
                        {i + 1}
                      </option>
                    ))}
                    <option value="last">último dia</option>
                  </Select>
                </Field>
              </div>
            </>
          )}
        </Card>

        {f.kind === 'pagamento' && (
          <Field label="Valor habitual" htmlFor={ids.amount} optional hint="Pré-preenche o valor quando marcares como pago.">
            <MoneyInput id={ids.amount} value={f.defaultAmount} onChange={(v) => set({ defaultAmount: v })} />
          </Field>
        )}

        <Card className="flex flex-col gap-4 p-4">
          <p className="font-semibold">Lembretes</p>
          <Segmented
            label="Tipo de lembrete"
            value={f.remType}
            onChange={(remType) => set({ remType })}
            options={[
              { value: 'daysOfMonth', label: 'Dias fixos' },
              { value: 'repeat', label: 'A repetir' },
            ]}
          />
          {f.remType === 'daysOfMonth' ? (
            <Field label="Dias do mês do prazo" hint="Separados por vírgulas, ex.: 10, 15">
              <input className={inputClass} inputMode="numeric" value={f.days} onChange={(e) => set({ days: e.target.value })} />
            </Field>
          ) : (
            <>
              <Field label="De quantos em quantos dias">
                <input className={inputClass} inputMode="numeric" value={f.everyDays} onChange={(e) => set({ everyDays: e.target.value })} />
              </Field>
              <Field label="A partir de">
                <Select value={f.fromType} onChange={(e) => set({ fromType: e.target.value as FromType })}>
                  <option value="dueMonthStart">Início do mês do prazo</option>
                  <option value="fixedDate">Uma data fixa</option>
                  <option value="daysBefore">X dias antes do prazo</option>
                </Select>
              </Field>
              {f.fromType === 'fixedDate' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Mês">
                    <Select value={f.fromMonth} onChange={(e) => set({ fromMonth: Number(e.target.value) })}>
                      {MONTHS_PT.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Dia">
                    <input className={inputClass} inputMode="numeric" value={f.fromDay} onChange={(e) => set({ fromDay: e.target.value })} />
                  </Field>
                </div>
              )}
              {f.fromType === 'daysBefore' && (
                <Field label="Dias antes do prazo">
                  <input className={inputClass} inputMode="numeric" value={f.fromDays} onChange={(e) => set({ fromDays: e.target.value })} />
                </Field>
              )}
              <Field label="Até">
                <Segmented
                  label="Até quando"
                  value={f.until}
                  onChange={(until) => set({ until })}
                  options={[
                    { value: 'due', label: 'Ao prazo' },
                    { value: 'done', label: 'Marcar como feito' },
                  ]}
                />
              </Field>
              <div className="-mx-4">
                <Toggle checked={f.onDueDay} onChange={(onDueDay) => set({ onDueDay })} label="Lembrar também no próprio dia" />
              </div>
            </>
          )}
        </Card>

        {preview && (
          <Card className="flex flex-col gap-1.5 bg-surface-2 p-4 text-sm">
            <p className="font-semibold">{preview.sched}</p>
            <p className="text-muted">{preview.text}</p>
            {preview.next.length > 0 && (
              <p className="text-muted">
                Próximos prazos: <span className="tnum text-ink">{preview.next.map(formatDateShort).join(', ')}</span>
              </p>
            )}
            {preview.rem.length > 0 && (
              <p className="text-muted">
                Lembretes do próximo: <span className="tnum text-ink">{preview.rem.map((d) => d.slice(8, 10) + '/' + d.slice(5, 7)).join(', ')}</span>
              </p>
            )}
          </Card>
        )}

        <Field label="Notas" htmlFor={ids.notes} optional>
          <TextArea id={ids.notes} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>

        <Card>
          <Toggle checked={f.active} onChange={(active) => set({ active })} label="Ativo" description="Desliga se este prazo não se aplica a ti." />
        </Card>

        {error && (
          <p role="alert" className="px-1 text-sm font-medium text-danger">
            {error}
          </p>
        )}
        {rule && !rule.template && (
          <Button variant="danger-outline" icon={Trash2} onClick={() => void remove()}>
            Eliminar prazo
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
