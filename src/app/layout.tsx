import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AppProvider } from '@/lib/app-context'
import { AuthProvider } from '@/lib/auth-context'
import { SocketProvider } from '@/lib/socket-context'
import { AuthGuard } from '@/components/auth-guard'
import { Toaster } from '@/components/ui/toaster'

export const metadata: Metadata = {
  title: 'Kiri Finance',
  description: 'Gestiona tus finanzas personales. Tu jardín financiero crece con tus buenos hábitos.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Kiri Finance',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: '/icons/icon-192x192.svg',
    shortcut: '/icons/icon-96x96.svg',
    apple: '/icons/icon-152x152.svg',
  },
}

export const viewport: Viewport = {
  themeColor: '#2D6A4F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          <AppProvider>
            <SocketProvider>
              <AuthGuard>
                {children}
              </AuthGuard>
              <Toaster />
            </SocketProvider>
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
