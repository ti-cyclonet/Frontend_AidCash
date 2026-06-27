import { NextRequest, NextResponse } from 'next/server'
import {
  budgetAdjustmentExplanation,
  BudgetAdjustmentExplanationInput,
} from '@/ai/flows/budget-adjustment-explanation-flow'

export async function POST(req: NextRequest) {
  try {
    const body: BudgetAdjustmentExplanationInput = await req.json()
    const result = await budgetAdjustmentExplanation(body)
    return NextResponse.json(result)
  } catch (error: unknown) {
    const err = error as { status?: string; code?: number; message?: string }
    console.error('[AI budget-insight] Error:', err?.message ?? error)

    const isQuotaExhausted =
      err?.status === 'RESOURCE_EXHAUSTED' ||
      err?.code === 429 ||
      String(err?.message).includes('quota')

    const message = isQuotaExhausted
      ? 'El análisis IA alcanzó su límite de uso por hoy.'
      : 'No se pudo generar el análisis. Intenta de nuevo.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
