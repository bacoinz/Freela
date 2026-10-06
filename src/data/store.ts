import { createStore } from 'zustand/vanilla'
import { createDefaultData } from '../domain/defaults'
import { applyRecurring } from '../domain/ops'
import { parseAppData } from '../domain/schema'
import type { AppData, OpsContext } from '../domain/types'
import { createSaver } from './saver'
import type { DataStorage } from './storage'

export type LoadStatus = 'loading' | 'ready' | 'error'

export interface AppState {
  status: LoadStatus
  /** Mensagem quando os dados guardados não puderam ser lidos. */
  error?: string
  data: AppData | null
  /** Último erro ao gravar (ex.: armazenamento cheio). */
  saveError?: string
  init(): Promise<void>
  /**
   * Aplica uma operação aos dados e grava. Se a operação lançar um erro (validação),
   * os dados não mudam e o erro chega a quem chamou.
   * `touch: false` não marca a alteração (para metadados como a data do último backup).
   */
  commit(fn: (d: AppData, ctx: OpsContext) => AppData, opts?: { touch?: boolean }): AppData
  replaceAll(d: AppData): void
  startFresh(): void
  /** Ao voltar à app noutro dia/mês: cria os rendimentos fixos em falta. */
  refreshDay(): void
  flush(): Promise<void>
}

export interface StoreDeps {
  storage: DataStorage
  makeCtx: () => OpsContext
  onSaveError?: (e: unknown) => void
}

export function createAppStore(deps: StoreDeps) {
  return createStore<AppState>()((set, get) => {
    const saver = createSaver(
      (json) => deps.storage.save(json),
      (e) => {
        set({ saveError: e instanceof Error ? e.message : String(e) })
        deps.onSaveError?.(e)
      },
    )

    const persist = (data: AppData) => {
      set({ data, saveError: undefined })
      saver.save(data)
    }

    return {
      status: 'loading',
      data: null,

      async init() {
        const ctx = deps.makeCtx()
        let raw: string | null
        try {
          raw = await deps.storage.load()
        } catch (e) {
          set({ status: 'error', error: `Não foi possível ler os dados guardados (${String(e)}).` })
          return
        }
        let data: AppData
        let changed = false
        if (raw === null) {
          data = createDefaultData(ctx)
          changed = true
        } else {
          try {
            data = parseAppData(JSON.parse(raw))
          } catch (e) {
            const why = e instanceof SyntaxError ? 'o ficheiro está estragado' : e instanceof Error ? e.message : String(e)
            set({ status: 'error', error: `Não foi possível ler os dados guardados: ${why}` })
            return
          }
        }
        const withRecurring = applyRecurring(data, ctx)
        if (withRecurring !== data) changed = true
        set({ status: 'ready', error: undefined, data: withRecurring })
        if (changed) saver.save(withRecurring)
      },

      commit(fn, opts) {
        const current = get().data
        if (!current) throw new Error('Os dados ainda não estão carregados.')
        const ctx = deps.makeCtx()
        let next = fn(current, ctx)
        if (next === current) return current
        if (opts?.touch !== false) next = { ...next, settings: { ...next.settings, lastChangeAt: ctx.nowISO() } }
        persist(next)
        return next
      },

      replaceAll(data) {
        set({ status: 'ready', error: undefined })
        persist(data)
      },

      startFresh() {
        set({ status: 'ready', error: undefined })
        persist(createDefaultData(deps.makeCtx()))
      },

      refreshDay() {
        const current = get().data
        if (!current) return
        const next = applyRecurring(current, deps.makeCtx())
        if (next !== current) persist(next)
      },

      flush() {
        return saver.flush()
      },
    }
  })
}
