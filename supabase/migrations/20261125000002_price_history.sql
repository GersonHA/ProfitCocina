-- =====================================================================
-- Historial de precios de mercado
--
-- `fecha`  = el día al que corresponde el precio (puede registrarse después,
--            p. ej. hoy anoto el precio de ayer).
-- `volume` = cuánto se vendió ese día (para el gráfico de barras de volumen).
--
-- Así el módulo de precios deja de ser una foto única y pasa a ser una serie
-- diaria por (item, ciudad), con gráfico lineal de precio + barras de volumen.
-- =====================================================================

alter table public.price_snapshots
  add column if not exists fecha  date not null default current_date,
  add column if not exists volume numeric;

create index if not exists price_snapshots_hist
  on public.price_snapshots (item_id, city, fecha);
