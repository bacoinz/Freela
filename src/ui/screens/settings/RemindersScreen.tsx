import { BellRing, Info } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { formatDayMonth, WEEKDAYS_SHORT_PT, weekdayMon0 } from '../../../domain/dates'
import { planReminders } from '../../../domain/reminders'
import { commit, useData } from '../../../data/app'
import { notificationPermission, requestNotificationPermission, sendTestNotification, type NotifPermission } from '../../../data/notifications'
import { isNative } from '../../../data/platform'
import { Button } from '../../components/Button'
import { toast } from '../../components/Feedback'
import { Field, Select, Toggle } from '../../components/Form'
import { AppBar, Card, EmptyState, ListCard, Page, Section, TextLink } from '../../components/Layout'

const pad = (h: number) => `${String(h).padStart(2, '0')}:00`

export function RemindersScreen() {
  const data = useData()
  const s = data.settings
  const [perm, setPerm] = useState<NotifPermission>('unavailable')
  useEffect(() => {
    void notificationPermission().then(setPerm)
  }, [])

  // Mostra sempre o que seria lembrado (mesmo com os lembretes desligados).
  const plan = useMemo(() => planReminders({ ...data, settings: { ...s, remindersEnabled: true } }, new Date(), 60), [data, s])

  const setEnabled = async (on: boolean) => {
    if (on && isNative) {
      const p = perm === 'granted' ? 'granted' : await requestNotificationPermission()
      setPerm(p)
      if (p !== 'granted') toast('Para receberes lembretes, autoriza as notificações da app Freela nas definições do Android.', 'error')
    }
    commit((d) => ({ ...d, settings: { ...d.settings, remindersEnabled: on } }), { touch: false })
  }

  return (
    <>
      <AppBar title="Lembretes" back="/definicoes" />
      <Page>
        <Card className="divide-y divide-line">
          <Toggle checked={s.remindersEnabled} onChange={(v) => void setEnabled(v)} label="Lembretes" description="Pagamentos em atraso e prazos do Estado. No máximo uma notificação por dia." />
          <div className="px-4 py-3">
            <Field label="Hora dos lembretes">
              <Select
                value={s.reminderHour}
                onChange={(e) => commit((d) => ({ ...d, settings: { ...d.settings, reminderHour: Number(e.target.value) } }), { touch: false })}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {pad(h)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        {isNative ? (
          <div className="flex flex-col gap-2">
            {perm === 'denied' && (
              <p className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger">
                As notificações estão bloqueadas. Ativa-as em Definições do Android → Apps → Freela → Notificações.
              </p>
            )}
            <Button variant="secondary" icon={BellRing} onClick={() => void sendTestNotification().then(() => toast('A notificação de teste chega daqui a 5 segundos.', 'info'))}>
              Enviar notificação de teste
            </Button>
          </div>
        ) : (
          <p className="flex gap-2 rounded-xl bg-info-soft px-3 py-2.5 text-sm text-info">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
            No browser não há notificações. Esta lista mostra exatamente o que a app vai lembrar no telemóvel.
          </p>
        )}

        <Section title="Próximos lembretes (60 dias)" action={<TextLink to="/obrigacoes/prazos">Regras</TextLink>}>
          {!s.remindersEnabled && <p className="px-1 text-sm text-warning">Os lembretes estão desligados — isto é o que seria lembrado.</p>}
          {plan.length === 0 ? (
            <Card>
              <EmptyState icon={BellRing} title="Nada para lembrar" text="Não há prazos nem pagamentos em atraso nos próximos 60 dias." />
            </Card>
          ) : (
            <ListCard>
              {plan.map((p) => (
                <div key={p.id} className="flex gap-3 px-4 py-3">
                  <div className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-neutral-soft py-1.5">
                    <span className="text-[11px] font-semibold uppercase text-muted">{WEEKDAYS_SHORT_PT[weekdayMon0(p.date)]}</span>
                    <span className="tnum text-sm font-bold">{formatDayMonth(p.date)}</span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{p.title}</span>
                    <span className="text-sm text-muted">{p.body}</span>
                    <span className="text-xs text-faint">às {pad(s.reminderHour)}</span>
                  </div>
                </div>
              ))}
            </ListCard>
          )}
        </Section>
      </Page>
    </>
  )
}
