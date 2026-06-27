/**
 * @fileOverview Escáner de recibos con Gemini Vision (Premium).
 * Se invoca desde la API Route /api/ai/scan-receipt.
 */

import { ai, GENKIT_MODEL } from '@/ai/genkit'
import { z } from 'genkit'

// ─── Esquemas ─────────────────────────────────────────────────────────────────

const ReceiptScannerInputSchema = z.object({
  imageBase64: z.string().describe('Imagen del recibo en base64 (sin prefijo data:image/...)'),
  mimeType:    z.string().describe('Tipo MIME: image/jpeg, image/png, image/webp'),
})

export type ReceiptScannerInput = z.infer<typeof ReceiptScannerInputSchema>

const ReceiptScannerOutputSchema = z.object({
  establecimiento: z.string(),
  fecha:           z.string(),
  montoTotal:      z.number(),
  categoria:       z.enum(['gasto_fijo', 'gasto_libre', 'deuda', 'ahorro', 'otro']),
  categoriaRazon:  z.string(),
  items:           z.array(z.object({
    descripcion: z.string(),
    monto:       z.number(),
  })).optional(),
  confianza: z.enum(['alta', 'media', 'baja']),
})

export type ReceiptScannerOutput = z.infer<typeof ReceiptScannerOutputSchema>

// ─── Función pública ──────────────────────────────────────────────────────────

export async function scanReceipt(
  input: ReceiptScannerInput
): Promise<ReceiptScannerOutput> {
  const { output } = await ai.generate({
    model:  GENKIT_MODEL,
    output: { schema: ReceiptScannerOutputSchema },
    prompt: [
      {
        media: {
          url: `data:${input.mimeType};base64,${input.imageBase64}`,
        },
      },
      {
        text: `Eres un asistente de Kiri Finance. Analiza esta imagen de un recibo y extrae los datos estructurados.

INSTRUCCIONES:
1. Nombre del establecimiento (comercio, tienda, restaurante).
2. Fecha en formato YYYY-MM-DD. Si no es legible, usa hoy: ${new Date().toISOString().split('T')[0]}.
3. Monto total (número más grande al final).
4. Categoría:
   - "gasto_fijo" → servicios recurrentes (luz, agua, internet, arriendo, suscripciones)
   - "gasto_libre" → comida, entretenimiento, compras personales, transporte casual
   - "deuda" → pagos de tarjeta de crédito, cuotas de préstamos
   - "ahorro" → depósitos a cuentas de ahorro, inversiones
   - "otro" → si no encaja
5. Razón breve de la categoría.
6. Ítems individuales si son legibles.
7. Confianza: "alta" si todo es legible, "media" si hay partes borrosas, "baja" si la imagen es muy pobre.

Responde ÚNICAMENTE con JSON válido según el esquema.`,
      },
    ],
  })

  if (!output) {
    throw new Error('El modelo no devolvió una respuesta válida')
  }

  return output
}
