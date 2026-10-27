import type { CapacitorConfig } from '@capacitor/cli'

/**
 * App nativa de Kiri (Play Store y App Store) con Capacitor.
 *
 * La app carga la versión publicada (kiri.cyclonet.com.co): cada despliegue web
 * llega a los celulares sin pasar por revisión de las tiendas. El puente nativo de
 * Capacitor se inyecta en esa página, así la app usa barra de estado, botón atrás
 * de Android, vibración, compras dentro de la app (RevenueCat), etc. — ver
 * src/lib/nativo.ts. Sin internet se muestra nativo/www/error.html.
 *
 * Para probar contra un servidor local: KIRI_APP_URL=http://192.168.x.x:9100 npx cap sync
 * Guía completa de publicación: docs/tiendas/PUBLICAR.md
 */
const url = process.env.KIRI_APP_URL || 'https://kiri.cyclonet.com.co'

const config: CapacitorConfig = {
  appId: 'co.cyclonet.kiri',
  appName: 'Kiri Finance',
  webDir: 'nativo/www',
  server: {
    url,
    cleartext: url.startsWith('http://'),
    androidScheme: 'https',
    errorPath: 'error.html',
    allowNavigation: ['kiri.cyclonet.com.co', 'api.cyclonet.com.co'],
  },
  backgroundColor: '#1B4332',
  plugins: {
    SplashScreen: { launchShowDuration: 2500, launchAutoHide: false, backgroundColor: '#1B4332', showSpinner: false, androidScaleType: 'CENTER_CROP' },
    StatusBar: { style: 'DARK', backgroundColor: '#1B4332', overlaysWebView: false },
    Keyboard: { resize: 'body', resizeOnFullScreen: true },
  },
  android: { allowMixedContent: false },
  ios: { contentInset: 'automatic', limitsNavigationsToAppBoundDomains: false },
}

export default config
