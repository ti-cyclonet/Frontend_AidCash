-- Migration: 002_add_meta_ahorro
-- Agrega la meta de ahorro personalizada por usuario.
-- Antes estaba hardcodeada como $5,000 en el frontend.
--
-- Ejecutar en: Supabase SQL Editor (Dashboard → SQL Editor → New query)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS meta_ahorro_global numeric NOT NULL DEFAULT 5000;

COMMENT ON COLUMN public.users.meta_ahorro_global IS 'Meta de ahorro total que el usuario quiere alcanzar. Default 5000.';
