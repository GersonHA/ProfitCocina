-- =====================================================================
-- Órdenes de producción (personales): una "tanda de trabajo" que avanza por
-- estados plan → compras → cocina → completado, para dar trazabilidad.
--   production_orders: la orden (platillo, calidad vía @item, tandas, estado).
--   order_items: cada ingrediente a conseguir, con origen y estado de compra.
-- Las cocinadas reutilizan processes (se enlaza cook_process_id).
-- =====================================================================

create table if not exists public.production_orders (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  output_item text not null references public.items(item_id),
  tandas integer not null default 1 check (tandas > 0),
  state text not null default 'compras' check (state in ('plan', 'compras', 'cocina', 'completado', 'cancelado')),
  cook_process_id uuid references public.processes(id) on delete set null,
  cook_silver numeric,
  cook_output numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.production_orders(id) on delete cascade,
  item_id text not null references public.items(item_id),
  qty numeric not null,
  source text not null check (source in ('member', 'external')),
  seller_id uuid references auth.users(id) on delete set null,
  unit_price numeric,
  bought boolean not null default false,
  trade_id uuid,
  txn_kind text
);

create index if not exists production_orders_group on public.production_orders(group_id, state);
create index if not exists production_orders_user on public.production_orders(user_id, created_at desc);
create index if not exists order_items_order on public.order_items(order_id);

-- RLS: todo el grupo ve las órdenes (trazabilidad); solo el dueño (o un admin) edita.
alter table public.production_orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists po_select on public.production_orders;
create policy po_select on public.production_orders for select
  using (public.is_group_member(group_id));
drop policy if exists po_insert on public.production_orders;
create policy po_insert on public.production_orders for insert
  with check (public.is_group_member(group_id) and user_id = (select auth.uid()));
drop policy if exists po_update on public.production_orders;
create policy po_update on public.production_orders for update
  using (user_id = (select auth.uid()) or public.is_group_admin(group_id));
drop policy if exists po_delete on public.production_orders;
create policy po_delete on public.production_orders for delete
  using (user_id = (select auth.uid()) or public.is_group_admin(group_id));

drop policy if exists oi_select on public.order_items;
create policy oi_select on public.order_items for select
  using (exists (select 1 from public.production_orders o where o.id = order_id and public.is_group_member(o.group_id)));
drop policy if exists oi_write on public.order_items;
create policy oi_write on public.order_items for all
  using (exists (select 1 from public.production_orders o where o.id = order_id and o.user_id = (select auth.uid())))
  with check (exists (select 1 from public.production_orders o where o.id = order_id and o.user_id = (select auth.uid())));
