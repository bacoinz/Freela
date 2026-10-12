import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useData } from '../../data/app'
import { Button } from '../components/Button'
import { AppBar, ListCard, ListRow, Page } from '../components/Layout'
import { Badge } from '../components/Status'
import { reminderText, scheduleText } from '../logic/texts'
import { ruleIcon } from '../obligationIcons'

export function ObligationRulesScreen() {
  const data = useData()
  const navigate = useNavigate()
  const rules = [...data.obligationRules].sort((a, b) => Number(b.active) - Number(a.active))
  return (
    <>
      <AppBar title="Gerir prazos" back="/obrigacoes" />
      <Page>
        <p className="px-1 text-sm leading-relaxed text-muted">
          Os prazos do Estado já vêm pré-carregados. Podes ajustar datas e lembretes, desligar os que não se aplicam a ti ou criar prazos
          teus (ex.: seguro do instrumento, quotas).
        </p>
        <ListCard>
          {rules.map((r) => {
            const Icon = ruleIcon(r)
            return (
              <ListRow
                key={r.id}
                to={`/obrigacoes/prazos/${r.id}`}
                leading={
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-neutral-soft text-muted">
                    <Icon aria-hidden className="size-5" />
                  </span>
                }
                title={<span className={r.active ? undefined : 'text-muted'}>{r.title}</span>}
                subtitle={
                  <>
                    {scheduleText(r.schedule)}
                    <br />
                    <span className="text-faint">Lembra: {reminderText(r).replace(/^./, (c) => c.toLowerCase())}</span>
                  </>
                }
                right={!r.active && <Badge tone="neutral">Desligado</Badge>}
              />
            )
          })}
        </ListCard>
        <Button variant="tonal" icon={Plus} onClick={() => navigate('/obrigacoes/prazos/novo')}>
          Novo prazo
        </Button>
      </Page>
    </>
  )
}
