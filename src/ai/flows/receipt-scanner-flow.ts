/**
 * @fileOverview Escáner de recibos con Gemini Vision (Premium).
 *
 * Recibe una imagen (base64) de un recibo/factura y extrae
 * los datos estructurados usando el modelo multimodal.
 */

import { ai } from '@/ai/genkit'
import { z } from 'genkit'

// ─── Esquemas ─────────────────────────────────────────────────────────────────

const ReceiptScannerInputSchema = z.object({
  imageBase64: z.string().describe('Imagen del recibo codificada en base64 (sin prefijo data:image/...)'),
  mimeType:    z.string().describe('Tipo MIME de la imagen (image/jpeg, image/png, image/webp)'),
})

export type ReceiptScannerInput = z.infer<typeof ReceiptScannerInputSchema>

const ReceiptScannerOutputSchema = z.object({
  establecimiento: z.string().describe('Nombre del comercio o establecimiento'),
  fecha:           z.string().describe('Fecha del recibo en formato YYYY-MM-DD'),
  montoTotal:      z.number().describe('Monto total del recibo'),
  categoria:       z.enum(['gasto_fijo', 'gasto_libre', 'deuda', 'ahorro', 'otro']).describe('Categoría sugerida del gasto'),
  categoriaRazon:  z.string().describe('Breve explicación de por qué se sugiere esa categoría'),
  items:           z.array(z.object({
    descripcion: z.string(),
    monto:       z.number(),
  })).optional().describe('Ítems individuales del recibo si son legibles'),
  confianza:       z.enum(['alta', 'media', 'baja']).describe('Nivel de confianza en la lectura'),
})

export type ReceiptScannerOutput = z.infer<typeof ReceiptScannerOutputSchema>

// ─── Función pública ──────────────────────────────────────────────────────────

export async function scanReceipt(
  input: ReceiptScannerInput
): Promise<ReceiptScannerOutput> {
  return receiptScannerFlow(input)
}

// ─── Flow ─────────────────────────────────────────────────────────────────────

const receiptScannerFlow = ai.defineFlow(
  {
    name: 'receiptScannerFlow',
    inputSchema: ReceiptScannerInputSchema,
    outputSchema: ReceiptScannerOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      output: { schema: ReceiptScannerOutputSchema },
      prompt: [
        {
          media: {
            url: `data:${input.mimeType};base64,${input.imageBase64}`,
          },
        },
        {
          text: `Eres un asistente de Kiri Finance, una app de finanzas personales en español.
Analiza esta imagen de un recibo o factura y extrae la información estructurada.

INSTRUCCIONES:
1. Extrae el nombre del establecimiento (comercio, tienda, restaurante).
2. Extrae la fecha del recibo. Si no es legible, usa la fecha de hoy.
3. Extrae el monto total (el número más grande al final, total a pagar).
4. Sugiere una categoría:
   - "gasto_fijo" → servicios recurrentes (luz, agua, internet, arriendo, suscripciones)
   - "gasto_libre" → comida, entretenimiento, compras personales, transporte casual
   - "deuda" → pagos de tarjeta de crédito, cuotas de préstamos
   - "ahorro" → depósitos a cuentas de ahorro, inversiones
   - "otro" → si no encaja en ninguna
5. Explica brevemente por qué sugieres esa categoría.
6. Si puedes leer ítems individuales, inclúyelos.
7. Indica tu nivel de confianza: "alta" si todo es legible, "media" si hay partes borrosas, "baja" si la imagen es muy pobre.

Responde SOLO con JSON válido siguiendo el esquema proporcionado.`,
        },
      ],
    })

    return output!
  }
)
