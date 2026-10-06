import { Plus, Repeat } from 'lucide-react'
import { useNavigate } from 'react-router'
import { formatMoney } from '../../../domain/money'
import { commit, useData } from '../../../data/app'
import { Button } from '../../components/Button'
import { AppBar, Card, EmptyState, ListCard, ListRow, Page } from '../../components/Layout'
import { PayerAvatar } from '../../components/Payer'
import { Badge } from '../../components/Status'
import { monthsText } from '../../logic/texts'

export function RecurringScreen() {
  const data = useData()
  const navigate = useNavigate()
  return (
    <>
      <AppBar title="Rendimentos fixos" back="/definicoes" />
      <Page>
        <p className="px-1 text-sm leading-relaxed text-muted">
          Para pagamentos certos todos os meses (ex.: aulas numa escola). A app cria sozinha o trabalho de cada mês como «a receber» — só
          tens de marcar quando chegar o dinheiro.
        </p>
        {data.recurring.length === 0 ? (
          <Card>
            <EmptyState icon={Repeat} title="Sem rendimentos fixos" text="Ex.: «Aulas — Escola de Música», 600 €, dia 5." />
          </Card>
        ) : (
          <ListCard>
            {data.recurring.map((r) => {
              const payer = data.payers.find((p) => p.id === r.payerId)
              return (
                <ListRow
                  key={r.id}
                  to={`/definicoes/fixos/${r.id}`}
                  leading={<PayerAvatar name={payer?.name ?? r.title} color={payer?.color} />}
                  title={r.title}
                  subtitle={`${formatMoney(r.amount)} · dia ${r.dayOfMonth} · ${monthsText(r.months)}`}
                  right={!r.active && <Badge tone="neutral">Pausado</Badge>}
                />
              )
            })}
          </ListCard>
        )}
        <Button variant="tonal" icon={Plus} onClick={() => navigate('/definicoes/fixos/novo')}>
          Novo rendimento fixo
        </Button>
        {data.recurring.some((r) => r.active) && (
          <button
            type="button"
            className="self-center text-sm text-muted underline"
            onClick={() => commit((d) => ({ ...d, recurring: d.recurring.map((r) => ({ ...r, active: false })) }))}
          >
            Pausar todos
          </button>
        )}
      </Page>
    </>
  )
}
