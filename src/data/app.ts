import { useStore } from 'zustand'
import type { AppData, OpsContext } from '../domain/types'
import { makeCtx } from './ids'
import { isNative } from './platform'
import { nativeStorage, webStorage } from './storage'
import { createAppStore, type AppState } from './store'

/** Estado global da app (dados + operações). */
export const appStore = createAppStore({ storage: isNative ? nativeStorage : webStorage, makeCtx })

export function useApp<T>(selector: (s: AppState) => T): T {
  return useStore(appStore, selector)
}

/** Dados da app (só usar depois de carregados — os ecrãs só aparecem nessa altura). */
export function useData(): AppData {
  const data = useApp((s) => s.data)
  if (!data) throw new Error('Os dados ainda não estão carregados.')
  return data
}

/** Aplica uma operação aos dados (ver AppState.commit). */
export function commit(fn: (d: AppData, ctx: OpsContext) => AppData, opts?: { touch?: boolean }): AppData {
  return appStore.getState().commit(fn, opts)
}
