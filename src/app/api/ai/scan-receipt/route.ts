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
  } catch (error) {
    console.error('[AI Receipt Scanner]', error)
    return NextResponse.json(
      { error: 'No se pudo procesar el recibo. Intenta con una imagen más clara.' },
      { status: 500 }
    )
  }
}
