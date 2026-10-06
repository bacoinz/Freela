import { BiometricAuth } from '@aparajita/capacitor-biometric-auth'
import { create } from 'zustand'
import { isNative } from './platform'

/** Se a app está bloqueada (ecrã de bloqueio por cima de tudo). */
export const useLock = create<{ locked: boolean; setLocked: (v: boolean) => void }>((set) => ({
  locked: false,
  setLocked: (locked) => set({ locked }),
}))

/** O telemóvel tem impressão digital ou bloqueio de ecrã (PIN/padrão) configurado? */
export async function canLock(): Promise<boolean> {
  if (!isNative) return false
  try {
    const r = await BiometricAuth.checkBiometry()
    return r.isAvailable || r.deviceIsSecure
  } catch {
    return false
  }
}

/** Pede a impressão digital (ou o PIN/padrão do telemóvel). */
export async function unlock(): Promise<boolean> {
  if (!isNative) return true
  try {
    await BiometricAuth.authenticate({
      reason: 'Desbloquear a app Ganhos',
      cancelTitle: 'Cancelar',
      allowDeviceCredential: true,
      androidTitle: 'Ganhos',
      androidSubtitle: 'Confirma que és tu',
      androidConfirmationRequired: false,
    })
    return true
  } catch {
    return false
  }
}
