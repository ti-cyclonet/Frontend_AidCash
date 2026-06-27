-- Migration: 004_add_streaks
-- Sistema de rachas y logros para gamificación.
-- Ejecutar en: Supabase SQL Editor

-- Campos de racha directamente en la tabla users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS streak_actual      integer   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_mejor       integer   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_ultimo_check date;

COMMENT ON COLUMN public.users.streak_actual      IS 'Racha actual de semanas consecutivas cumpliendo presupuesto';
COMMENT ON COLUMN public.users.streak_mejor       IS 'Mejor racha histórica (máximo alcanzado)';
COMMENT ON COLUMN public.users.streak_ultimo_check IS 'Última fecha en que se evaluó la racha';

-- Tabla de insignias desbloqueadas por el usuario
CREATE TABLE IF NOT EXISTS public.user_badges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_id    text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

COMMENT ON TABLE public.user_badges IS 'Insignias desbloqueadas por cada usuario';
