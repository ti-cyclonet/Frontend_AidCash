"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { processOfflineQueue, offlineQueue } from "@/lib/offline-queue"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * useNetworkStatus — Detecta conectividad y procesa la cola offline
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Este hook:
 *   1. Escucha eventos online/offline del navigator
 *   2. Cuando se reconecta, procesa automáticamente la cola de IndexedDB
 *   3. Expone el estado de red y el count de operaciones pendientes
 *
 * Funciona como fallback para navegadores que no soportan Background Sync
 * (Safari, Firefox) y como complemento para Chrome/Edge.
 */

export interface NetworkStatus {
  /** true si el navegador reporta conexión a internet */
  isOnline: boolean
  /** Número de operaciones encoladas pendientes de enviar */
  pendingCount: number
  /** true mientras se está procesando la cola */
  isSyncing: boolean
  /** Forzar procesamiento manual de la cola */
  syncNow: () => Promise<number>
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const syncingRef = useRef(false)

  // Actualizar count de pendientes
  const refreshCount = useCallback(async () => {
    try {
      const count = await offlineQueue.countPending()
      setPendingCount(count)
    } catch {
      // IndexedDB no disponible (SSR o incognito restrictivo)
    }
  }, [])

  // Procesar cola cuando hay conexión
  const syncNow = useCallback(async (): Promise<number> => {
    if (syncingRef.current || !navigator.onLine) return 0
    syncingRef.current = true
    setIsSyncing(true)

    try {
      const processed = await processOfflineQueue()
      await refreshCount()
      return processed
    } finally {
      syncingRef.current = false
      setIsSyncing(false)
    }
  }, [refreshCount])

  useEffect(() => {
    // Handlers de conectividad
    const handleOnline = () => {
      setIsOnline(true)
      // Auto-procesar cola al reconectar (con delay para estabilización)
      setTimeout(() => {
        syncNow()
      }, 2000)
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Verificar pendientes al montar
    refreshCount()

    // Polling cada 30s para mantener count actualizado
    const interval = setInterval(refreshCount, 30000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [syncNow, refreshCount])

  return { isOnline, pendingCount, isSyncing, syncNow }
}
