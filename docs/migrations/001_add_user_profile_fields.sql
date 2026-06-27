-- Migration: 001_add_user_profile_fields
-- Agrega los campos que antes vivían solo en localStorage a la tabla users
-- para que el perfil financiero sea persistente entre dispositivos.
--
-- Ejecutar en: Supabase SQL Editor (Dashboard → SQL Editor → New query)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ingreso_base       numeric          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frecuencia_ingreso text             NOT NULL DEFAULT 'mensual',
  ADD COLUMN IF NOT EXISTS onboarding_done    boolean          NOT NULL DEFAULT false;

-- Comentarios para documentar el propósito de cada columna
COMMENT ON COLUMN public.users.ingreso_base       IS 'Ingreso fijo por periodo (quincenal o mensual)';
COMMENT ON COLUMN public.users.frecuencia_ingreso IS 'Frecuencia del ingreso: mensual | quincenal';
COMMENT ON COLUMN public.users.onboarding_done    IS 'true cuando el usuario completó el wizard de configuración';
