-- Migration: 006_impulse_expenses
-- Gastos hormiga (café, antojos, salidas diarias)
-- Ejecutar en: Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.impulse_expenses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  monto       numeric NOT NULL DEFAULT 0,
  categoria   text NOT NULL DEFAULT 'otro',
  periodo     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.impulse_expenses IS 'Gastos hormiga diarios del usuario (café, antojos, transporte casual, etc.)';

-- Índice para consultas rápidas por usuario y periodo
CREATE INDEX IF NOT EXISTS idx_impulse_expenses_user_periodo 
  ON public.impulse_expenses(user_id, periodo);
