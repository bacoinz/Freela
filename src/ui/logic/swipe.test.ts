import { describe, expect, it } from 'vitest'
import { classifySwipe, isHorizontalIntent } from './swipe'

const W = 343 // largura do calendário num telemóvel

describe('classifySwipe', () => {
  it('arrastar para a esquerda vai para o mês seguinte; para a direita, para o anterior', () => {
    expect(classifySwipe({ dx: -120, dy: 10, ms: 300 }, W)).toBe('next')
    expect(classifySwipe({ dx: 120, dy: -8, ms: 300 }, W)).toBe('prev')
  })

  it('ignora toques e movimentos curtos e lentos', () => {
    expect(classifySwipe({ dx: -8, dy: 2, ms: 100 }, W)).toBeNull()
    expect(classifySwipe({ dx: -40, dy: 5, ms: 400 }, W)).toBeNull()
  })

  it('ignora gestos sobretudo verticais (scroll da página)', () => {
    expect(classifySwipe({ dx: -70, dy: 120, ms: 250 }, W)).toBeNull()
  })

  it('aceita um gesto curto mas rápido', () => {
    expect(classifySwipe({ dx: -40, dy: 5, ms: 60 }, W)).toBe('next')
    expect(classifySwipe({ dx: 45, dy: 0, ms: 70 }, W)).toBe('prev')
  })
})

describe('isHorizontalIntent', () => {
  it('decide cedo se o gesto é horizontal', () => {
    expect(isHorizontalIntent(14, 3)).toBe(true)
    expect(isHorizontalIntent(-14, 3)).toBe(true)
    expect(isHorizontalIntent(5, 2)).toBeNull() // ainda não se sabe
    expect(isHorizontalIntent(6, 20)).toBe(false)
  })
})
