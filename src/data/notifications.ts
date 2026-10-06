import { LocalNotifications } from '@capacitor/local-notifications'
import { planReminders } from '../domain/reminders'
import type { AppData } from '../domain/types'
import { isNative } from './platform'

const CHANNEL = 'lembretes'
const TEST_ID = 1

export type NotifPermission = 'granted' | 'denied' | 'prompt' | 'unavailable'

/** Canal Android + o que fazer quando se toca numa notificação. */
export async function setupNotifications(onOpen: (route: string) => void): Promise<void> {
  if (!isNative) return
  await LocalNotifications.createChannel({
    id: CHANNEL,
    name: 'Lembretes',
    description: 'Pagamentos em atraso e prazos do Estado',
    importance: 4,
    visibility: 1,
  }).catch(() => undefined)
  await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const route = action.notification.extra?.route
    if (typeof route === 'string') onOpen(route)
  })
}

export async function notificationPermission(): Promise<NotifPermission> {
  if (!isNative) return 'unavailable'
  try {
    const p = await LocalNotifications.checkPermissions()
    return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt'
  } catch {
    return 'unavailable'
  }
}

export async function requestNotificationPermission(): Promise<NotifPermission> {
  if (!isNative) return 'unavailable'
  try {
    const p = await LocalNotifications.requestPermissions()
    return p.display === 'granted' ? 'granted' : 'denied'
  } catch {
    return 'unavailable'
  }
}

/** Cancela as notificações agendadas e volta a agendar segundo os dados atuais. */
export async function syncNotifications(data: AppData): Promise<number> {
  if (!isNative) return 0
  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
  }
  if (!data.settings.remindersEnabled || (await notificationPermission()) !== 'granted') return 0
  const plan = planReminders(data, new Date(), 60)
  if (plan.length === 0) return 0
  await LocalNotifications.schedule({
    notifications: plan.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      largeBody: p.body,
      channelId: CHANNEL,
      schedule: { at: p.at, allowWhileIdle: true },
      extra: { route: p.route },
    })),
  })
  return plan.length
}

/** Notificação de teste daqui a 5 segundos. */
export async function sendTestNotification(): Promise<void> {
  if (!isNative) return
  await LocalNotifications.schedule({
    notifications: [
      {
        id: TEST_ID,
        title: 'Ganhos — teste',
        body: 'Os lembretes estão a funcionar. 👍',
        channelId: CHANNEL,
        schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
        extra: { route: '/definicoes/lembretes' },
      },
    ],
  })
}
