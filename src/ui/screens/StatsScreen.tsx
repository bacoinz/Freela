import { ChartColumnBig, CircleAlert, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { formatDateShort, formatPeriodPT, isoParts } from '../../domain/dates'
import { formatMoney } from '../../domain/money'
import { computeStats, presetRange, statsYears, type StatsPreset } from '../../domain/stats'
import { useData } from '../../data/app'
import { cn } from '../components/cn'
import { Segmented } from '../components/Form'
import { AppBar, Card, EmptyState, ListCard, Page, Section } from '../components/Layout'
import { PayerAvatar } from '../components/Payer'
import { Money } from '../components/Status'
import { BreakdownList, SplitMeter } from '../charts/Breakdown'
import { MonthlyChart } from '../charts/MonthlyChart'
import { useToday } from '../hooks'

const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase())
const pctFmt = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 })

export function StatsScreen() {
  const data = useData()
  const today = useToday()
  const year = isoParts(today)[0]
  // Valor do seletor: "y2026", "y2027", "last12" ou "all".
  const [choice, setChoice] = useState(`y${year}`)
  const [showTable, setShowTable] = useState(false)
  const years = useMemo(() => statsYears(data, today), [data, today])
  const preset: StatsPreset = choice.startsWith('y') ? { kind: 'year', year: Number(choice.slice(1)) } : choice === 'last12' ? { kind: 'last12' } : { kind: 'all' }
  const range = useMemo(() => presetRange(preset, data, today), [choice, data, today]) // eslint-disable-line react-hooks/exhaustive-deps
  const s = useMemo(() => computeStats(data, range, today), [data, range, today])

  const periodLabel =
    preset.kind === 'year'
      ? `em ${preset.year}${preset.year === year ? ' (até hoje)' : ''}`
      : preset.kind === 'last12'
        ? 'nos últimos 12 meses'
        : 'desde o início'
  const prevLabel = preset.kind === 'year' ? (preset.year === year ? `mesmo período de ${year - 1}` : String(preset.year - 1)) : 'ano anterior'

  return (
    <>
      <AppBar title="Estatísticas" />
      <Page withNav>
        <Segmented
          label="Período"
          value={choice}
          onChange={setChoice}
          options={[
            ...years.map((y) => ({ value: `y${y}`, label: String(y) })),
            { value: 'last12', label: '12 meses' },
            { value: 'all', label: 'Tudo' },
          ]}
        />

        <Card className="p-5">
          <p className="text-sm font-medium text-muted">Recebido {periodLabel}</p>
          <Money cents={s.summary.total} display className="mt-1 block text-[34px] font-bold leading-tight tracking-tight" />
          {s.summary.deltaPct !== undefined && s.summary.total > 0 && (
            <p className={cn('mt-1 flex items-center gap-1 text-sm font-semibold', s.summary.deltaPct >= 0 ? 'text-success' : 'text-danger')}>
              {s.summary.deltaPct >= 0 ? <TrendingUp aria-hidden className="size-4" /> : <TrendingDown aria-hidden className="size-4" />}
              {s.summary.deltaPct >= 0 ? '+' : ''}
              {pctFmt.format(s.summary.deltaPct)}% vs. {prevLabel}
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            <Tile label="Média por mês" cents={s.summary.monthlyAvg} />
            <Tile label={`${s.summary.jobsCount} ${s.summary.jobsCount === 1 ? 'trabalho' : 'trabalhos'} · média`} cents={s.summary.avgPerJob} />
          </div>
        </Card>

        <Card className="flex items-start gap-3 p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info">
            <PiggyBank aria-hidden className="size-6" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm text-muted">Para investir — desde o início</span>
            <Money cents={s.investAllTime} display className="text-xl font-bold" />
            <span className="text-sm text-muted">
              {formatMoney(s.summary.invest)} {periodLabel}
              {s.investExpected > 0 && ` · previsto mais ${formatMoney(s.investExpected)}`}
            </span>
            <span className="text-sm text-muted">
              Investido {formatMoney(s.investDone)} · por investir {formatMoney(s.investPending)}
            </span>
            {s.investDoneParts.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 border-t border-line pt-2 text-sm" aria-label="Já investido em cada destino">
                {s.investDoneParts.map((p) => (
                  <li key={p.destinationId} className="flex justify-between gap-3">
                    <span className="text-muted">{p.name}</span>
                    <Money cents={p.amount} className="font-semibold" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {s.summary.total === 0 ? (
          <Card>
            <EmptyState icon={ChartColumnBig} title="Ainda sem recebimentos neste período" text="Quando marcares pagamentos como recebidos, as estatísticas aparecem aqui." />
          </Card>
        ) : (
          <>
            {s.best && s.worst && s.monthly.length > 1 && (
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4">
                  <p className="flex items-center gap-1.5 text-sm text-muted">
                    <TrendingUp aria-hidden className="size-4 text-success" /> Melhor mês
                  </p>
                  <p className="mt-1 font-semibold">{cap(formatPeriodPT(s.best.period))}</p>
                  <Money cents={s.best.total} display className="text-lg font-bold" />
                </Card>
                <Card className="p-4">
                  <p className="flex items-center gap-1.5 text-sm text-muted">
                    <TrendingDown aria-hidden className="size-4 text-danger" /> Pior mês
                  </p>
                  <p className="mt-1 font-semibold">{cap(formatPeriodPT(s.worst.period))}</p>
                  <Money cents={s.worst.total} display className="text-lg font-bold" />
                </Card>
              </div>
            )}

            <Section
              title="Recebido por mês"
              action={
                <button type="button" onClick={() => setShowTable((v) => !v)} className="rounded-lg px-2 py-1.5 text-sm font-semibold text-primary-ink">
                  {showTable ? 'Ver gráfico' : 'Ver tabela'}
                </button>
              }
            >
              <Card className={showTable ? 'overflow-hidden' : 'px-2 pb-2 pt-3'}>
                {showTable ? (
                  <table className="w-full text-sm">
                    <thead className="bg-surface-2 text-left text-muted">
                      <tr>
                        <th className="px-4 py-2 font-semibold">Mês</th>
                        <th className="px-4 py-2 text-right font-semibold">Recebido</th>
                        <th className="px-4 py-2 text-right font-semibold">Investir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {[...s.monthly].reverse().map((m) => (
                        <tr key={m.period}>
                          <td className="px-4 py-2.5">{cap(formatPeriodPT(m.period))}</td>
                          <td className="tnum px-4 py-2.5 text-right font-medium">{formatMoney(m.total)}</td>
                          <td className="tnum px-4 py-2.5 text-right text-muted">{formatMoney(m.invest)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <MonthlyChart months={s.monthly} best={s.best?.period} />
                )}
              </Card>
            </Section>

            <Section title="Por método de recebimento">
              <Card>
                <BreakdownList items={s.byMethod} topLabel="entra mais" />
              </Card>
            </Section>

            <Section title="Por tipo de trabalho">
              <Card>
                <BreakdownList items={s.byCategory} leading={(b) => <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: b.color }} />} />
              </Card>
            </Section>

            {s.summary.fixed > 0 && (
              <Section title="Fixo vs variável">
                <Card>
                  <SplitMeter a={s.summary.fixed} b={s.summary.variable} aLabel="Fixo" bLabel="Variável" />
                </Card>
              </Section>
            )}
          </>
        )}

        {s.byPayer.length > 0 && (
          <Section title="Por pagador">
            <ListCard>
              {s.byPayer.map((p) => (
                <div key={p.key} className="flex items-start gap-3 px-4 py-3">
                  <PayerAvatar name={p.label} color={p.color} size={36} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{p.label}</span>
                      <Money cents={p.total} className="font-semibold" />
                    </div>
                    <span className="text-sm text-muted">
                      {p.jobs > 0 ? `${p.jobs} ${p.jobs === 1 ? 'trabalho' : 'trabalhos'} · média ${formatMoney(p.avgPerJob)}` : 'Sem recebimentos no período'}
                      {p.avgDaysToPay !== undefined && ` · paga em ~${p.avgDaysToPay} ${p.avgDaysToPay === 1 ? 'dia' : 'dias'}`}
                    </span>
                    {p.owed > 0 && <span className="text-sm font-medium text-warning">Deve {formatMoney(p.owed)}</span>}
                  </div>
                </div>
              ))}
            </ListCard>
          </Section>
        )}

        <Section title="Pagamentos ao Estado">
          <Card className="flex flex-col gap-1 p-4">
            <span className="text-sm text-muted">Pago {periodLabel}</span>
            <Money cents={s.statePaid.total} display className="text-xl font-bold" />
            {s.statePaid.total === 0 && <span className="text-sm text-muted">Regista os valores ao marcar as obrigações como pagas.</span>}
          </Card>
        </Section>

        <Section title="Por receber (agora)">
          <Card className="flex flex-col gap-2 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted">Total por receber</span>
              <Money cents={s.pending.total} className="text-lg font-bold" />
            </div>
            {s.pending.overdueTotal > 0 && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-danger">
                <CircleAlert aria-hidden className="size-4" /> {formatMoney(s.pending.overdueTotal)} em atraso ({s.pending.overdueCount}{' '}
                {s.pending.overdueCount === 1 ? 'trabalho' : 'trabalhos'})
              </p>
            )}
            {s.pending.oldest && (
              <Link to={`/trabalhos/${s.pending.oldest.jobId}`} className="text-sm text-primary-ink">
                Mais antigo: {data.jobs.find((j) => j.id === s.pending.oldest!.jobId)?.title} (prazo {formatDateShort(s.pending.oldest.overdueDate)}) ›
              </Link>
            )}
          </Card>
        </Section>
      </Page>
    </>
  )
}

function Tile({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted">{label}</span>
      <Money cents={cents} display className="text-base font-bold" />
    </div>
  )
}
