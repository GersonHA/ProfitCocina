-- =====================================================================
-- Meta de ganancia por usuario (para el dashboard).
--   meta_amount = silver objetivo
--   meta_period = 'day' | 'week' | 'month' (en qué período se mide)
-- Cada usuario edita su propia meta (lo permite la RLS de profiles).
-- =====================================================================

alter table public.profiles
  add column if not exists meta_amount numeric,
  add column if not exists meta_period text not null default 'month';
