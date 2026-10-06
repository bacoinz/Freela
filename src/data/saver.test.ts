import { describe, expect, it } from 'vitest'
import { createSaver } from './saver'

/** Escrita falsa que só termina quando mandamos. */
function controllableWriter() {
  const writes: string[] = []
  const resolvers: Array<() => void> = []
  const write = (json: string) =>
    new Promise<void>((resolve) => {
      writes.push(json)
      resolvers.push(resolve)
    })
  const finishNext = async () => {
    resolvers.shift()?.()
    await new Promise((r) => setTimeout(r, 0))
  }
  return { writes, write, finishNext }
}

const doc = (n: number) => ({ n }) as never

describe('createSaver', () => {
  it('grava o documento em JSON', async () => {
    const w = controllableWriter()
    const saver = createSaver(w.write)
    saver.save(doc(1))
    await new Promise((r) => setTimeout(r, 0))
    expect(w.writes).toEqual(['{"n":1}'])
  })

  it('nunca escreve em paralelo e junta gravações seguidas (fica a mais recente)', async () => {
    const w = controllableWriter()
    const saver = createSaver(w.write)
    saver.save(doc(1))
    await new Promise((r) => setTimeout(r, 0))
    saver.save(doc(2))
    saver.save(doc(3))
    expect(w.writes).toEqual(['{"n":1}'])
    await w.finishNext()
    expect(w.writes).toEqual(['{"n":1}', '{"n":3}'])
    await w.finishNext()
    expect(w.writes).toHaveLength(2)
  })

  it('flush espera que tudo esteja gravado', async () => {
    const w = controllableWriter()
    const saver = createSaver(w.write)
    saver.save(doc(1))
    let flushed = false
    const p = saver.flush().then(() => (flushed = true))
    await new Promise((r) => setTimeout(r, 0))
    expect(flushed).toBe(false)
    await w.finishNext()
    await p
    expect(flushed).toBe(true)
  })

  it('avisa erros de escrita e continua a funcionar', async () => {
    const errors: unknown[] = []
    let fail = true
    const writes: string[] = []
    const saver = createSaver(
      async (json) => {
        writes.push(json)
        if (fail) throw new Error('disco cheio')
      },
      (e) => errors.push(e),
    )
    saver.save(doc(1))
    await saver.flush()
    expect(errors).toHaveLength(1)
    fail = false
    saver.save(doc(2))
    await saver.flush()
    expect(writes).toEqual(['{"n":1}', '{"n":2}'])
    expect(errors).toHaveLength(1)
  })
})
