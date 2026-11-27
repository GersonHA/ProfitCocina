-- Estados de las ventas de mercado.
--   en_venta  : orden de venta listada, esperando comprador (sigue siendo tuya).
--   vendido   : vendida de verdad (venta instantánea, o una orden que se cumplió).
--   cancelado : se quitó la orden; el ítem vuelve, pero el impuesto ya pagado es pérdida.
--
-- Solo aplica a kind='sell'. Las compras ('buy') se dejan como 'vendido' (hechas).
-- Las filas existentes quedan 'vendido' (antes toda venta se consideraba cerrada).

alter table public.market_txns
  add column if not exists status text not null default 'vendido'
    check (status in ('en_venta', 'vendido', 'cancelado')),
  add column if not exists resolved_at timestamptz;
