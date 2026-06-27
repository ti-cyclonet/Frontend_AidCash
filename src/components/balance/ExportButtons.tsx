"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import { exportToExcel, exportToPdf } from "@/lib/export-utils"
import type { BalanceReport } from "@/lib/api-client"
import { cn } from "@/lib/utils"

interface ExportButtonsProps {
  report: BalanceReport | null
  className?: string
}

export function ExportButtons({ report, className }: ExportButtonsProps) {
  const [loadingExcel, setLoadingExcel] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)

  const handleExcel = async () => {
    if (!report) return
    setLoadingExcel(true)
    try {
      await exportToExcel(report, `kiri-balance-${report.timeframe}`)
    } finally {
      setLoadingExcel(false)
    }
  }

  const handlePdf = async () => {
    if (!report) return
    setLoadingPdf(true)
    try {
      await exportToPdf(report, `kiri-balance-${report.timeframe}`)
    } finally {
      setLoadingPdf(false)
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExcel}
        disabled={!report || loadingExcel}
        className="h-9 rounded-xl gap-1.5 border-cyclon-mint/40 text-cyclon-periwinkle hover:bg-cyclon-mint/10 hover:border-cyclon-mint font-bold text-xs"
      >
        {loadingExcel
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <FileSpreadsheet className="h-3.5 w-3.5 text-cyclon-mint" />
        }
        Excel
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handlePdf}
        disabled={!report || loadingPdf}
        className="h-9 rounded-xl gap-1.5 border-cyclon-pink/40 text-cyclon-periwinkle hover:bg-cyclon-pink/10 hover:border-cyclon-pink font-bold text-xs"
      >
        {loadingPdf
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <FileText className="h-3.5 w-3.5 text-cyclon-pink" />
        }
        PDF
      </Button>
    </div>
  )
}
