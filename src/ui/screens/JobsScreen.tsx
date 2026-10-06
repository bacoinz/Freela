import { BriefcaseBusiness, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { formatDateShort, formatPeriodPT } from '../../domain/dates'
import { jobTotal, paidAmount, paidCount, remainingAmount } from '../../domain/installments'
import { jobStatus } from '../../domain/jobs'
import { normalizeName, payerColor, payerKey, payerLabel } from '../../domain/payers'
import type { AppData, Job } from '../../domain/types'
import { useData } from '../../data/app'
import { Button, Fab } from '../components/Button'
import { cn } from '../components/cn'
import { AppBar, Card, EmptyState, ListCard, Page, Section } from '../components/Layout'
import { Field, Segmented, Select, inputClass } from '../components/Form'
import { PayerAvatar } from '../components/Payer'
import { Sheet } from '../components/Sheet'
import { Money, ProgressBar, StatusBadge } from '../components/Status'
import { useToday } from '../hooks'
import { filterJobs, groupByMonth, type JobFilters } from '../logic/jobsView'

/** Uma linha de trabalho (lista e calendário). */
export function JobRow({ job, data, today }: { job: Job; data: AppData; today: string }) {
  const n = job.installments.length
  const total = jobTotal(job)
  const status = jobStatus(job, today, data.settings.overdueDays)
  const category = data.categories.find((c) => c.id === job.categoryId)?.name
  const payer = payerLabel(job, data.payers)
  const showProgress = n > 1 || status === 'partial'
  return (
    <Link to={`/trabalhos/${job.id}`} className="flex gap-3 px-4 py-3 hover:bg-surface-2 active:bg-neutral-soft">
      <PayerAvatar name={payer} color={payerColor(job, data.payers)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate font-medium">
            {job.title}
            {job.period && <span className="text-muted"> · {formatPeriodPT(job.period).split(' de ')[0]}</span>}
          </span>
          <Money cents={total} className="font-semibold" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 text-sm text-muted">
            {payer}
            {category && ` · ${category}`} · {formatDateShort(job.workDate)}
          </span>
          <StatusBadge status={status} />
        </div>
        {showProgress && (
          <div className="mt-1 flex items-center gap-2">
            <ProgressBar value={paidAmount(job)} max={total} label="Recebido" />
            <span className="shrink-0 text-xs text-muted">
              {paidCount(job)}/{n} pagos
              {remainingAmount(job) > 0 && (
                <>
                  {' · falta '}
                  <Money cents={remainingAmount(job)} />
                </>
              )}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}

export function JobsScreen() {
  const data = useData()
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const filters: JobFilters = {
    tab: params.get('f') === 'todos' ? 'todos' : 'receber',
    query: params.get('q') ?? '',
    categoryId: params.get('cat') ?? undefined,
    payerKey: params.get('pag') ?? undefined,
    methodId: params.get('met') ?? undefined,
    year: params.get('ano') ? Number(params.get('ano')) : undefined,
  }
  const set = (patch: Record<string, string | undefined>) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          if (v) p.set(k, v)
          else p.delete(k)
        }
        return p
      },
      { replace: true },
    )

  const jobs = useMemo(() => filterJobs(data, filters, today), [data, today, params]) // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => (filters.tab === 'todos' ? groupByMonth(jobs) : []), [jobs, filters.tab])
  const pendingTotal = jobs.reduce((s, j) => s + remainingAmount(j), 0)

  // Opções dos filtros.
  const payerOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const j of data.jobs) map.set(payerKey(j), payerLabel(j, data.payers))
    return [...map.entries()].sort((a, b) => normalizeName(a[1]).localeCompare(normalizeName(b[1])))
  }, [data])
  const years = useMemo(() => [...new Set(data.jobs.map((j) => Number(j.workDate.slice(0, 4))))].sort((a, b) => b - a), [data])

  const active: { key: string; label: string }[] = []
  if (filters.categoryId) active.push({ key: 'cat', label: data.categories.find((c) => c.id === filters.categoryId)?.name ?? 'Categoria' })
  if (filters.payerKey) active.push({ key: 'pag', label: payerOptions.find(([k]) => k === filters.payerKey)?.[1] ?? 'Pagador' })
  if (filters.methodId) active.push({ key: 'met', label: data.methods.find((m) => m.id === filters.methodId)?.name ?? 'Método' })
  if (filters.year) active.push({ key: 'ano', label: String(filters.year) })

  return (
    <>
      <AppBar title="Trabalhos" />
      <Page withNav>
        <Segmented
          label="Mostrar"
          value={filters.tab}
          onChange={(v) => set({ f: v === 'todos' ? 'todos' : undefined })}
          options={[
            { value: 'receber', label: 'A receber' },
            { value: 'todos', label: 'Todos' },
          ]}
        />
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={filters.query}
              onChange={(e) => set({ q: e.target.value || undefined })}
              placeholder="Pesquisar trabalho, pagador, notas…"
              aria-label="Pesquisar"
              className={cn(inputClass, 'pl-11')}
            />
          </div>
          <Button variant="secondary" icon={SlidersHorizontal} onClick={() => setFiltersOpen(true)} aria-label="Filtros">
            {active.length > 0 ? active.length : null}
          </Button>
        </div>
        {active.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {active.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => set({ [a.key]: undefined })}
                className="inline-flex min-h-9 items-center gap-1 rounded-full bg-primary-soft pl-3 pr-2 text-sm font-medium text-primary-ink"
                aria-label={`Tirar filtro ${a.label}`}
              >
                {a.label} <X aria-hidden className="size-4" />
              </button>
            ))}
          </div>
        )}

        {jobs.length === 0 ? (
          <Card>
            <EmptyState
              icon={BriefcaseBusiness}
              title={filters.tab === 'receber' && !filters.query && active.length === 0 ? 'Nada por receber' : 'Sem trabalhos'}
              text={data.jobs.length === 0 ? 'Regista o teu primeiro trabalho com o botão +.' : 'Experimenta mudar a pesquisa ou os filtros.'}
              action={
                data.jobs.length === 0 && (
                  <Link to="/trabalhos/novo" className="font-semibold text-primary-ink">
                    Novo trabalho
                  </Link>
                )
              }
            />
          </Card>
        ) : filters.tab === 'receber' ? (
          <>
            <p className="px-1 text-sm text-muted">
              Falta receber <Money cents={pendingTotal} className="font-semibold text-ink" /> em {jobs.length}{' '}
              {jobs.length === 1 ? 'trabalho' : 'trabalhos'}
            </p>
            <ListCard>
              {jobs.map((j) => (
                <JobRow key={j.id} job={j} data={data} today={today} />
              ))}
            </ListCard>
          </>
        ) : (
          groups.map((g) => (
            <Section
              key={g.period}
              title={formatPeriodPT(g.period).replace(/^./, (c) => c.toUpperCase())}
              action={<Money cents={g.total} className="text-sm font-semibold text-muted" />}
            >
              <ListCard>
                {g.jobs.map((j) => (
                  <JobRow key={j.id} job={j} data={data} today={today} />
                ))}
              </ListCard>
            </Section>
          ))
        )}
      </Page>
      <Fab to="/trabalhos/novo" label="Trabalho" icon={Plus} />

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtros"
        footer={
          <>
            <Button variant="secondary" block onClick={() => set({ cat: undefined, pag: undefined, met: undefined, ano: undefined })}>
              Limpar
            </Button>
            <Button block onClick={() => setFiltersOpen(false)}>
              Ver resultados
            </Button>
          </>
        }
      >
        <Field label="Categoria">
          <Select value={filters.categoryId ?? ''} onChange={(e) => set({ cat: e.target.value || undefined })}>
            <option value="">Todas</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Pagador">
          <Select value={filters.payerKey ?? ''} onChange={(e) => set({ pag: e.target.value || undefined })}>
            <option value="">Todos</option>
            {payerOptions.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Método de pagamento">
          <Select value={filters.methodId ?? ''} onChange={(e) => set({ met: e.target.value || undefined })}>
            <option value="">Todos</option>
            {data.methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ano do trabalho">
          <Select value={filters.year ? String(filters.year) : ''} onChange={(e) => set({ ano: e.target.value || undefined })}>
            <option value="">Todos</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </Field>
      </Sheet>
    </>
  )
}
