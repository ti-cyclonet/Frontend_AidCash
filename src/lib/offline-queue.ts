"use client"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Kiri Finance — Offline Queue (IndexedDB + Background Sync)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Sistema de cola offline que permite al usuario registrar gastos, aportes y
 * otras operaciones sin conexión. Las operaciones se almacenan en IndexedDB
 * y se envían al servidor cuando se recupera la conectividad.
 *
 * Flujo:
 *   1. Usuario realiza una acción (ej: registrar gasto hormiga)
 *   2. Si hay red → se envía normalmente al backend
 *   3. Si NO hay red → se encola en IndexedDB
 *   4. Cuando se recupera la red:
 *      a. Background Sync (si el browser lo soporta) dispara el envío
 *      b. O el hook useNetworkStatus detecta reconexión y procesa la cola
 *
 * IndexedDB Store: "kiri_offline_queue"
 * Cada entrada tiene: id, endpoint, method, body, timestamp, retries, status
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface QueuedRequest {
  id: string
  endpoint: string
  method: 'POST' | 'PATCH' | 'DELETE'
  body: unknown
  timestamp: number
  retries: number
  status: 'pending' | 'processing' | 'failed'
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const DB_NAME = 'kiri_offline_db'
const DB_VERSION = 1
const STORE_NAME = 'offline_queue'
const MAX_RETRIES = 5
const SYNC_TAG = 'kiri-background-sync'

// ─── Utilidad para abrir la DB ────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ─── API pública de la cola offline ───────────────────────────────────────────

export const offlineQueue = {
  /**
   * Encola una petición para enviarla cuando haya conexión.
   * Genera un ID único y la almacena en IndexedDB.
   */
  async enqueue(endpoint: string, method: 'POST' | 'PATCH' | 'DELETE', body: unknown): Promise<string> {
    const db = await openDB()
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

    const entry: QueuedRequest = {
      id,
      endpoint,
      method,
      body,
      timestamp: Date.now(),
      retries: 0,
      status: 'pending',
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.add(entry)

      request.onsuccess = () => {
        // Intentar registrar Background Sync si el browser lo soporta
        registerBackgroundSync()
        resolve(id)
      }
      request.onerror = () => reject(request.error)
      tx.oncomplete = () => db.close()
    })
  },

  /**
   * Obtiene todas las peticiones pendientes en la cola.
   */
  async getPending(): Promise<QueuedRequest[]> {
    const db = await openDB()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const index = store.index('status')
      const request = index.getAll('pending')

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      tx.oncomplete = () => db.close()
    })
  },

  /**
   * Cuenta las peticiones pendientes (para mostrar badge en la UI).
   */
  async countPending(): Promise<number> {
    const pending = await this.getPending()
    return pending.length
  },

  /**
   * Marca una petición como procesada y la elimina de la cola.
   */
  async remove(id: string): Promise<void> {
    const db = await openDB()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      tx.oncomplete = () => db.close()
    })
  },

  /**
   * Incrementa el retry count de una petición.
   * Si supera MAX_RETRIES, la marca como 'failed'.
   */
  async markRetry(id: string): Promise<void> {
    const db = await openDB()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const getReq = store.get(id)

      getReq.onsuccess = () => {
        const entry = getReq.result as QueuedRequest
        if (!entry) { resolve(); return }

        entry.retries += 1
        entry.status = entry.retries >= MAX_RETRIES ? 'failed' : 'pending'
        store.put(entry)
        resolve()
      }
      getReq.onerror = () => reject(getReq.error)
      tx.oncomplete = () => db.close()
    })
  },

  /**
   * Elimina todas las peticiones fallidas de la cola.
   */
  async clearFailed(): Promise<void> {
    const db = await openDB()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const index = store.index('status')
      const request = index.openCursor('failed')

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }
      request.onerror = () => reject(request.error)
      tx.oncomplete = () => { db.close(); resolve() }
    })
  },

  /**
   * Limpia toda la cola (para debug o reset).
   */
  async clearAll(): Promise<void> {
    const db = await openDB()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      tx.oncomplete = () => db.close()
    })
  },
}

// ─── Background Sync Registration ────────────────────────────────────────────

/**
 * Registra un tag de Background Sync en el Service Worker.
 * Cuando el browser detecta que hay red, disparará el evento 'sync'
 * con este tag en el SW, el cual procesará la cola.
 */
async function registerBackgroundSync(): Promise<void> {
  try {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const registration = await navigator.serviceWorker.ready
      await (registration as any).sync.register(SYNC_TAG)
    }
  } catch {
    // Background Sync no soportado o permiso denegado; se usará el fallback
  }
}

// ─── Procesamiento de la cola (usado tanto por SW como por fallback) ──────────

import { api, getAccessToken } from './api-client'

/**
 * Procesa todas las peticiones pendientes en la cola.
 * Se llama cuando:
 *   - Background Sync se dispara en el SW
 *   - El hook useNetworkStatus detecta reconexión
 *   - El usuario vuelve a la app tras estar offline
 *
 * Retorna el número de peticiones procesadas exitosamente.
 */
export async function processOfflineQueue(): Promise<number> {
  const pending = await offlineQueue.getPending()
  if (pending.length === 0) return 0

  let processed = 0

  // Ordenar por timestamp (FIFO — primero que se encoló, primero que se envía)
  const sorted = pending.sort((a, b) => a.timestamp - b.timestamp)

  for (const entry of sorted) {
    try {
      const result = await api(entry.endpoint, {
        method: entry.method,
        body: entry.body,
      })

      if (!result.error || result.status < 500) {
        // Éxito o error de negocio (4xx) — eliminar de la cola
        await offlineQueue.remove(entry.id)
        processed++
      } else {
        // Error del servidor (5xx) — reintentar después
        await offlineQueue.markRetry(entry.id)
      }
    } catch {
      // Error de red persistente — reintentar después
      await offlineQueue.markRetry(entry.id)
    }
  }

  return processed
}
