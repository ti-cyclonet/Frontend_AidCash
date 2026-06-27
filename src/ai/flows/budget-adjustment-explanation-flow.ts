/**
 * @fileOverview Flow de IA para explicar los ajustes presupuestarios de Kiri Finance.
 *
 * IMPORTANTE: Este archivo NO debe tener 'use server' — Genkit no es compatible
 * con el sistema de Server Actions de Next.js. Se invoca desde una API Route.
 *
 * Exports:
 *  - budgetAdjustmentExplanation        — función principal a invocar
 *  - BudgetAdjustmentExplanationInput   — tipo de entrada
 *  - BudgetAdjustmentExplanationOutput  — tipo de salida
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// ─── Esquemas de entrada ──────────────────────────────────────────────────────

const DetalleDeudaSchema = z.object({
  nombre:        z.string().describe('Nombre de la deuda (ej: Tarjeta de crédito, Préstamo personal).'),
  monto:         z.number().describe('Monto de la cuota de esta deuda en el periodo actual.'),
  fechaVencimiento: z.string().describe('Fecha de vencimiento en formato YYYY-MM-DD.'),
});

const DetalleGastoFijoSchema = z.object({
  nombre: z.string().describe('Nombre del gasto fijo (ej: Netflix, Arriendo).'),
  monto:  z.number().describe('Monto del gasto fijo en el periodo actual.'),
  fechaCorte: z.string().optional().describe('Fecha de corte opcional en formato YYYY-MM-DD.'),
});

const BudgetAdjustmentExplanationInputSchema = z.object({
  ingresoTotal:              z.number().describe('Ingreso total del usuario en el periodo actual.'),
  pctObligacionesOriginal:   z.number().describe('Porcentaje original destinado a deudas y gastos fijos (ej: 50).'),
  pctLibreOriginal:          z.number().describe('Porcentaje original destinado a gasto libre (ej: 30).'),
  pctAhorroOriginal:         z.number().describe('Porcentaje original destinado a ahorro (ej: 20).'),
  pctObligacionesAjustado:   z.number().describe('Nuevo porcentaje real de deudas y gastos fijos tras el ajuste.'),
  pctLibreAjustado:          z.number().describe('Nuevo porcentaje real de gasto libre tras el ajuste.'),
  pctAhorroAjustado:         z.number().describe('Nuevo porcentaje real de ahorro tras el ajuste.'),
  totalObligaciones:         z.number().describe('Suma real de deudas y gastos fijos que originó el ajuste.'),
  detalleDeudas:             z.array(DetalleDeudaSchema).optional().describe('Lista de deudas activas del usuario.'),
  detalleGastosFijos:        z.array(DetalleGastoFijoSchema).optional().describe('Lista de gastos fijos del usuario.'),
  contextoMetasFinancieras:  z.string().optional().describe('Contexto opcional sobre las metas del usuario (ej: "quiero comprar casa", "saldar deuda universitaria").'),
});

export type BudgetAdjustmentExplanationInput = z.infer<typeof BudgetAdjustmentExplanationInputSchema>;

// ─── Esquema de salida ────────────────────────────────────────────────────────

const BudgetAdjustmentExplanationOutputSchema = z.object({
  explicacion: z.string().describe('Explicación personalizada del ajuste presupuestario, su impacto y consejos accionables. En español, tono empático y motivacional.'),
});

export type BudgetAdjustmentExplanationOutput = z.infer<typeof BudgetAdjustmentExplanationOutputSchema>;

// ─── Función pública ──────────────────────────────────────────────────────────

export async function budgetAdjustmentExplanation(
  input: BudgetAdjustmentExplanationInput
): Promise<BudgetAdjustmentExplanationOutput> {
  return budgetAdjustmentExplanationFlow(input);
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const prompt = ai.definePrompt({
  name: 'kiri_asesor_financiero_prompt',
  input:  { schema: BudgetAdjustmentExplanationInputSchema },
  output: { schema: BudgetAdjustmentExplanationOutputSchema },
  prompt: `Eres el Asesor Financiero Empático de Kiri Finance, una app web de finanzas personales en español latinoamericano.
Tu misión es explicarle al usuario, de forma clara y motivacional, por qué su presupuesto fue ajustado automáticamente y qué puede hacer al respecto.
Habla siempre en segunda persona ("tu ingreso", "tus deudas"). Usa un tono cálido, directo y sin tecnicismos innecesarios.
Tu respuesta debe ser un párrafo fluido de 4 a 6 oraciones. No uses listas con viñetas ni encabezados. No repitas los números exactos de porcentajes de forma mecánica.

— SITUACIÓN FINANCIERA DEL USUARIO —
Ingreso total este periodo: {{ingresoTotal}}
Distribución ideal (Obligaciones / Gasto libre / Ahorro): {{pctObligacionesOriginal}}% / {{pctLibreOriginal}}% / {{pctAhorroOriginal}}%
Distribución real ajustada: {{pctObligacionesAjustado}}% / {{pctLibreAjustado}}% / {{pctAhorroAjustado}}%
Total en obligaciones este periodo: {{totalObligaciones}}

{{#if detalleDeudas}}
Deudas activas:
{{#each detalleDeudas}}
- {{nombre}}: {{monto}} (vence {{fechaVencimiento}})
{{/each}}
{{/if}}

{{#if detalleGastosFijos}}
Gastos fijos:
{{#each detalleGastosFijos}}
- {{nombre}}: {{monto}}{{#if fechaCorte}} (corte {{fechaCorte}}){{/if}}
{{/each}}
{{/if}}

{{#if contextoMetasFinancieras}}
Meta financiera del usuario: {{contextoMetasFinancieras}}
{{/if}}

— INSTRUCCIONES PARA TU RESPUESTA —
1. Explica brevemente POR QUÉ se ajustó el presupuesto: las obligaciones reales superaron el porcentaje ideal del plan 50/30/20.
2. Describe el IMPACTO concreto: cuánto margen libre y de ahorro queda realmente disponible.
3. Da 1 o 2 CONSEJOS accionables y específicos (revisar gastos, atacar la deuda más pequeña primero, buscar un ingreso extra, etc.). Si hay contexto de metas, personaliza el consejo hacia esa meta.
4. Cierra con una frase MOTIVACIONAL corta que refuerce que la situación es manejable y que Kiri está para ayudar.

Responde únicamente con el valor del campo "explicacion". No incluyas saludos ni presentaciones.`,
});

// ─── Flow ─────────────────────────────────────────────────────────────────────

const budgetAdjustmentExplanationFlow = ai.defineFlow(
  {
    name: 'budgetAdjustmentExplanationFlow',
    inputSchema: BudgetAdjustmentExplanationInputSchema,
    outputSchema: BudgetAdjustmentExplanationOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
