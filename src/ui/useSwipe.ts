import { useRef, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { classifySwipe, isHorizontalIntent } from './logic/swipe'

interface SwipeState {
  id: number
  x: number
  y: number
  t: number
  horizontal: boolean | null
}

/**
 * Arrastar para os lados num elemento (ex.: o calendário). O elemento acompanha o dedo;
 * no fim, chama `onNext` (arrastou para a esquerda) ou `onPrev` (para a direita), ou volta ao sítio.
 * O scroll vertical da página continua a funcionar (touch-action: pan-y).
 */
export function useHorizontalSwipe({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const state = useRef<SwipeState | null>(null)
  const suppressClick = useRef(false)

  const setOffset = (dx: number, animate: boolean) => {
    const el = ref.current
    if (!el) return
    el.style.transition = animate ? 'transform 180ms ease-out' : 'none'
    el.style.transform = dx ? `translateX(${dx}px)` : ''
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    suppressClick.current = false
    state.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), horizontal: null }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = state.current
    if (!s || e.pointerId !== s.id) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (s.horizontal === null) {
      s.horizontal = isHorizontalIntent(dx, dy)
      if (s.horizontal) {
        try {
          ref.current?.setPointerCapture(e.pointerId)
        } catch {
          /* o ponteiro já não está ativo — continua sem captura */
        }
      }
    }
    if (s.horizontal) setOffset(dx * 0.85, false)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = state.current
    state.current = null
    if (!s || e.pointerId !== s.id || !s.horizontal) return
    suppressClick.current = true // não seleciona um dia depois de arrastar
    const result = classifySwipe(
      { dx: e.clientX - s.x, dy: e.clientY - s.y, ms: performance.now() - s.t },
      ref.current?.clientWidth ?? 320,
    )
    if (!result) {
      setOffset(0, true)
      return
    }
    setOffset(0, false)
    if (result === 'next') onNext()
    else onPrev()
  }

  const onPointerCancel = () => {
    state.current = null
    setOffset(0, true)
  }

  const onClickCapture = (e: ReactMouseEvent) => {
    if (!suppressClick.current) return
    suppressClick.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  return { ref, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture } }
}
