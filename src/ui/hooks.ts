import { useEffect, useState } from 'react'
import { todayISO } from '../domain/dates'
import { isReceived } from '../domain/installments'
import type { AppData, ISODate } from '../domain/types'

/** Data de hoje (atualiza-se se a app ficar aberta de um dia para o outro). */
export function useToday(): ISODate {
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    const tick = () => setToday(todayISO())
    const id = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return today
}

/** Método usado no recebimento mais recente (para pré-preencher). */
export function lastUsedMethodId(data: AppData): string | undefined {
  let best: { date: string; id: string } | undefined
  for (const job of data.jobs) {
    for (const i of job.installments) {
      if (isReceived(i) && i.methodId && (!best || i.receivedDate! > best.date)) best = { date: i.receivedDate!, id: i.methodId }
    }
  }
  return best?.id
}
