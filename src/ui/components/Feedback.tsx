import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { create } from 'zustand'
import { Button } from './Button'
import { cn } from './cn'
import { Sheet } from './Sheet'

// ---------- Avisos rápidos (toasts) ----------

type Tone = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  message: string
  tone: Tone
}

const useToasts = create<{ items: ToastItem[]; remove: (id: number) => void }>((set) => ({
  items: [],
  remove: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}))

let toastSeq = 0

/** Mostra um aviso curto (desaparece sozinho). */
export function toast(message: string, tone: Tone = 'success') {
  const id = ++toastSeq
  useToasts.setState((s) => ({ items: [...s.items.slice(-2), { id, message, tone }] }))
  setTimeout(() => useToasts.getState().remove(id), tone === 'error' ? 6000 : 3500)
}

/** Mostra o erro de uma operação (ex.: validação) como aviso. */
export function toastError(e: unknown) {
  toast(e instanceof Error ? e.message : String(e), 'error')
}

const TONE_ICON = { success: CircleCheck, error: CircleAlert, info: Info }

const TAB_PATHS = new Set(['/', '/trabalhos', '/calendario', '/obrigacoes', '/estatisticas'])

export function ToastHost() {
  const items = useToasts((s) => s.items)
  const { pathname } = useLocation()
  const bottom = TAB_PATHS.has(pathname) ? 'calc(var(--nav-h) + var(--sab) + 84px)' : 'calc(var(--sab) + 92px)'
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[60] mx-auto flex max-w-xl flex-col items-center gap-2 px-4"
      style={{ bottom }}
    >
      {items.map((t) => {
        const Icon = TONE_ICON[t.tone]
        return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            onClick={() => useToasts.getState().remove(t.id)}
            className="anim-toast pointer-events-auto flex w-full items-start gap-2.5 rounded-2xl bg-ink px-4 py-3 text-[15px] text-bg shadow-float"
          >
            <Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', t.tone === 'error' ? 'text-danger-strong' : 'opacity-80')} />
            <span className="min-w-0 flex-1">{t.message}</span>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Perguntas (confirmar / escolher) ----------

export interface ChoiceOption<T> {
  value: T
  label: string
  tone?: 'primary' | 'danger' | 'secondary'
}

interface DialogState {
  title: string
  message?: string
  options: ChoiceOption<unknown>[]
  resolve: (v: unknown) => void
}

const useDialog = create<{ current: DialogState | null }>(() => ({ current: null }))

/** Pergunta com várias opções; devolve a escolhida ou `null` se cancelar. */
export function choose<T>(title: string, options: ChoiceOption<T>[], message?: string): Promise<T | null> {
  return new Promise((resolve) => {
    useDialog.getState().current?.resolve(null)
    useDialog.setState({
      current: { title, message, options: options as ChoiceOption<unknown>[], resolve: resolve as (v: unknown) => void },
    })
  })
}

/** Confirmação simples (ex.: antes de eliminar). */
export async function confirm(opts: { title: string; message?: string; confirmLabel: string; danger?: boolean }): Promise<boolean> {
  const r = await choose(opts.title, [{ value: true, label: opts.confirmLabel, tone: opts.danger ? 'danger' : 'primary' }], opts.message)
  return r === true
}

export function DialogHost() {
  const current = useDialog((s) => s.current)
  const close = (v: unknown) => {
    current?.resolve(v)
    useDialog.setState({ current: null })
  }
  useEffect(() => () => useDialog.getState().current?.resolve(null), [])
  return (
    <Sheet open={!!current} onClose={() => close(null)} title={current?.title ?? ''}>
      {current?.message && <p className="text-[15px] leading-relaxed text-muted">{current.message}</p>}
      <div className="flex flex-col gap-2 pb-2">
        {current?.options.map((o, i) => (
          <Button key={i} block size="lg" variant={o.tone === 'danger' ? 'danger' : o.tone === 'secondary' ? 'secondary' : 'primary'} onClick={() => close(o.value)}>
            {o.label}
          </Button>
        ))}
        <Button block size="lg" variant="ghost" onClick={() => close(null)}>
          Cancelar
        </Button>
      </div>
    </Sheet>
  )
}
