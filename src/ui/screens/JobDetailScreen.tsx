import { CircleAlert, CircleCheck, Copy, EllipsisVertical, Pencil, PiggyBank, Repeat, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { formatDateLong, formatDateShort, formatPeriodPT } from '../../domain/dates'
import { isReceived, jobTotal, paidAmount, paidCount, remainingAmount } from '../../domain/installments'
import {
  installmentInvest,
  installmentPlan,
  jobInvestDone,
  jobInvestExpected,
  jobInvestPending,
  jobInvestReceived,
  jobParts,
  pctText,
} from '../../domain/invest'
import { isInstallmentOverdue, jobStatus, overdueDateOf } from '../../domain/jobs'
import { formatMoney } from '../../domain/money'
import { deleteJob, duplicateJob, markInvested, undoInvested, undoReceive } from '../../domain/ops'
import type { ISODate, Job } from '../../domain/types'
import { payerColor, payerLabel } from '../../domain/payers'
import { commit, useData } from '../../data/app'
import { Button, IconButton } from '../components/Button'
import { choose, confirm, toast, toastError } from '../components/Feedback'
import { AppBar, Card, ListCard, ListRow, Page, Section } from '../components/Layout'
import { PayerAvatar } from '../components/Payer'
import { Sheet } from '../components/Sheet'
import { Badge, Money, ProgressBar, StatusBadge } from '../components/Status'
import { useToday } from '../hooks'
import { dueLabel } from '../logic/relative'
import { installmentLabel } from '../logic/texts'
import { ReceiveSheet, type ReceiveTarget } from '../sheets/ReceiveSheet'
import { ReceiveButton } from './HomeScreen'

export function JobDetailScreen() {
  const { id } = useParams()
  const data = useData()
  const today = useToday()
  const navigate = useNavigate()
  const [receiving, setReceiving] = useState<ReceiveTarget | null>(null)
  const [menu, setMenu] = useState(false)
  const job = data.jobs.find((j) => j.id === id)
  if (!job) return <Navigate to="/trabalhos" replace />

  const total = jobTotal(job)
  const n = job.installments.length
  const status = jobStatus(job, today, data.settings.overdueDays)
  const category = data.categories.find((c) => c.id === job.categoryId)
  const payer = payerLabel(job, data.payers)
  const methodName = (mid?: string) => data.methods.find((m) => m.id === mid)?.name ?? '—'

  const undo = async (instId: string) => {
    const ok = await confirm({ title: 'Anular recebimento?', message: 'A prestação volta a ficar por receber.', confirmLabel: 'Anular' })
    if (!ok) return
    try {
      commit((d, ctx) => undoReceive(d, job.id, instId, ctx))
      toast('Recebimento anulado')
    } catch (e) {
      toastError(e)
    }
  }

  const remove = async () => {
    setMenu(false)
    if (job.recurringId) {
      const r = await choose(
        'Eliminar este mês do rendimento fixo?',
        [
          { value: 'skip', label: 'Eliminar e saltar este mês', tone: 'danger' },
          { value: 'only', label: 'Só eliminar (volta a ser criado)', tone: 'secondary' },
        ],
        'Se saltares este mês, a app não volta a criá-lo (ex.: férias da escola).',
      )
      if (!r) return
      commit((d) => deleteJob(d, job.id, { skipRecurringPeriod: r === 'skip' }))
    } else {
      const ok = await confirm({ title: 'Eliminar trabalho?', message: `«${job.title}» e os seus pagamentos serão apagados.`, confirmLabel: 'Eliminar', danger: true })
      if (!ok) return
      commit((d) => deleteJob(d, job.id))
    }
    toast('Trabalho eliminado')
    navigate('/trabalhos', { replace: true })
  }

  const duplicate = () => {
    setMenu(false)
    let newId = ''
    commit((d, ctx) => {
      const r = duplicateJob(d, job.id, ctx)
      newId = r.id
      return r.data
    })
    toast('Cópia criada — ajusta o que precisares')
    navigate(`/trabalhos/${newId}/editar`, { replace: true })
  }

  return (
    <>
      <AppBar
        title="Trabalho"
        back="/trabalhos"
        actions={
          <>
            <IconButton icon={Pencil} label="Editar" to={`/trabalhos/${job.id}/editar`} />
            <IconButton icon={EllipsisVertical} label="Mais opções" onClick={() => setMenu(true)} />
          </>
        }
      />
      <Page>
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <PayerAvatar name={payer} color={payerColor(job, data.payers)} size={44} />
            <div className="flex min-w-0 flex-1 flex-col">
              <h2 className="text-lg font-bold leading-snug">{job.title}</h2>
              <p className="text-sm text-muted">
                {payer} {!job.payerId && <span className="text-faint">(avulso)</span>}
              </p>
            </div>
            <StatusBadge status={status} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <span>Trabalho: {formatDateLong(job.workDate)}</span>
            {category && (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: category.color }} />
                {category.name}
              </span>
            )}
          </div>
          {job.period && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Repeat aria-hidden className="size-4" /> Rendimento fixo de {formatPeriodPT(job.period)}
            </p>
          )}
          <div>
            <div className="flex items-end justify-between">
              <Money cents={total} className="text-[28px] font-bold" />
              <span className="pb-1 text-sm text-muted">
                {n > 1 ? `${paidCount(job)}/${n} pagos` : isReceived(job.installments[0]!) ? 'pago' : 'por receber'}
              </span>
            </div>
            <div className="mt-2">
              <ProgressBar value={paidAmount(job)} max={total} label="Recebido" />
            </div>
            <p className="mt-2 text-sm text-muted">
              Recebido <Money cents={paidAmount(job)} className="font-semibold text-ink" />
              {remainingAmount(job) > 0 && (
                <>
                  {' · falta '}
                  <Money cents={remainingAmount(job)} className="font-semibold text-ink" />
                </>
              )}
            </p>
          </div>
          <JobInvestBox job={job} today={today} />
        </Card>

        <Section title={n > 1 ? 'Pagamentos' : 'Pagamento'}>
          <ListCard>
            {job.installments.map((inst, i) => {
              const received = isReceived(inst)
              const overdue = isInstallmentOverdue(inst, job, today, data.settings.overdueDays)
              return (
                <div key={inst.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                  <span className={received ? 'text-success' : overdue ? 'text-danger' : 'text-faint'}>
                    {received ? <CircleCheck aria-hidden className="size-6" /> : overdue ? <CircleAlert aria-hidden className="size-6" /> : <span className="block size-6 rounded-full border-2 border-current" />}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">
                      {installmentLabel(i, n)} · <Money cents={inst.amount} />
                    </span>
                    <span className="text-sm text-muted">
                      {received ? (
                        <>
                          Recebida a {formatDateShort(inst.receivedDate!)} por {methodName(inst.methodId)} · investir{' '}
                          {formatMoney(installmentInvest(inst, data.settings.investPlans, today))}
                          {inst.invested && ' · investido ✓'}
                        </>
                      ) : inst.dueDate ? (
                        <span className={overdue ? 'font-medium text-danger' : undefined}>
                          Prevista {formatDateShort(inst.dueDate)} ({dueLabel(today, inst.dueDate)})
                        </span>
                      ) : overdue ? (
                        <span className="font-medium text-danger">
                          Por receber · {dueLabel(today, overdueDateOf(inst, job, data.settings.overdueDays))}
                        </span>
                      ) : (
                        'Por receber'
                      )}
                    </span>
                  </div>
                  {received ? (
                    <IconButton icon={RotateCcw} label="Anular recebimento" onClick={() => void undo(inst.id)} />
                  ) : (
                    <ReceiveButton active={receiving?.installmentId === inst.id} onClick={() => setReceiving({ jobId: job.id, installmentId: inst.id })} />
                  )}
                </div>
              )
            })}
          </ListCard>
        </Section>

        {job.notes && (
          <Section title="Notas">
            <Card className="whitespace-pre-wrap px-4 py-3 text-[15px] leading-relaxed">{job.notes}</Card>
          </Section>
        )}

        {status === 'overdue' && (
          <Badge tone="danger" icon={CircleAlert}>
            Há prestações em atraso — vais receber lembretes até as marcares.
          </Badge>
        )}
        <Link to={`/trabalhos/${job.id}/editar`} className="self-center text-sm font-semibold text-primary-ink">
          Editar trabalho
        </Link>
      </Page>

      <ReceiveSheet target={receiving} onClose={() => setReceiving(null)} />
      <Sheet open={menu} onClose={() => setMenu(false)} title="Mais opções">
        <ListCard>
          <ListRow icon={Copy} title="Duplicar" subtitle="Cria uma cópia com a data de hoje" onClick={duplicate} chevron={false} />
          <ListRow icon={Trash2} title={<span className="text-danger">Eliminar</span>} onClick={() => void remove()} chevron={false} />
        </ListCard>
        <Button variant="ghost" onClick={() => setMenu(false)}>
          Fechar
        </Button>
      </Sheet>
    </>
  )
}

/**
 * Investimento do trabalho: quanto vai para cada destino e se já foi investido.
 * Marca de uma vez todos os pagamentos recebidos ainda por investir.
 */
function JobInvestBox({ job, today }: { job: Job; today: ISODate }) {
  const data = useData()
  const plans = data.settings.investPlans
  const received = jobInvestReceived(job, plans, today)
  const expected = jobInvestExpected(job, plans, today)
  const done = jobInvestDone(job, plans, today)
  const pending = jobInvestPending(job, plans, today)
  const pcts = [...new Set(job.installments.map((i) => installmentPlan(i, plans, today).pct))]
  const parts = jobParts(job, plans, today).filter((p) => p.amount > 0)
  const investedDates = job.installments.flatMap((i) => (i.invested ? [i.invested.date] : [])).sort()
  const lastInvested = investedDates[investedDates.length - 1]

  const mark = () => {
    const refs = job.installments.filter((i) => isReceived(i) && !i.invested).map((i) => ({ jobId: job.id, installmentId: i.id }))
    try {
      commit((d, ctx) => markInvested(d, refs, ctx))
      toast(`Investido: ${formatMoney(pending)}`)
    } catch (e) {
      toastError(e)
    }
  }

  const undo = async () => {
    const ok = await confirm({ title: 'Anular o investimento?', message: 'Volta a contar como «por investir».', confirmLabel: 'Anular' })
    if (!ok) return
    commit((d, ctx) => job.installments.filter((i) => i.invested).reduce((acc, i) => undoInvested(acc, job.id, i.id, ctx), d))
    toast('Investimento anulado')
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-info-soft px-3 py-3 text-sm text-info">
      <p className="flex items-center gap-1.5">
        <PiggyBank aria-hidden className="size-4 shrink-0" />
        <span>
          <span className="font-semibold">{pcts.length === 1 ? `${pctText(pcts[0]!)}% para investir` : 'Para investir'}:</span> {formatMoney(received + expected)}
        </span>
      </p>
      {parts.length > 0 && (
        <ul className="flex flex-col gap-0.5 pl-5.5" aria-label="Divisão do investimento">
          {parts.map((p) => (
            <li key={p.destinationId} className="flex justify-between gap-3">
              <span className="min-w-0">{p.name}</span>
              <Money cents={p.amount} className="font-semibold" />
            </li>
          ))}
        </ul>
      )}
      {done > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 pl-5.5">
          <span className="font-semibold text-success">
            ✓ Investido {formatMoney(done)}
            {lastInvested && ` a ${formatDateShort(lastInvested)}`}
          </span>
          <button type="button" className="font-semibold underline" onClick={() => void undo()}>
            Anular
          </button>
        </p>
      )}
      {pending > 0 && (
        <Button size="sm" icon={PiggyBank} onClick={mark} className="self-start">
          Marcar como investido · {formatMoney(pending)}
        </Button>
      )}
      {expected > 0 && (
        <p className="pl-5.5 text-info/80">{received > 0 ? `Mais ${formatMoney(expected)} quando receberes o resto.` : 'Marcas quando receberes e investires.'}</p>
      )}
    </div>
  )
}
