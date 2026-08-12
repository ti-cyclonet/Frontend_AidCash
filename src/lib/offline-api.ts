"use client"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Kiri Finance — Offline-First API Wrapper
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Wrapper sobre api-client que añade soporte offline automático.
 * Si la petición falla por falta de conexión, se encola en IndexedDB
 * y se procesará automáticamente cuando vuelva la red.
 *
 * Uso:
 *   import { offlineApi } from '@/lib/offline-api'
 *
 *   // En vez de:
 *   await api('/impulse-expenses', { method: 'POST', body: data })
 *
 *   // Usar:
 *   await offlineApi('/impulse-expenses', 'POST', data)
 *
 * La función retorna un resultado optimista si se encola offline.
 */

import { api, type ApiResponse } from './api-client'
import { offlineQueue } from './offline-queue'

interface OfflineApiResult<T> {
  /** Datos reales del servidor (null si se encoló offline) */
  data: T | null
  /** Error del servidor o null */
  error: string | null
  /** Código HTTP real o 0 si offline */
  status: number
  /** true si la operación se encoló para envío posterior */
  queued: boolean
  /** ID en la cola (solo si queued=true) */
  queueId?: string
}

/**
 * Realiza una petición al backend con fallback offline automático.
 *
 * @param endpoint - Ruta del API (ej: '/impulse-expenses')
 * @param method - Método HTTP (POST, PATCH, DELETE)
 * @param body - Cuerpo de la petición
 * @param options - Opciones adicionales
 * @returns Resultado con indicador de si se encoló offline
 */
export async function offlineApi<T = unknown>(
  endpoint: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
  options?: { skipQueue?: boolean }
): Promise<OfflineApiResult<T>> {
  // Si claramente no hay red, encolar directamente (evita timeout)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (options?.skipQueue) {
      return { data: null, error: 'Sin conexión', status: 0, queued: false }
    }

    const queueId = await offlineQueue.enqueue(endpoint, method, body)
    return {
      data: null,
      error: null,
      status: 0,
      queued: true,
      queueId,
    }
  }

  // Intentar la petición normalmente
  try {
    const result = await api<T>(endpoint, { method, body })

    // Si fue exitoso, retornar normalmente
    if (!result.error || result.status !== 0) {
      return { ...result, queued: false }
    }

    // Status 0 = error de conexión — encolar
    if (!options?.skipQueue) {
      const queueId = await offlineQueue.enqueue(endpoint, method, body)
      return {
        data: null,
        error: null,
        status: 0,
        queued: true,
        queueId,
      }
    }

    return { ...result, queued: false }
  } catch {
    // Error inesperado — encolar si es offline
    if (!options?.skipQueue && typeof navigator !== 'undefined' && !navigator.onLine) {
      const queueId = await offlineQueue.enqueue(endpoint, method, body)
      return { data: null, error: null, status: 0, queued: true, queueId }
    }

    return { data: null, error: 'Error inesperado', status: 0, queued: false }
  }
}

/**
 * Verifica si el navegador está online.
 * Útil para mostrar/ocultar funcionalidades en la UI.
 */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}
