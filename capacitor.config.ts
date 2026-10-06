import type { CapacitorConfig } from '@capacitor/cli'

// App 100% local: a web-app vai dentro da APK e é servida pelo próprio telemóvel.
const config: CapacitorConfig = {
  // ATENÇÃO: o appId é definitivo depois da primeira instalação (mudar = app nova, sem os dados).
  appId: 'pt.freelance.ganhos',
  appName: 'Ganhos',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    // Sem depuração remota da WebView nas versões finais.
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_ganhos',
      iconColor: '#2563EB',
    },
  },
}

export default config
