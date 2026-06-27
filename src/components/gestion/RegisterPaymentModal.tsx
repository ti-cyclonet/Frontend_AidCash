"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { cn } from "@/lib/utils"
import { Wallet, Zap, Plus } from "lucide-react"
import { userApi } from "@/lib/api-client"

// ─── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  monto: z
    .string()
    .min(1, "El monto es requerido")
    .refine((v) => Number(v) > 0, { message: "El monto debe ser mayor a 0" }),
  tipo: z.enum(["salario", "extra"], {
    required_error: "Selecciona el tipo de ingreso",
  }),
})

type FormValues = z.infer<typeof schema>

// ─── Props ─────────────────────────────────────────────────────────────────────

interface RegisterPaymentModalProps {
  /** Llamado después de guardar exitosamente con el nuevo saldo */
  onSuccess?: (newBalance: number) => void
}

// ─── Tipos de ingreso ──────────────────────────────────────────────────────────

const INCOME_TYPES: { value: "salario" | "extra"; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: "salario",
    label: "Sueldo / Pago del periodo",
    description: "Solo suma al saldo disponible — no cambia tu sueldo base",
    icon: <Wallet className="h-4 w-4" />,
  },
  {
    value: "extra",
    label: "Ingreso Extra",
    description: "Freelance, bono, comisión, venta, etc.",
    icon: <Zap className="h-4 w-4" />,
  },
]

// ─── Componente ────────────────────────────────────────────────────────────────

export function RegisterPaymentModal({ onSuccess }: RegisterPaymentModalProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { monto: "", tipo: "salario" },
  })

  const tipoActual = watch("tipo")

  const handleClose = () => {
    setOpen(false)
    reset()
    setServerError(null)
  }

  const onSubmit = async (values: FormValues) => {
    setSaving(true)
    setServerError(null)
    try {
      const { data, error } = await userApi.updateBalance(Number(values.monto), "ingreso")
      if (error || !data) {
        setServerError(error ?? "No se pudo registrar el ingreso. Intenta de nuevo.")
        return
      }
      onSuccess?.(data.cashBalance)
      handleClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* ── Trigger ── */}
      <Button
        onClick={() => setOpen(true)}
        className="gap-2 bg-cyclon-lavender hover:bg-cyclon-lavender/90 text-white font-bold rounded-2xl shadow-lg shadow-cyclon-lavender/25 px-5"
      >
        <Plus className="h-4 w-4" />
        Registrar Ingreso
      </Button>

      {/* ── Modal ── */}
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-cyclon-lavender" />
              Registrar Ingreso Recibido
            </DialogTitle>
            <DialogDescription>
              El monto se <strong>suma al saldo disponible</strong>. Tu sueldo base configurado no cambia.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-2">
            {/* ── Tipo de ingreso ── */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Tipo de ingreso
              </Label>
              <Controller
                name="tipo"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-1 gap-2">
                    {INCOME_TYPES.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => field.onChange(opt.value)}
                        className={cn(
                          "flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-colors",
                          field.value === opt.value
                            ? "border-cyclon-lavender bg-cyclon-lavender/5"
                            : "border-muted hover:border-cyclon-lavender/40"
                        )}
                      >
                        <div
                          className={cn(
                            "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                            field.value === opt.value
                              ? "bg-cyclon-lavender text-white"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {opt.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm">{opt.label}</p>
                          <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                        </div>
                        <div
                          className={cn(
                            "h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
                            field.value === opt.value
                              ? "border-cyclon-lavender bg-cyclon-lavender"
                              : "border-muted-foreground/30"
                          )}
                        >
                          {field.value === opt.value && (
                            <div className="h-1.5 w-1.5 rounded-full bg-white" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              />
              {errors.tipo && (
                <p className="text-xs text-destructive font-medium">{errors.tipo.message}</p>
              )}
            </div>

            {/* ── Monto ── */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Monto recibido
              </Label>
              <Controller
                name="monto"
                control={control}
                render={({ field }) => (
                  <MoneyInput
                    value={field.value}
                    onChange={field.onChange}
                    className="h-16 text-3xl font-bold bg-muted/30 border-none rounded-2xl focus-visible:ring-cyclon-lavender"
                    placeholder="0"
                    autoFocus
                  />
                )}
              />
              {errors.monto && (
                <p className="text-xs text-destructive font-medium">{errors.monto.message}</p>
              )}
            </div>

            {/* ── Error de servidor ── */}
            {serverError && (
              <p className="text-xs text-destructive font-medium bg-destructive/10 px-3 py-2 rounded-xl">
                {serverError}
              </p>
            )}

            <DialogFooter className="gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-cyclon-lavender text-white font-bold rounded-xl px-8 hover:bg-cyclon-lavender/90"
              >
                {saving ? (
                  <>
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin mr-2" />
                    Guardando...
                  </>
                ) : (
                  "Guardar ingreso"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
