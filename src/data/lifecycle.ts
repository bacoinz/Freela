import { App } from '@capacitor/app'
import { todayISO } from '../domain/dates'
import { closeTopOverlay } from '../ui/overlays'
import { appStore, commit } from './app'
import { autoBackupIfNeeded } from './backup'
import { canLock, useLock } from './lock'
import { notificationPermission, requestNotificationPermission, setupNotifications, syncNotifications } from './notifications'
import { isNative } from './platform'

/** Bloqueia de novo se a app esteve mais de 1 minuto em segundo plano. */
const LOCK_AFTER_MS = 60_000

export interface Navigator {
  navigate: (to: string) => void
  pathname: () => string
}

let started = false

/** Arranque: carrega os dados e liga bloqueio, notificações, botão "voltar" e manutenção diária. */
export async function startApp(nav: Navigator): Promise<void> {
  if (started) return
  started = true
  await appStore.getState().init()
  if (appStore.getState().status === 'ready') {
    await afterReady(nav)
    return
  }
  // Dados estragados: espera que o utilizador recupere (importar / backup / começar de novo).
  const unsubscribe = appStore.subscribe((s) => {
    if (s.status === 'ready') {
      unsubscribe()
      void afterReady(nav)
    }
  })
}

async function afterReady(nav: Navigator) {
  if (isNative) {
    await setupNotifications((route) => nav.navigate(route))
    await initLock()
    registerNativeListeners(nav)
    if (appStore.getState().data?.settings.remindersEnabled && (await notificationPermission()) === 'prompt') {
      await requestNotificationPermission()
    }
  } else {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onResume()
      else void appStore.getState().flush()
    })
  }

  void maintenance()
  let timer: ReturnType<typeof setTimeout> | undefined
  appStore.subscribe((s, prev) => {
    if (s.data === prev.data) return
    clearTimeout(timer)
    timer = setTimeout(() => void syncReminders(), 1500)
  })
}

async function initLock() {
  const settings = appStore.getState().data!.settings
  if (!settings.lockInitialized) {
    // Primeira utilização: liga o bloqueio se o telemóvel tiver impressão digital/PIN (só bloqueia da próxima vez).
    const available = await canLock()
    commit((d) => ({ ...d, settings: { ...d.settings, lockEnabled: available, lockInitialized: true } }), { touch: false })
    return
  }
  if (settings.lockEnabled) useLock.getState().setLocked(true)
}

function registerNativeListeners(nav: Navigator) {
  let backgroundAt = 0
  void App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      backgroundAt = Date.now()
      void appStore.getState().flush()
      return
    }
    const lockEnabled = appStore.getState().data?.settings.lockEnabled
    if (lockEnabled && backgroundAt && Date.now() - backgroundAt > LOCK_AFTER_MS) useLock.getState().setLocked(true)
    backgroundAt = 0
    onResume()
  })

  void App.addListener('backButton', ({ canGoBack }) => {
    if (useLock.getState().locked) {
      void App.minimizeApp()
      return
    }
    if (closeTopOverlay()) return
    if (nav.pathname() === '/') {
      void App.minimizeApp()
      return
    }
    if (canGoBack) window.history.back()
    else nav.navigate('/')
  })
}

function onResume() {
  appStore.getState().refreshDay()
  void maintenance()
}

let maintaining = false

/** Cópia automática diária + reagendar lembretes. */
async function maintenance() {
  if (maintaining) return
  maintaining = true
  try {
    const data = appStore.getState().data
    if (!data) return
    const today = todayISO()
    try {
      if (await autoBackupIfNeeded(data, today)) {
        commit((d) => ({ ...d, settings: { ...d.settings, lastAutoBackupDate: today } }), { touch: false })
      }
    } catch (e) {
      console.warn('Cópia automática falhou', e)
    }
    await syncReminders()
  } finally {
    maintaining = false
  }
}

async function syncReminders() {
  const data = appStore.getState().data
  if (!data) return
  try {
    await syncNotifications(data)
  } catch (e) {
    console.warn('Não foi possível agendar os lembretes', e)
  }
}
