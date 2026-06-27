/**
 * @fileOverview Coach Financiero Proactivo de Kiri Finance (Premium).
 *
 * Recibe el contexto financiero completo del usuario incluyendo historial
 * de los últimos 3 meses, y genera consejos proactivos basados en patrones
 * detectados. Permite interacción conversacional.
 *
 * NO usar 'use server' — se invoca desde una API Route de Next.js.
 */

import { ai, GENKIT_MODEL } from '@/ai/genkit'
import { z } from 'genkit'

// ─── Esquemas ─────────────────────────────────────────────────────────────────

const ResumenMensualSchema = z.object({
  mes:               z.string(),
  ingresoTotal:      z.number(),
  totalObligaciones: z.number(),
  totalAhorro:       z.number(),
  gastoLibre:        z.number(),
  deudasActivas:     z.number(),
})

const DeudaActivaSchema = z.object({
  nombre:         z.string(),
  montoTotal:     z.number(),
  cuotaPeriodo:   z.number(),
  mesesRestantes: z.number(),
})

const ProactiveCoachInputSchema = z.object({
  nombreUsuario:   z.string(),
  ingresoActual:   z.number(),
  frecuencia:      z.string(),
  obligacionesPct: z.number(),
  ahorroPct:       z.number(),
  capacidadLibre:  z.number(),
  metaAhorro:      z.number(),
  ahorroAcumulado: z.number(),
  streakSemanas:   z.number(),
  historial:       z.array(ResumenMensualSchema),
  deudasActivas:   z.array(DeudaActivaSchema),
  mensajeUsuario:  z.string().optional(),
  historialChat:   z.array(z.object({
    rol:     z.enum(['usuario', 'coach']),
    mensaje: z.string(),
  })).optional(),
})

export type ProactiveCoachInput  = z.infer<typeof ProactiveCoachInputSchema>

const ProactiveCoachOutputSchema = z.object({
  respuesta:       z.string(),
  patronDetectado: z.string().optional(),
  accionSugerida:  z.string().optional(),
  impactoEstimado: z.string().optional(),
})

export type ProactiveCoachOutput = z.infer<typeof ProactiveCoachOutputSchema>

// ─── Construcción del prompt ──────────────────────────────────────────────────

function buildPrompt(input: ProactiveCoachInput): string {
  const historialLines = input.historial
    .map(h =>
      `• ${h.mes}: Ingreso ${h.ingresoTotal} | Obligaciones ${h.totalObligaciones} | ` +
      `Ahorro ${h.totalAhorro} | Libre ${h.gastoLibre} | ${h.deudasActivas} deudas`
    )
    .join('\n')

  const deudasLines = input.deudasActivas.length > 0
    ? input.deudasActivas
        .map(d =>
          `• ${d.nombre}: Saldo ${d.montoTotal} | Cuota ${d.cuotaPeriodo}/periodo | ~${d.mesesRestantes} meses restantes`
        )
        .join('\n')
    : '• Sin deudas activas'

  const historialChatLines = input.historialChat && input.historialChat.length > 0
    ? `\n═══ CONVERSACIÓN PREVIA ═══\n` +
      input.historialChat.map(m => `[${m.rol}]: ${m.mensaje}`).join('\n')
    : ''

  const mensajeSection = input.mensajeUsuario
    ? `\n═══ MENSAJE ACTUAL DEL USUARIO ═══\n👤 ${input.mensajeUsuario}`
    : ''

  return `Eres el Coach Financiero Proactivo de Kiri Finance. Tu nombre es Kiri.
Eres cálido, directo y motivacional. Hablas en español latinoamericano, tuteas al usuario.
Tu misión es analizar patrones en el historial financiero y dar consejos accionables que generen impacto real.

═══ PERFIL DEL USUARIO ═══
Nombre: ${input.nombreUsuario}
Ingreso actual: ${input.ingresoActual} (${input.frecuencia})
Obligaciones: ${input.obligacionesPct}% del ingreso
Ahorro: ${input.ahorroPct}% del ingreso
Capacidad libre: ${input.capacidadLibre}
Meta de ahorro: ${input.metaAhorro} (acumulado: ${input.ahorroAcumulado})
Racha actual: ${input.streakSemanas} semanas

═══ HISTORIAL DE 3 MESES ═══
${historialLines}

═══ DEUDAS ACTIVAS ═══
${deudasLines}
${historialChatLines}
${mensajeSection}

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

Responde ÚNICAMENTE con un JSON válido con estos campos:
{
  "respuesta": "texto de la respuesta principal (requerido)",
  "patronDetectado": "patrón identificado (opcional, omitir si no aplica)",
  "accionSugerida": "acción concreta sugerida (opcional)",
  "impactoEstimado": "impacto estimado de la acción (opcional)"
}`
}

// ─── Función pública ──────────────────────────────────────────────────────────

export async function proactiveCoach(
  input: ProactiveCoachInput
): Promise<ProactiveCoachOutput> {
  const promptText = buildPrompt(input)

  const { output } = await ai.generate({
    model:  GENKIT_MODEL,
    prompt: promptText,
    output: { schema: ProactiveCoachOutputSchema },
  })

  if (!output) {
    throw new Error('El modelo no devolvió una respuesta válida')
  }

  return output
}
