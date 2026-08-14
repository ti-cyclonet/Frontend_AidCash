"use client"

import { useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { useNetworkStatus } from "@/hooks/use-network-status"
import { getAccessToken } from "@/lib/api-client"

/**
 * OfflineSyncProvider
 *
 * Componente invisible que:
 * 1. Mantiene sincronizado el auth token con el Service Worker
 *    (para que el SW pueda hacer fetch autenticado en Background Sync)
 * 2. Muestra un toast cuando la app está offline y hay operaciones pendientes
 * 3. Procesa la cola automáticamente al reconectarse
 *
 * Se monta en el layout del dashboard.
 */
export function OfflineSyncProvider() {
  const { user } = useAuth()
  const { isOnline, pendingCount, isSyncing } = useNetworkStatus()

  // ─── Sincronizar token con el Service Worker ──────────────────────────────
  useEffect(() => {
    if (!user) return

    const syncToken = async () => {
      const token = getAccessToken()
      if (!token || !('serviceWorker' in navigator)) return

      try {
        const registration = await navigator.serviceWorker.ready
        registration.active?.postMessage({
          type: 'KIRI_SET_AUTH_TOKEN',
          token,
        })
      } catch {
        // SW no disponible
      }
    }

    syncToken()

    // Re-sincronizar cada vez que cambia el token (refresh)
    const interval = setInterval(syncToken, 60000) // cada minuto
    return () => clearInterval(interval)
  }, [user])

  // ─── Escuchar mensajes del SW (sync completado) ───────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'KIRI_SYNC_COMPLETE') {
        console.log(`[OfflineSync] Cola procesada: ${event.data.processed} operaciones`)
      }
    }

    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [])

  // ─── Indicador visual de estado offline ───────────────────────────────────
  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white text-center text-xs py-1 font-medium shadow-md">
        📡 Sin conexión{pendingCount > 0 ? ` — ${pendingCount} operación${pendingCount > 1 ? 'es' : ''} pendiente${pendingCount > 1 ? 's' : ''}` : ''}
        {isSyncing ? ' (sincronizando...)' : ''}
      </div>
    )
  }

  // Mostrar brevemente cuando está sincronizando después de reconexión
  if (isSyncing && pendingCount > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-emerald-500 text-white text-center text-xs py-1 font-medium shadow-md">
        🔄 Sincronizando {pendingCount} operación{pendingCount > 1 ? 'es' : ''} pendiente{pendingCount > 1 ? 's' : ''}...
      </div>
    )
  }

  return null
}
