import { NextRequest, NextResponse } from 'next/server'
import { proactiveCoach, ProactiveCoachInput } from '@/ai/flows/proactive-coach-flow'

export async function POST(req: NextRequest) {
  try {
    const body: ProactiveCoachInput = await req.json()
    const result = await proactiveCoach(body)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[AI Coach]', error)
    return NextResponse.json(
      {
        respuesta: 'No pude conectar con el coach ahora mismo. Intenta de nuevo en un momento.',
        patronDetectado: null,
        accionSugerida: null,
        impactoEstimado: null,
      },
      { status: 500 }
    )
  }
}
