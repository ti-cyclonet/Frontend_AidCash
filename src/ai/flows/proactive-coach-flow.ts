/**
 * @fileOverview Coach Financiero Proactivo de Kiri Finance (Premium).
 *
 * Recibe el contexto financiero completo del usuario incluyendo historial
 * de los últimos 3 meses, y genera consejos proactivos basados en patrones
 * detectados. Permite interacción conversacional.
 *
 * NO usar 'use server' — se invoca desde una API Route.
 */

import { ai } from '@/ai/genkit'
import { z } from 'genkit'

// ─── Esquemas ─────────────────────────────────────────────────────────────────

const ResumenMensualSchema = z.object({
  mes:                z.string().describe('Nombre del mes (ej: "mayo 2026")'),
  ingresoTotal:       z.number().describe('Ingreso total de ese mes'),
  totalObligaciones:  z.number().describe('Total en deudas + gastos fijos'),
  totalAhorro:        z.number().describe('Monto ahorrado ese mes'),
  gastoLibre:         z.number().describe('Monto gastado en libre consumo'),
  deudasActivas:      z.number().describe('Número de deudas activas ese mes'),
})

const DeudaActivaSchema = z.object({
  nombre:            z.string(),
  montoTotal:        z.number().describe('Saldo total restante'),
  cuotaPeriodo:      z.number().describe('Cuota que paga por periodo'),
  mesesRestantes:    z.number().describe('Meses estimados para liquidar'),
})

const ProactiveCoachInputSchema = z.object({
  // Contexto actual
  nombreUsuario:      z.string().describe('Nombre del usuario para personalizar'),
  ingresoActual:      z.number().describe('Ingreso del periodo actual'),
  frecuencia:         z.string().describe('quincenal o mensual'),
  obligacionesPct:    z.number().describe('Porcentaje de ingreso en obligaciones'),
  ahorroPct:          z.number().describe('Porcentaje de ingreso en ahorro'),
  capacidadLibre:     z.number().describe('Capacidad de endeudamiento disponible'),
  metaAhorro:         z.number().describe('Meta de ahorro total del usuario'),
  ahorroAcumulado:    z.number().describe('Total ahorrado hasta hoy'),
  streakSemanas:      z.number().describe('Racha actual en semanas'),

  // Historial de meses
  historial:          z.array(ResumenMensualSchema).describe('Resumen financiero de los últimos 3 meses'),

  // Deudas activas
  deudasActivas:      z.array(DeudaActivaSchema).describe('Lista de deudas activas actuales'),

  // Mensaje del usuario (para modo conversacional)
  mensajeUsuario:     z.string().optional().describe('Pregunta o comentario del usuario al coach'),

  // Historial de conversación (últimos mensajes para contexto)
  historialChat:      z.array(z.object({
    rol:      z.enum(['usuario', 'coach']),
    mensaje:  z.string(),
  })).optional().describe('Últimos mensajes de la conversación para mantener contexto'),
})

export type ProactiveCoachInput = z.infer<typeof ProactiveCoachInputSchema>

const ProactiveCoachOutputSchema = z.object({
  respuesta:          z.string().describe('Respuesta del coach al usuario. Consejo proactivo o respuesta conversacional.'),
  patronDetectado:    z.string().optional().describe('Patrón identificado en el historial (si aplica)'),
  accionSugerida:     z.string().optional().describe('Acción concreta que el usuario puede tomar hoy'),
  impactoEstimado:    z.string().optional().describe('Impacto estimado si sigue el consejo (ej: "pagas 3 meses antes")'),
})

export type ProactiveCoachOutput = z.infer<typeof ProactiveCoachOutputSchema>

// ─── Función pública ──────────────────────────────────────────────────────────

export async function proactiveCoach(
  input: ProactiveCoachInput
): Promise<ProactiveCoachOutput> {
  return proactiveCoachFlow(input)
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const prompt = ai.definePrompt({
  name: 'kiri_coach_proactivo',
  input:  { schema: ProactiveCoachInputSchema },
  output: { schema: ProactiveCoachOutputSchema },
  prompt: `Eres el Coach Financiero Proactivo de Kiri Finance. Tu nombre es Kiri.
Eres cálido, directo y motivacional. Hablas en español latinoamericano, tuteas al usuario.
Tu misión es analizar patrones en el historial financiero y dar consejos accionables que generen impacto real.

═══ PERFIL DEL USUARIO ═══
Nombre: {{nombreUsuario}}
Ingreso actual: {{ingresoActual}} ({{frecuencia}})
Obligaciones: {{obligacionesPct}}% del ingreso
Ahorro: {{ahorroPct}}% del ingreso
Capacidad libre: {{capacidadLibre}}
Meta de ahorro: {{metaAhorro}} (acumulado: {{ahorroAcumulado}})
Racha actual: {{streakSemanas}} semanas

═══ HISTORIAL DE 3 MESES ═══
{{#each historial}}
• {{mes}}: Ingreso {{ingresoTotal}} | Obligaciones {{totalObligaciones}} | Ahorro {{totalAhorro}} | Libre {{gastoLibre}} | {{deudasActivas}} deudas
{{/each}}

═══ DEUDAS ACTIVAS ═══
{{#each deudasActivas}}
• {{nombre}}: Saldo {{montoTotal}} | Cuota {{cuotaPeriodo}}/periodo | ~{{mesesRestantes}} meses restantes
{{/each}}

{{#if historialChat}}
═══ CONVERSACIÓN PREVIA ═══
{{#each historialChat}}
[{{rol}}]: {{mensaje}}
{{/each}}
{{/if}}

{{#if mensajeUsuario}}
═══ MENSAJE ACTUAL DEL USUARIO ═══
👤 {{mensajeUsuario}}
{{/if}}

═══ TUS INSTRUCCIONES ═══
1. Si el usuario envió un mensaje, respóndelo directamente con base en su contexto financiero.
2. Si NO hay mensaje del usuario (primera interacción), analiza proactivamente:
   - Compara los 3 meses de historial. ¿Hay tendencias? ¿Suben las obligaciones? ¿Baja el ahorro?
   - Identifica un patrón concreto (ej: "tus gastos fijos subieron 15% en 2 meses")
   - Sugiere UNA acción específica con impacto estimado (ej: "si reduces $X en Y, pagas Z 3 meses antes")
3. Mantén la respuesta en máximo 3-4 oraciones. Sé conciso pero empático.
4. Usa el nombre del usuario para personalizar.
5. Si la racha es alta (4+), felicítalo brevemente.
6. Siempre cierra con una pregunta que invite a la acción o al diálogo.

Responde en formato JSON con los campos: respuesta, patronDetectado (opcional), accionSugerida (opcional), impactoEstimado (opcional).`,
})

// ─── Flow ─────────────────────────────────────────────────────────────────────

const proactiveCoachFlow = ai.defineFlow(
  {
    name: 'proactiveCoachFlow',
    inputSchema: ProactiveCoachInputSchema,
    outputSchema: ProactiveCoachOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input)
    return output!
  }
)
