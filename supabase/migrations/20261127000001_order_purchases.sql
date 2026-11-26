-- =====================================================================
-- Lotes de compra de un ingrediente de la orden. Un ingrediente se puede
-- conseguir en VARIAS compras, cada una con su propio origen y precio
-- (a un miembro, o externo al mercado a otro precio, o propio). El Kardex
-- mezcla el costo real. order_items guarda el requerimiento (cuánto hace falta)
-- y la estimación; order_purchases guarda lo realmente comprado.
-- =====================================================================

create table if not exists public.order_purchases (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  qty numeric not null check (qty > 0),
  source text not null check (source in ('member', 'external', 'propio')),
  seller_id uuid references auth.users(id) on delete set null,
  unit_price numeric,
  trade_id uuid,
  txn_kind text,
  created_at timestamptz not null default now()
);

create index if not exists order_purchases_item on public.order_purchases(order_item_id);

alter table public.order_purchases enable row level security;

-- Dueño de la orden (vía order_item → production_orders) escribe; el grupo ve.
drop policy if exists op_select on public.order_purchases;
create policy op_select on public.order_purchases for select
  using (exists (
    select 1 from public.order_items oi
    join public.production_orders o on o.id = oi.order_id
    where oi.id = order_item_id and public.is_group_member(o.group_id)
  ));

drop policy if exists op_write on public.order_purchases;
create policy op_write on public.order_purchases for all
  using (exists (
    select 1 from public.order_items oi
    join public.production_orders o on o.id = oi.order_id
    where oi.id = order_item_id and o.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.order_items oi
    join public.production_orders o on o.id = oi.order_id
    where oi.id = order_item_id and o.user_id = (select auth.uid())
  ));
