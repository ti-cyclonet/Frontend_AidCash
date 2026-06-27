import { NextRequest, NextResponse } from 'next/server'
import { proactiveCoach, ProactiveCoachInput } from '@/ai/flows/proactive-coach-flow'

export async function POST(req: NextRequest) {
  try {
    const body: ProactiveCoachInput = await req.json()
    const result = await proactiveCoach(body)
    return NextResponse.json(result)
  } catch (error: unknown) {
    const err = error as { status?: string; code?: number; message?: string }
    console.error('[AI Coach] Error:', err?.message ?? error)

    // Mensajes de error específicos para el usuario
    const isQuotaExhausted =
      err?.status === 'RESOURCE_EXHAUSTED' ||
      err?.code === 429 ||
      String(err?.message).includes('quota') ||
      String(err?.message).includes('RESOURCE_EXHAUSTED')

    const isOverloaded =
      err?.status === 'UNAVAILABLE' ||
      err?.code === 503 ||
      String(err?.message).includes('UNAVAILABLE') ||
      String(err?.message).includes('high demand')

    let userMessage = 'No pude conectar con el coach ahora mismo. Intenta de nuevo en un momento.'

    if (isQuotaExhausted) {
      userMessage = 'El coach de IA alcanzó su límite de uso por hoy. Vuelve a intentarlo mañana o actualiza tu plan de Google AI.'
    } else if (isOverloaded) {
      userMessage = 'El servicio de IA está con alta demanda en este momento. Espera unos segundos e intenta de nuevo.'
    }

    return NextResponse.json(
      {
        respuesta: userMessage,
        patronDetectado: null,
        accionSugerida: null,
        impactoEstimado: null,
      },
      { status: 200 } // 200 para que el chat muestre el mensaje en lugar de un error roto
    )
  }
}
