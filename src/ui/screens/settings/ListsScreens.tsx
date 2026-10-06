import { Archive, ArchiveRestore, Bookmark, Check, Plus, Trash2 } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { CATEGORY_COLORS } from '../../../domain/defaults'
import {
  addCategory,
  addMethod,
  addPayer,
  promoteOneOff,
  removeCategory,
  removeMethod,
  removePayer,
  updateCategory,
  updateMethod,
  updatePayer,
} from '../../../domain/ops'
import { nextPayerColor, normalizeName, PAYER_PALETTE } from '../../../domain/payers'
import type { AppData, OpsContext } from '../../../domain/types'
import { commit, useData } from '../../../data/app'
import { Button } from '../../components/Button'
import { cn } from '../../components/cn'
import { confirm, toast, toastError } from '../../components/Feedback'
import { Field, TextInput } from '../../components/Form'
import { AppBar, Card, EmptyState, ListCard, ListRow, Page, Section } from '../../components/Layout'
import { PayerAvatar } from '../../components/Payer'
import { Sheet } from '../../components/Sheet'

type Kind = 'payer' | 'category' | 'method'

interface Item {
  id: string
  name: string
  color?: string
  archived?: boolean
}

interface KindConfig {
  title: string
  newLabel: string
  emptyText: string
  palette?: readonly string[]
  items: (d: AppData) => Item[]
  usage: (d: AppData, id: string) => number
  add: (d: AppData, name: string, color: string, ctx: OpsContext) => AppData
  update: (d: AppData, id: string, patch: { name?: string; color?: string; archived?: boolean }) => AppData
  remove: (d: AppData, id: string) => AppData
}

const CONFIG: Record<Kind, KindConfig> = {
  payer: {
    title: 'Pagadores',
    newLabel: 'Novo pagador',
    emptyText: 'Os pagadores que guardares ao criar trabalhos aparecem aqui.',
    palette: PAYER_PALETTE,
    items: (d) => d.payers,
    usage: (d, id) => d.jobs.filter((j) => j.payerId === id).length,
    add: (d, name, color, ctx) => addPayer(d, name, ctx, color).data,
    update: updatePayer,
    remove: removePayer,
  },
  category: {
    title: 'Tipos de trabalho',
    newLabel: 'Novo tipo',
    emptyText: '',
    palette: [...CATEGORY_COLORS, ...PAYER_PALETTE],
    items: (d) => d.categories,
    usage: (d, id) => d.jobs.filter((j) => j.categoryId === id).length,
    add: (d, name, color, ctx) => addCategory(d, name, color, ctx).data,
    update: updateCategory,
    remove: removeCategory,
  },
  method: {
    title: 'Métodos de pagamento',
    newLabel: 'Novo método',
    emptyText: '',
    items: (d) => d.methods,
    usage: (d, id) => d.jobs.reduce((n, j) => n + j.installments.filter((i) => i.methodId === id).length, 0),
    add: (d, name, _c, ctx) => addMethod(d, name, ctx).data,
    update: updateMethod,
    remove: removeMethod,
  },
}

function Leading({ kind, item }: { kind: Kind; item: Item }) {
  if (kind === 'payer') return <PayerAvatar name={item.name} color={item.color} />
  if (kind === 'category') return <span aria-hidden className="mx-3 size-4 shrink-0 rounded-full" style={{ background: item.color }} />
  return null
}

function ListManager({ kind }: { kind: Kind }) {
  const data = useData()
  const cfg = CONFIG[kind]
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const items = cfg.items(data)
  const active = items.filter((i) => !i.archived)
  const archived = items.filter((i) => i.archived)

  const oneOffs = useMemo(() => {
    if (kind !== 'payer') return []
    const saved = new Set(data.payers.map((p) => normalizeName(p.name)))
    const map = new Map<string, { name: string; count: number }>()
    for (const j of data.jobs) {
      if (j.payerId || !j.payerName) continue
      const k = normalizeName(j.payerName)
      if (saved.has(k)) continue
      map.set(k, { name: map.get(k)?.name ?? j.payerName, count: (map.get(k)?.count ?? 0) + 1 })
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [data, kind])

  const subtitle = (i: Item) => {
    const n = cfg.usage(data, i.id)
    if (kind === 'method') return n ? `${n} pagamento${n > 1 ? 's' : ''}` : 'Sem pagamentos'
    return n ? `${n} trabalho${n > 1 ? 's' : ''}` : 'Sem trabalhos'
  }

  return (
    <>
      <AppBar title={cfg.title} back="/definicoes" />
      <Page>
        {active.length === 0 ? (
          <Card>
            <EmptyState icon={Bookmark} title="Ainda nada aqui" text={cfg.emptyText} />
          </Card>
        ) : (
          <ListCard>
            {active.map((i) => (
              <ListRow key={i.id} leading={<Leading kind={kind} item={i} />} title={i.name} subtitle={subtitle(i)} onClick={() => setEditing(i)} chevron />
            ))}
          </ListCard>
        )}
        <Button variant="tonal" icon={Plus} onClick={() => setEditing('new')}>
          {cfg.newLabel}
        </Button>

        {oneOffs.length > 0 && (
          <Section title="Avulsos já usados">
            <ListCard>
              {oneOffs.map((o) => (
                <ListRow
                  key={o.name}
                  leading={<PayerAvatar name={o.name} />}
                  title={o.name}
                  subtitle={`${o.count} trabalho${o.count > 1 ? 's' : ''}`}
                  right={
                    <Button
                      size="sm"
                      variant="tonal"
                      icon={Bookmark}
                      onClick={() => {
                        commit((d, ctx) => promoteOneOff(d, o.name, ctx).data)
                        toast(`«${o.name}» guardado`)
                      }}
                    >
                      Guardar
                    </Button>
                  }
                />
              ))}
            </ListCard>
          </Section>
        )}

        {archived.length > 0 && (
          <Section title="Arquivados">
            <ListCard>
              {archived.map((i) => (
                <ListRow
                  key={i.id}
                  leading={<Leading kind={kind} item={i} />}
                  title={<span className="text-muted">{i.name}</span>}
                  right={
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={ArchiveRestore}
                      onClick={() => {
                        commit((d) => cfg.update(d, i.id, { archived: false }))
                        toast('Reposto')
                      }}
                    >
                      Repor
                    </Button>
                  }
                />
              ))}
            </ListCard>
          </Section>
        )}
      </Page>
      <EditSheet kind={kind} target={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function EditSheet({ kind, target, onClose }: { kind: Kind; target: Item | 'new' | null; onClose: () => void }) {
  const data = useData()
  const cfg = CONFIG[kind]
  const id = useId()
  const item = target && target !== 'new' ? target : null
  const defaultColor = kind === 'payer' ? nextPayerColor(data.payers) : CATEGORY_COLORS[data.categories.length % CATEGORY_COLORS.length]!
  const [name, setName] = useState('')
  const [color, setColor] = useState(defaultColor)
  const [lastTarget, setLastTarget] = useState<typeof target>(null)
  if (target !== lastTarget) {
    setLastTarget(target)
    setName(item?.name ?? '')
    setColor(item?.color ?? defaultColor)
  }

  const save = () => {
    try {
      commit((d, ctx) => (item ? cfg.update(d, item.id, { name, color }) : cfg.add(d, name, color, ctx)))
      toast('Guardado')
      onClose()
    } catch (e) {
      toastError(e)
    }
  }

  const remove = async () => {
    if (!item) return
    const used = cfg.usage(data, item.id) > 0
    const ok = await confirm({
      title: used ? `Arquivar «${item.name}»?` : `Eliminar «${item.name}»?`,
      message: used ? 'Está em uso: sai das listas, mas o histórico mantém-se. Podes repor mais tarde.' : undefined,
      confirmLabel: used ? 'Arquivar' : 'Eliminar',
      danger: !used,
    })
    if (!ok) return
    try {
      commit((d) => cfg.remove(d, item.id))
      toast(used ? 'Arquivado' : 'Eliminado')
      onClose()
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <Sheet
      open={target !== null}
      onClose={onClose}
      title={item ? 'Editar' : cfg.newLabel}
      footer={
        <Button block size="lg" icon={Check} onClick={save}>
          Guardar
        </Button>
      }
    >
      <Field label="Nome" htmlFor={id}>
        <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      {cfg.palette && (
        <Field label="Cor">
          <div role="radiogroup" aria-label="Cor" className="flex flex-wrap gap-2">
            {cfg.palette.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={`Cor ${c}`}
                onClick={() => setColor(c)}
                className={cn('flex size-11 items-center justify-center rounded-full', color === c && 'ring-2 ring-ink ring-offset-2 ring-offset-surface')}
                style={{ background: c }}
              >
                {color === c && <Check aria-hidden className="size-5 text-white" />}
              </button>
            ))}
          </div>
        </Field>
      )}
      {item && (
        <Button variant="secondary" icon={cfg.usage(data, item.id) > 0 ? Archive : Trash2} onClick={() => void remove()}>
          {cfg.usage(data, item.id) > 0 ? 'Arquivar' : 'Eliminar'}
        </Button>
      )}
    </Sheet>
  )
}

export const PayersScreen = () => <ListManager kind="payer" />
export const CategoriesScreen = () => <ListManager kind="category" />
export const MethodsScreen = () => <ListManager kind="method" />
