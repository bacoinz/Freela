import { Fingerprint } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { unlock, useLock } from '../../data/lock'
import { Button } from '../components/Button'

/** Ecrã de bloqueio por cima de tudo; pede a impressão digital logo ao aparecer. */
export function LockScreen() {
  const setLocked = useLock((s) => s.setLocked)
  const [busy, setBusy] = useState(false)
  const asked = useRef(false)

  const tryUnlock = async () => {
    setBusy(true)
    const ok = await unlock()
    setBusy(false)
    if (ok) setLocked(false)
  }

  useEffect(() => {
    if (asked.current) return
    asked.current = true
    void tryUnlock()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div role="dialog" aria-modal="true" aria-label="App bloqueada" className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 bg-bg px-8 text-center">
      <img src="/icon.svg" alt="" className="size-20 rounded-3xl shadow-float" />
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Ganhos está bloqueada</h1>
        <p className="text-muted">Usa a impressão digital ou o PIN do telemóvel.</p>
      </div>
      <Button size="lg" icon={Fingerprint} loading={busy} onClick={() => void tryUnlock()}>
        Desbloquear
      </Button>
    </div>
  )
}
