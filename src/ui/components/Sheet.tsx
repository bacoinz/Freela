import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { pushOverlay } from '../overlays'
import { IconButton } from './Button'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

let openCount = 0

/** Folha que sobe do fundo do ecrã. Fecha no fundo escurecido, no X, com Esc ou com o "voltar" do Android. */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const close = () => closeRef.current()
    const remove = pushOverlay(close)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    openCount++
    document.body.style.overflow = 'hidden'
    const previous = document.activeElement as HTMLElement | null
    // Foco no painel (para leitores de ecrã e teclado) sem abrir o teclado do telemóvel;
    // um campo com autoFocus fica com o foco.
    requestAnimationFrame(() => {
      if (panel.current && !panel.current.contains(document.activeElement)) panel.current.focus()
    })
    return () => {
      remove()
      window.removeEventListener('keydown', onKey)
      openCount--
      if (openCount === 0) document.body.style.overflow = ''
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div aria-hidden className="anim-fade absolute inset-0 bg-[var(--scrim)]" onClick={() => closeRef.current()} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="anim-sheet relative mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-surface shadow-float focus:outline-none"
      >
        <div className="flex items-center gap-2 px-5 pt-2">
          <span aria-hidden className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-line" />
          <h2 className="min-w-0 flex-1 truncate pt-3 text-lg font-bold">{title}</h2>
          <IconButton icon={X} label="Fechar" onClick={() => closeRef.current()} className="-mr-2 mt-2" />
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-4 pt-2">{children}</div>
        {footer && (
          <div className="flex gap-3 border-t border-line px-5 pt-3" style={{ paddingBottom: 'calc(var(--sab) + 12px)' }}>
            {footer}
          </div>
        )}
        {!footer && <div style={{ height: 'var(--sab)' }} />}
      </div>
    </div>,
    document.body,
  )
}
