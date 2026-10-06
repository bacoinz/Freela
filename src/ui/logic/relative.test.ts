import { describe, expect, it } from 'vitest'
import { dueLabel, sinceLabel } from './relative'

describe('dueLabel', () => {
  it.each([
    ['2026-10-06', 'hoje'],
    ['2026-10-07', 'amanhã'],
    ['2026-10-09', 'faltam 3 dias'],
    ['2026-10-05', 'atrasado há 1 dia'],
    ['2026-09-26', 'atrasado há 10 dias'],
  ])('prazo %s → "%s"', (due, label) => {
    expect(dueLabel('2026-10-06', due)).toBe(label)
  })
})

describe('sinceLabel', () => {
  it.each([
    ['2026-10-06', 'hoje'],
    ['2026-10-05', 'ontem'],
    ['2026-10-01', 'há 5 dias'],
  ])('%s → "%s"', (date, label) => {
    expect(sinceLabel('2026-10-06', date)).toBe(label)
  })
})
