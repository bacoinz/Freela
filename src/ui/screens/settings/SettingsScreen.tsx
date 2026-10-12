import { Bell, BriefcaseBusiness, CreditCard, Database, PiggyBank, Repeat, ShieldCheck, Tag, Users } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { formatPeriodPT, periodOf } from '../../../domain/dates'
import { currentPlan, pctText } from '../../../domain/invest'
import { setInvestPlan, updateSettings } from '../../../domain/ops'
import { commit, useData } from '../../../data/app'
import { canLock, unlock } from '../../../data/lock'
import { isNative } from '../../../data/platform'
import { cn } from '../../components/cn'
import { toast, toastError } from '../../components/Feedback'
import { Toggle, inputClass } from '../../components/Form'
import { AppBar, Card, ListCard, ListRow, Page, Section } from '../../components/Layout'
import { useToday } from '../../hooks'

const pad = (h: number) => `${String(h).padStart(2, '0')}:00`

/** Campo numérico pequeno que grava ao sair do campo. */
function NumberSetting({ label, description, value, suffix, onSave }: { label: string; description?: string; value: number; suffix: string; onSave: (n: number) => void }) {
  const id = useId()
  const [text, setText] = useState(String(value).replace('.', ','))
  useEffect(() => setText(String(value).replace('.', ',')), [value])
  const commitValue = () => {
    const n = Number(text.replace(',', '.'))
    if (!Number.isFinite(n) || text.trim() === '') {
      setText(String(value).replace('.', ','))
      return
    }
    if (n !== value) onSave(n)
  }
  return (
    <div className="flex min-h-16 items-center gap-3 px-4 py-2.5">
      <label htmlFor={id} className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{label}</span>
        {description && <span className="text-sm text-muted">{description}</span>}
      </label>
      <div className="flex shrink-0 items-center gap-2">
        <input
          id={id}
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitValue}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className={cn(inputClass, 'tnum h-11 w-16 px-2 text-center')}
        />
        <span className="w-8 text-sm text-muted">{suffix}</span>
      </div>
    </div>
  )
}

export function SettingsScreen() {
  const data = useData()
  const s = data.settings
  const today = useToday()
  const plan = currentPlan(data, today)
  const savePct = (n: number) => {
    try {
      commit((d, ctx) => setInvestPlan(d, { pct: n }, ctx))
      toast(`Para investir: ${pctText(n)}% a partir de ${formatPeriodPT(periodOf(today))}`)
    } catch (e) {
      toastError(e)
    }
  }
  const save = (patch: Parameters<typeof updateSettings>[1], msg: string) => {
    try {
      commit((d) => updateSettings(d, patch))
      toast(msg)
    } catch (e) {
      toastError(e)
    }
  }

  const toggleLock = async (on: boolean) => {
    if (on) {
      if (!(await canLock())) {
        toast('Primeiro configura um bloqueio de ecrã (impressão digital ou PIN) nas definições do telemóvel.', 'error')
        return
      }
      if (!(await unlock())) return
    } else if (!(await unlock())) {
      return
    }
    commit((d) => ({ ...d, settings: { ...d.settings, lockEnabled: on, lockInitialized: true } }), { touch: false })
    toast(on ? 'Bloqueio ligado' : 'Bloqueio desligado')
  }

  const activeRecurring = data.recurring.filter((r) => r.active).length
  return (
    <>
      <AppBar title="Definições" back="/" />
      <Page>
        <Section title="Investimento e atrasos">
          <Card className="divide-y divide-line">
            <NumberSetting
              label="Percentagem para investir"
              description={`Conta a partir de ${formatPeriodPT(periodOf(today))}; os meses anteriores mantêm a sua %.`}
              value={plan.pct}
              suffix="%"
              onSave={savePct}
            />
            <ListRow
              icon={PiggyBank}
              title="Destinos do investimento"
              subtitle={plan.destinations.map((d) => `${d.name} ${pctText(d.pct)}%`).join(' · ')}
              to="/investir"
            />
            <NumberSetting
              label="Dias até ficar em atraso"
              description="Para pagamentos sem data prevista, contados desde a data do trabalho."
              value={s.overdueDays}
              suffix="dias"
              onSave={(n) => save({ overdueDays: Math.round(n) }, 'Guardado')}
            />
          </Card>
        </Section>

        <Section title="Rendimentos">
          <ListCard>
            <ListRow icon={Repeat} title="Rendimentos fixos mensais" subtitle={activeRecurring ? `${activeRecurring} ativo${activeRecurring > 1 ? 's' : ''}` : 'Ex.: aulas na escola de música'} to="/definicoes/fixos" />
          </ListCard>
        </Section>

        <Section title="Lembretes e segurança">
          <ListCard>
            <ListRow icon={Bell} title="Lembretes" subtitle={s.remindersEnabled ? `Ligados, às ${pad(s.reminderHour)}` : 'Desligados'} to="/definicoes/lembretes" />
            <Toggle
              checked={s.lockEnabled}
              onChange={(v) => void toggleLock(v)}
              disabled={!isNative}
              label="Bloqueio com impressão digital"
              description={isNative ? 'Pede a impressão digital ou o PIN ao abrir a app.' : 'Disponível na app Android.'}
            />
          </ListCard>
        </Section>

        <Section title="Listas">
          <ListCard>
            <ListRow icon={Users} title="Pagadores" subtitle={`${data.payers.filter((p) => !p.archived).length} guardados`} to="/definicoes/pagadores" />
            <ListRow icon={Tag} title="Tipos de trabalho" subtitle={data.categories.filter((c) => !c.archived).map((c) => c.name).join(', ')} to="/definicoes/categorias" />
            <ListRow icon={CreditCard} title="Métodos de pagamento" subtitle={data.methods.filter((m) => !m.archived).map((m) => m.name).join(', ')} to="/definicoes/metodos" />
          </ListCard>
        </Section>

        <Section title="Dados">
          <ListCard>
            <ListRow icon={Database} title="Cópias de segurança e exportar" subtitle="Backup, Excel (CSV) e importar" to="/definicoes/dados" />
          </ListCard>
        </Section>

        <div className="flex flex-col items-center gap-1 py-2 text-center text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck aria-hidden className="size-4" /> Os teus dados ficam só neste dispositivo.
          </span>
          <span className="inline-flex items-center gap-1">
            <BriefcaseBusiness aria-hidden className="size-4" /> Freela · versão {__APP_VERSION__}
          </span>
        </div>
      </Page>
    </>
  )
}
