import { todayISO } from '../domain/dates'
import type { OpsContext } from '../domain/types'

/** UUID v4 com getRandomValues (funciona também fora de contextos seguros, ex.: IP da rede local). */
export function uuidFallback(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function uuid(): string {
  return typeof crypto.randomUUID === 'function' && globalThis.isSecureContext !== false
    ? crypto.randomUUID()
    : uuidFallback()
}

/** Contexto para as operações do domínio (ids, hora atual, hoje). */
export function makeCtx(now: Date = new Date()): OpsContext {
  return { newId: uuid, nowISO: () => new Date().toISOString(), today: todayISO(now) }
}
