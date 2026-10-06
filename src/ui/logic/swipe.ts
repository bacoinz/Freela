// Decisões do gesto de arrastar para os lados (ex.: mudar de mês no calendário).

export type SwipeResult = 'next' | 'prev' | null

/** O gesto é horizontal? `null` enquanto o dedo ainda não se mexeu o suficiente para decidir. */
export function isHorizontalIntent(dx: number, dy: number): boolean | null {
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ax < 10 && ay < 10) return null
  return ax > ay
}

/**
 * No fim do gesto: arrastar para a esquerda → 'next', para a direita → 'prev'.
 * Conta se for longo (≥ 20% da largura, mín. 56 px) ou curto mas rápido; ignora gestos verticais.
 */
export function classifySwipe(g: { dx: number; dy: number; ms: number }, width: number): SwipeResult {
  const ax = Math.abs(g.dx)
  const ay = Math.abs(g.dy)
  if (ax < 12 || ay > ax * 0.75) return null
  const longEnough = ax >= Math.max(56, width * 0.2)
  const fastEnough = ax >= 30 && ax / Math.max(g.ms, 1) >= 0.45
  if (!longEnough && !fastEnough) return null
  return g.dx < 0 ? 'next' : 'prev'
}
