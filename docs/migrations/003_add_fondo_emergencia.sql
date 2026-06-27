-- Migration: 003_add_fondo_emergencia
-- Añade el saldo del Fondo de Emergencia, separado del ahorro general.
-- Ejecutar en: Supabase SQL Editor

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS fondo_emergencia_actual numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.users.fondo_emergencia_actual IS 'Saldo acumulado en el Fondo de Emergencia (separado del ahorro general).';

-- Tabla de movimientos del fondo de emergencia
CREATE TABLE IF NOT EXISTS public.emergency_fund_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  periodo     text NOT NULL,
  monto       numeric NOT NULL DEFAULT 0,
  tipo        text NOT NULL CHECK (tipo IN ('aporte', 'retiro')),
  nota        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.emergency_fund_history IS 'Historial de aportes y retiros del Fondo de Emergencia por usuario.';
w