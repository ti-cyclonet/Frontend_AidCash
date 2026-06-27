-- Migration: 005_fixed_expenses_paid
-- Añade campo de pago a los gastos fijos para poder marcarlos como pagados.
-- Ejecutar en: Supabase SQL Editor

ALTER TABLE public.fixed_expenses
  ADD COLUMN IF NOT EXISTS pagado_este_periodo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.fixed_expenses.pagado_este_periodo IS 'true si ya se pagó este gasto fijo en el periodo actual';
