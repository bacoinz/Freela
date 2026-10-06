import { beforeEach, describe, expect, it } from 'vitest'
import { addJob } from '../domain/ops'
import { mkCtx, mkData, mkRecurring, resetIds } from '../domain/testkit'
import type { DataStorage } from './storage'
import { createAppStore } from './store'

beforeEach(() => resetIds())

function memoryStorage(initial: string | null = null): DataStorage & { saved: string[] } {
  let value = initial
  const saved: string[] = []
  return {
    describe: 'memória',
    saved,
    load: async () => value,
    save: async (json) => {
      value = json
      saved.push(json)
    },
  }
}

const deps = (storage: DataStorage, today = '2026-10-06') => ({ storage, makeCtx: () => mkCtx(today) })

describe('createAppStore', () => {
  it('na primeira utilização cria os dados por defeito e grava-os', async () => {
    const storage = memoryStorage()
    const store = createAppStore(deps(storage))
    await store.getState().init()
    const s = store.getState()
    expect(s.status).toBe('ready')
    expect(s.data!.categories.map((c) => c.name)).toEqual(['Música', 'Outro'])
    expect(s.data!.obligationRules).toHaveLength(6)
    await s.flush()
    expect(storage.saved).toHaveLength(1)
  })

  it('carrega dados guardados e cria os rendimentos fixos em falta', async () => {
    const saved = mkData({
      payers: [{ id: 'p-escola', name: 'Escola X', color: '#000' }],
      recurring: [mkRecurring()],
    })
    const storage = memoryStorage(JSON.stringify(saved))
    const store = createAppStore(deps(storage))
    await store.getState().init()
    expect(store.getState().data!.jobs).toHaveLength(1)
    await store.getState().flush()
    expect(storage.saved).toHaveLength(1)
  })

  it('não grava ao abrir se nada mudou', async () => {
    const storage = memoryStorage(JSON.stringify(mkData()))
    const store = createAppStore(deps(storage))
    await store.getState().init()
    await store.getState().flush()
    expect(storage.saved).toHaveLength(0)
  })

  it('mostra um erro se o ficheiro estiver estragado', async () => {
    const store = createAppStore(deps(memoryStorage('{ isto não é json')))
    await store.getState().init()
    expect(store.getState().status).toBe('error')
    expect(store.getState().error).toMatch(/não foi possível ler/i)
  })

  it('commit aplica a operação, marca a alteração e grava', async () => {
    const storage = memoryStorage(JSON.stringify(mkData()))
    const store = createAppStore(deps(storage))
    await store.getState().init()
    store.getState().commit((d, ctx) =>
      addJob(
        d,
        {
          title: 'Concerto',
          categoryId: 'cat-musica',
          payer: { kind: 'oneoff', name: 'Bar X' },
          workDate: '2026-10-06',
          investPct: 15,
          installments: [{ amount: 15000 }],
        },
        ctx,
      ).data,
    )
    const data = store.getState().data!
    expect(data.jobs).toHaveLength(1)
    expect(data.settings.lastChangeAt).toBe('2026-10-06T12:00:00.000Z')
    await store.getState().flush()
    expect(JSON.parse(storage.saved.at(-1)!).jobs).toHaveLength(1)
  })

  it('commit sem "touch" não marca alteração', async () => {
    const store = createAppStore(deps(memoryStorage(JSON.stringify(mkData()))))
    await store.getState().init()
    store.getState().commit((d) => ({ ...d, settings: { ...d.settings, lastAutoBackupDate: '2026-10-06' } }), { touch: false })
    expect(store.getState().data!.settings.lastChangeAt).toBeUndefined()
  })

  it('se a operação falhar, os dados ficam como estavam e o erro chega a quem chamou', async () => {
    const store = createAppStore(deps(memoryStorage(JSON.stringify(mkData()))))
    await store.getState().init()
    const before = store.getState().data
    expect(() =>
      store.getState().commit(() => {
        throw new Error('Escreve uma descrição do trabalho.')
      }),
    ).toThrow(/descrição/)
    expect(store.getState().data).toBe(before)
  })

  it('replaceAll e startFresh substituem os dados', async () => {
    const storage = memoryStorage('{ estragado')
    const store = createAppStore(deps(storage))
    await store.getState().init()
    store.getState().startFresh()
    expect(store.getState().status).toBe('ready')
    expect(store.getState().data!.jobs).toEqual([])
    store.getState().replaceAll(mkData({ payers: [{ id: 'p1', name: 'A', color: '#1' }] }))
    expect(store.getState().data!.payers).toHaveLength(1)
    await store.getState().flush()
    expect(JSON.parse(storage.saved.at(-1)!).payers).toHaveLength(1)
  })
})
