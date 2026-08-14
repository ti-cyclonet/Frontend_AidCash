/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Kiri Finance — Custom Service Worker Extension
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Este archivo se inyecta al Service Worker generado por @ducanh2912/next-pwa.
 * Añade soporte para:
 *   - Background Sync: procesa cola offline cuando vuelve la conectividad
 *   - Push notifications (delegado a sw-push.js via importScripts)
 *
 * El evento 'sync' se dispara automáticamente por el browser cuando:
 *   1. El usuario registra un sync tag (desde offline-queue.ts)
 *   2. El dispositivo recupera conectividad
 */

declare const self: ServiceWorkerGlobalScope

// ─── Constantes ───────────────────────────────────────────────────────────────

const SYNC_TAG = 'kiri-background-sync'
const DB_NAME = 'kiri_offline_db'
const DB_VERSION = 1
const STORE_NAME = 'offline_queue'

// ─── IndexedDB helpers (dentro del SW no hay acceso a módulos del app) ────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
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

interface QueuedRequest {
  id: string
  endpoint: string
  method: string
  body: unknown
  timestamp: number
  retries: number
  status: string
}

async function getPendingRequests(): Promise<QueuedRequest[]> {
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
}

async function removeRequest(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.delete(id)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => reject(tx.error)
  })
}

async function markRetry(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getReq = store.get(id)

    getReq.onsuccess = () => {
      const entry = getReq.result as QueuedRequest
      if (!entry) { resolve(); return }
      entry.retries += 1
      entry.status = entry.retries >= 5 ? 'failed' : 'pending'
      store.put(entry)
      resolve()
    }
    getReq.onerror = () => reject(getReq.error)
    tx.oncomplete = () => db.close()
  })
}

// ─── Obtener token de auth desde el cache o cookie ────────────────────────────

async function getAuthToken(): Promise<string | null> {
  // Intenta obtener el token desde el cache de la app
  // El token se almacena en localStorage del cliente, pero el SW no tiene acceso
  // Usamos un approach: enviar el token via message al SW cuando cambie
  // Por ahora, intentamos leerlo de un cache dedicado
  try {
    const cache = await caches.open('kiri-auth-cache')
    const response = await cache.match('/kiri-auth-token')
    if (response) {
      const data = await response.json()
      return data.token || null
    }
  } catch {
    // No hay token cacheado
  }
  return null
}

// ─── Background Sync Handler ──────────────────────────────────────────────────

self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(processQueue())
  }
})

/**
 * Procesa todas las peticiones pendientes en la cola de IndexedDB.
 * Se ejecuta dentro del Service Worker cuando el browser detecta conectividad.
 */
async function processQueue(): Promise<void> {
  const pending = await getPendingRequests()
  if (pending.length === 0) return

  const token = await getAuthToken()
  const apiUrl = self.location.origin.includes('localhost')
    ? 'http://localhost:4000/api'
    : 'https://kiri-api.cyclonet.com.co/api' // Ajustar a tu URL de producción

  // Procesar en orden FIFO
  const sorted = pending.sort((a, b) => a.timestamp - b.timestamp)

  for (const entry of sorted) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${apiUrl}${entry.endpoint}`, {
        method: entry.method,
        headers,
        body: entry.body ? JSON.stringify(entry.body) : undefined,
      })

      if (response.ok || response.status < 500) {
        // Éxito o error de negocio — eliminar
        await removeRequest(entry.id)
      } else {
        // Error de servidor — reintentar
        await markRetry(entry.id)
      }
    } catch {
      // Sin conexión real — reintentar
      await markRetry(entry.id)
    }
  }

  // Notificar al cliente que se procesó la cola
  const clients = await self.clients.matchAll({ type: 'window' })
  for (const client of clients) {
    client.postMessage({
      type: 'KIRI_SYNC_COMPLETE',
      processed: sorted.length,
    })
  }
}

// ─── Escuchar mensajes del cliente (para recibir el auth token) ───────────────

self.addEventListener('message', (event) => {
  if (event.data?.type === 'KIRI_SET_AUTH_TOKEN') {
    // Guardar token en un cache dedicado para que el SW pueda usarlo
    caches.open('kiri-auth-cache').then(cache => {
      const response = new Response(JSON.stringify({ token: event.data.token }))
      cache.put('/kiri-auth-token', response)
    })
  }

  if (event.data?.type === 'KIRI_PROCESS_QUEUE') {
    // Trigger manual desde el cliente
    processQueue()
  }
})

// ─── Periodic Sync (si está disponible — Chrome 80+) ─────────────────────────

self.addEventListener('periodicsync', (event: any) => {
  if (event.tag === 'kiri-periodic-sync') {
    event.waitUntil(processQueue())
  }
})
