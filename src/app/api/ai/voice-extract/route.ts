import { NextRequest, NextResponse } from "next/server"
import { ai } from "@/ai/genkit"
import { z } from "genkit"

// ─── Schema de salida ──────────────────────────────────────────────────────────
const VoiceExtractOutputSchema = z.object({
  ingreso: z.object({
    monto: z.number().nullable(),
    frecuencia: z.enum(["mensual", "quincenal"]).nullable(),
  }).describe("Ingreso detectado"),
  deudas: z.array(z.object({
    nombre: z.string(),
    monto: z.number(),
    cuota: z.number().nullable(),
    fechaVencimiento: z.string().nullable(),
    diaCorte: z.number().nullable(),
  })).describe("Deudas detectadas"),
  gastosFijos: z.array(z.object({
    nombre: z.string(),
    monto: z.number(),
    fechaCorte: z.string().nullable(),
    diaCorte: z.number().nullable(),
  })).describe("Gastos fijos detectados"),
  gastosHormiga: z.array(z.object({
    nombre: z.string(),
    monto: z.number(),
    categoria: z.enum(["cafe", "comida", "transporte", "antojo", "salida", "otro"]),
  })).describe("Gastos pequeños detectados"),
  resumenKiri: z.string().describe("Explicación amigable de lo que Kiri entendió y dónde lo ubicó"),
  confianza: z.enum(["alta", "media", "baja"]),
})

export type VoiceExtractOutput = z.infer<typeof VoiceExtractOutputSchema>

export async function POST(req: NextRequest) {
  try {
    const { transcripcion } = await req.json()
    if (!transcripcion || typeof transcripcion !== "string") {
      return NextResponse.json({ error: "Se requiere 'transcripcion'" }, { status: 400 })
    }

    const { output } = await ai.generate({
      model: "googleai/gemini-2.5-flash",
      output: { schema: VoiceExtractOutputSchema },
      prompt: `Eres Kiri, el asistente financiero de Kiri Finance. El usuario dictó este texto por voz:

"${transcripcion}"

Tu tarea es extraer todos los datos financieros mencionados y clasificarlos. Sé inteligente con el contexto:
- Si menciona "gano X" o "sueldo de X" o "me pagan X" → ingreso
- Si menciona "pago X en Y" o "debo X" o "cuota de X" → deuda o gasto fijo (si parece recurrente es gasto fijo)
- Si menciona "el día X" o "cada X" → fecha de corte o vencimiento
- Si menciona "quincenal" o "cada 15 días" → frecuencia quincenal
- Gastos hormiga: café, comida, transporte casual, antojos
- Para fechas: si dice "el 15" → diaCorte=15, fechaVencimiento="${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-15"

Para resumenKiri: escribe en primera persona como Kiri, explica claramente qué entendiste y en qué sección se va a guardar cada dato. Usa un tono cálido y directo. Máximo 4 oraciones.

Ejemplo de resumen: "Entendí que ganas $2000 al mes. Detecté un pago de luz por $500 con corte el 15, lo agendé como gasto fijo. ¿Todo correcto?"

Responde solo con JSON válido.`,
    })

    return NextResponse.json(output)
  } catch (error) {
    console.error("[VoiceExtract]", error)
    return NextResponse.json({ error: "No pude procesar la transcripción." }, { status: 500 })
  }
}
