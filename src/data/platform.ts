import { Capacitor } from '@capacitor/core'

/** true dentro da APK (Android); false no browser do PC. */
export const isNative = Capacitor.isNativePlatform()
