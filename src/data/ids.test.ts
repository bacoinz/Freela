import { describe, expect, it } from 'vitest'
import { makeCtx, uuidFallback } from './ids'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('ids', () => {
  it('a alternativa ao randomUUID gera UUIDs v4 válidos e diferentes', () => {
    const a = uuidFallback()
    const b = uuidFallback()
    expect(a).toMatch(UUID)
    expect(b).toMatch(UUID)
    expect(a).not.toBe(b)
  })

  it('makeCtx usa a data local de hoje', () => {
    const ctx = makeCtx(new Date(2026, 9, 6, 23, 30))
    expect(ctx.today).toBe('2026-10-06')
    expect(ctx.newId()).toMatch(UUID)
    expect(ctx.nowISO()).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
