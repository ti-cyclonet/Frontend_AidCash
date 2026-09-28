import { uploadAvatarToAuthoriza } from "@/lib/api-client"

/**
 * Foto de perfil lista para guardar en el backend (y así verse igual en
 * cualquier dispositivo):
 *   1. Se reescala a 512 px / JPEG (una foto de celular pesa 2-8 MB y el
 *      backend acepta hasta 700.000 caracteres).
 *   2. Se sube a Authoriza (avatar compartido por todas las apps).
 *   3. Si Authoriza falla, se usa la versión reescalada (≈50-80 KB), que el
 *      backend de Kiri sí acepta — antes el fallo dejaba la foto solo en ese
 *      navegador y en otro dispositivo no aparecía.
 */
const AVATAR_MAX_DIM = 512
const AVATAR_QUALITY = 0.85

export function resizeImageToDataUrl(file: File, maxDim = AVATAR_MAX_DIM, quality = AVATAR_QUALITY): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error("El archivo no es una imagen válida"))
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement("canvas")
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d")
        if (!ctx) { reject(new Error("No se pudo procesar la imagen")); return }
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL("image/jpeg", quality))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export async function prepararFotoPerfil(file: File): Promise<{ url: string | null; preview: string | null; error: string | null }> {
  if (!file.type.startsWith("image/")) return { url: null, preview: null, error: "Selecciona un archivo de imagen." }
  let preview: string | null = null
  try { preview = await resizeImageToDataUrl(file) } catch { /* se intenta igual con Authoriza */ }
  const { url } = await uploadAvatarToAuthoriza(file)
  if (url) return { url, preview, error: null }
  if (preview) return { url: preview, preview, error: null }
  return { url: null, preview: null, error: "No se pudo procesar la foto. Intenta con otra." }
}
