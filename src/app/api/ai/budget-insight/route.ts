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
  } catch (error) {
    console.error('[AI budget-insight]', error)
    return NextResponse.json(
      { error: 'No se pudo generar el análisis. Intenta de nuevo.' },
      { status: 500 }
    )
  }
}
