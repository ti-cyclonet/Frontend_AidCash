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
  ahorro: z.array(z.object({
    nombre: z.string().describe("Nombre del bolsillo de ahorro (ej: viajes, emergencia)"),
    monto: z.number().describe("Monto a ahorrar"),
  })).describe("Ahorros detectados - si el usuario dice 'quiero ahorrar X para Y'"),
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
- Si menciona "gano X" o "sueldo de X" o "me pagan X" o "recibí X" → ingreso (va al saldo real)
- Si menciona "pago X en Y" o "debo X" o "cuota de X" → deuda (va a la sección de deudas)
- Si menciona "pago recurrente" o servicios como luz, agua, internet, arriendo → gasto fijo
- Si menciona "quiero ahorrar X" o "guardar X para Y" o "meta de X" → ahorro (se crea un bolsillo)
- Gastos hormiga: café, comida rápida, transporte casual, antojos, salidas
- Si menciona "el día X" o "cada X" → fecha de corte o vencimiento
- Si menciona "quincenal" o "cada 15 días" → frecuencia quincenal
- Para fechas: si dice "el 15" → diaCorte=15, fechaVencimiento="${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-15"

Para resumenKiri: explica claramente qué entendiste y DÓNDE se va a guardar cada dato. Usa un tono cálido y directo. Máximo 4 oraciones. Ejemplo:
"Entendí que ganas $2000 al mes, se sumará a tu saldo real. Detecté una deuda de $5000 con cuota de $500 el día 15. También quieres ahorrar $300 para viajes, lo guardaré en un bolsillo. ¿Todo correcto?"

Responde solo con JSON válido.`,
    })

    return NextResponse.json(output)
  } catch (error) {
    console.error("[VoiceExtract]", error)
    return NextResponse.json({ error: "No pude procesar la transcripción." }, { status: 500 })
  }
}
