import { useEffect } from 'react'
import { Outlet, ScrollRestoration, useNavigate } from 'react-router'
import { useApp } from '../data/app'
import { startApp } from '../data/lifecycle'
import { useLock } from '../data/lock'
import { DialogHost, ToastHost } from './components/Feedback'
import { BottomNav } from './components/Nav'
import { LockScreen } from './screens/LockScreen'
import { RecoveryScreen } from './screens/RecoveryScreen'

/** Raiz: arranque, ecrã de carregamento/recuperação, bloqueio e avisos. */
export function RootLayout() {
  const status = useApp((s) => s.status)
  const locked = useLock((s) => s.locked)
  const navigate = useNavigate()

  useEffect(() => {
    void startApp({ navigate: (to) => navigate(to), pathname: () => window.location.pathname })
  }, [navigate])

  if (status === 'loading') return <Splash />
  if (status === 'error')
    return (
      <>
        <RecoveryScreen />
        <ToastHost />
        <DialogHost />
      </>
    )

  return (
    <>
      {locked && <LockScreen />}
      <div className={locked ? 'hidden' : undefined}>
        <Outlet />
      </div>
      <ScrollRestoration />
      <ToastHost />
      <DialogHost />
    </>
  )
}

/** Ecrãs principais com a barra de navegação em baixo. */
export function TabsLayout() {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  )
}

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted">
      <img src="/icon.svg" alt="" className="size-16 rounded-2xl" />
      <p className="text-sm">A abrir…</p>
    </div>
  )
}
