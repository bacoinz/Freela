import type { AppData } from '../domain/types'

export interface Saver {
  /** Pede para gravar (as gravações seguidas juntam-se; fica sempre a mais recente). */
  save(data: AppData): void
  /** Resolve quando tudo o que foi pedido estiver gravado. */
  flush(): Promise<void>
}

/** Fila de gravação: nunca escreve em paralelo e não perde a versão mais recente. */
export function createSaver(write: (json: string) => Promise<void>, onError?: (e: unknown) => void): Saver {
  let latest: AppData | null = null
  let queued = false
  let chain: Promise<void> = Promise.resolve()

  return {
    save(data) {
      latest = data
      if (queued) return
      queued = true
      chain = chain.then(async () => {
        queued = false
        const doc = latest
        latest = null
        if (!doc) return
        try {
          await write(JSON.stringify(doc))
        } catch (e) {
          onError?.(e)
        }
      })
    },
    flush() {
      return chain
    },
  }
}
