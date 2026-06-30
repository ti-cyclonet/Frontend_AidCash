/**
 * @fileOverview Flow de IA para explicar los ajustes presupuestarios de Kiri Finance.
 * Se invoca desde la API Route /api/ai/budget-insight.
 */

import { ai, GENKIT_MODEL } from '@/ai/genkit'
import { z } from 'genkit'

// ─── Esquemas ─────────────────────────────────────────────────────────────────

const DetalleDeudaSchema = z.object({
  nombre:           z.string(),
  monto:            z.number(),
  diasPago: z.string(),
})

const DetalleGastoFijoSchema = z.object({
  nombre:     z.string(),
  monto:      z.number(),
  fechaCorte: z.string().optional(),
})

const BudgetAdjustmentExplanationInputSchema = z.object({
  ingresoTotal:             z.number(),
  pctObligacionesOriginal:  z.number(),
  pctLibreOriginal:         z.number(),
  pctAhorroOriginal:        z.number(),
  pctObligacionesAjustado:  z.number(),
  pctLibreAjustado:         z.number(),
  pctAhorroAjustado:        z.number(),
  totalObligaciones:        z.number(),
  detalleDeudas:            z.array(DetalleDeudaSchema).optional(),
  detalleGastosFijos:       z.array(DetalleGastoFijoSchema).optional(),
  contextoMetasFinancieras: z.string().optional(),
})

export type BudgetAdjustmentExplanationInput = z.infer<typeof BudgetAdjustmentExplanationInputSchema>

const BudgetAdjustmentExplanationOutputSchema = z.object({
  explicacion: z.string(),
})

export type BudgetAdjustmentExplanationOutput = z.infer<typeof BudgetAdjustmentExplanationOutputSchema>

// ─── Función pública ──────────────────────────────────────────────────────────

export async function budgetAdjustmentExplanation(
  input: BudgetAdjustmentExplanationInput
): Promise<BudgetAdjustmentExplanationOutput> {
  const deudasLines = input.detalleDeudas?.length
    ? input.detalleDeudas.map(d => `- ${d.nombre}: ${d.monto} (vence ${d.diasPago})`).join('\n')
    : '(ninguna)'

  const fijosLines = input.detalleGastosFijos?.length
    ? input.detalleGastosFijos.map(f => `- ${f.nombre}: ${f.monto}${f.fechaCorte ? ` (corte ${f.fechaCorte})` : ''}`).join('\n')
    : '(ninguno)'

  const metaLine = input.contextoMetasFinancieras
    ? `Meta financiera del usuario: ${input.contextoMetasFinancieras}`
    : ''

  const promptText = `Eres el Asesor Financiero Empático de Kiri Finance, una app de finanzas personales en español latinoamericano.
Explica al usuario por qué su presupuesto fue ajustado y qué puede hacer. Habla en segunda persona. Tono cálido, directo, sin tecnicismos.
Escribe UN párrafo fluido de 4 a 6 oraciones. Sin listas ni encabezados.

SITUACIÓN FINANCIERA:
Ingreso total: ${input.ingresoTotal}
Distribución ideal (Obligaciones/Libre/Ahorro): ${input.pctObligacionesOriginal}% / ${input.pctLibreOriginal}% / ${input.pctAhorroOriginal}%
Distribución real ajustada: ${input.pctObligacionesAjustado}% / ${input.pctLibreAjustado}% / ${input.pctAhorroAjustado}%
Total en obligaciones: ${input.totalObligaciones}

Deudas activas:
${deudasLines}

Gastos fijos:
${fijosLines}

${metaLine}

INSTRUCCIONES:
1. Explica brevemente POR QUÉ se ajustó el presupuesto.
2. Describe el IMPACTO: cuánto margen libre y ahorro quedan.
3. Da 1-2 consejos accionables. Si hay meta, personaliza hacia ella.
4. Cierra con una frase motivacional corta.

Responde ÚNICAMENTE con JSON: { "explicacion": "tu párrafo aquí" }`

  const { output } = await ai.generate({
    model:  GENKIT_MODEL,
    prompt: promptText,
    output: { schema: BudgetAdjustmentExplanationOutputSchema },
  })

  if (!output) {
    throw new Error('El modelo no devolvió una respuesta válida')
  }

  return output
}
