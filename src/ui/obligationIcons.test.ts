import { Banknote, Guitar, ListChecks } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { defaultObligationRules } from '../domain/obligations'
import { OBLIGATION_ICONS, ruleIcon } from './obligationIcons'

const rule = defaultObligationRules('2026-10-06', () => 'x')[0]!

describe('ruleIcon', () => {
  it('usa o ícone escolhido', () => {
    expect(ruleIcon({ ...rule, icon: 'guitar' })).toBe(Guitar)
  })

  it('sem ícone (ou com um que já não existe), usa o do tipo', () => {
    expect(ruleIcon({ ...rule, kind: 'pagamento' })).toBe(Banknote)
    expect(ruleIcon({ ...rule, kind: 'outro', icon: 'nao-existe' })).toBe(ListChecks)
  })

  it('a lista de ícones não tem ids repetidos e todos têm nome', () => {
    const ids = OBLIGATION_ICONS.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(OBLIGATION_ICONS.every((i) => i.label.trim().length > 0)).toBe(true)
  })
})
