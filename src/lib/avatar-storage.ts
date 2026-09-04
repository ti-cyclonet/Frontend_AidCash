const DB_NAME = "kiri_db"
const STORE_NAME = "kv"
const AVATAR_KEY_PREFIX = "avatar_url:"

// La clave incluye el userId — antes era un slot único y global ("avatar_url"
// sin más), así que en el mismo navegador la foto de la última persona que
// inició sesión se le mostraba a la SIGUIENTE que iniciara sesión ahí (un
// dispositivo compartido, o simplemente dos pestañas con cuentas distintas),
// hasta que esa segunda cuenta volviera a guardar/recargar la suya.
function keyFor(userId: string): string {
  return AVATAR_KEY_PREFIX + userId
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveAvatar(userId: string, dataUrl: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).put(dataUrl, keyFor(userId))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadAvatar(userId: string): Promise<string> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const req = tx.objectStore(STORE_NAME).get(keyFor(userId))
    req.onsuccess = () => resolve((req.result as string) ?? "")
    req.onerror = () => reject(req.error)
  })
}

export async function clearAvatar(userId: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).delete(keyFor(userId))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
