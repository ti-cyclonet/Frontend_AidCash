import { NextRequest, NextResponse } from 'next/server'
import { scanReceipt, ReceiptScannerInput } from '@/ai/flows/receipt-scanner-flow'

export async function POST(req: NextRequest) {
  try {
    const body: ReceiptScannerInput = await req.json()

    if (!body.imageBase64 || !body.mimeType) {
      return NextResponse.json(
        { error: 'Se requiere imageBase64 y mimeType' },
        { status: 400 }
      )
    }

    const result = await scanReceipt(body)
    return NextResponse.json(result)
  } catch (error: unknown) {
    const err = error as { status?: string; code?: number; message?: string }
    console.error('[AI Receipt Scanner] Error:', err?.message ?? error)

    const isQuotaExhausted =
      err?.status === 'RESOURCE_EXHAUSTED' ||
      err?.code === 429 ||
      String(err?.message).includes('quota')

    const message = isQuotaExhausted
      ? 'El escáner alcanzó su límite de uso por hoy. Vuelve mañana o actualiza tu plan de Google AI.'
      : 'No se pudo procesar el recibo. Intenta con una imagen más clara.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
