-- =====================================================================
-- Profit Cocina — esquema inicial (Fase 0 / MVP)
--
-- Modelo: la app (SvelteKit en GitHub Pages) habla con Supabase desde el
-- navegador con la clave pública. Cada tabla tiene RLS: Postgres solo entrega
-- y acepta filas del grupo al que perteneces. Los registros de dominio
-- (procesos, compras, ventas, ajustes) son la fuente de verdad; el Kardex
-- (inventory_movements / inventory_balances) es una proyección que recalcula
-- una Edge Function con el motor de costos (src/lib/core).
--
-- Todos los importes son `numeric` (decimal exacto) a propósito: el motor
-- guarda precisión completa y numeric la devuelve tal cual.
--
-- Se aplica con `supabase db reset` (local) o pegándolo en el SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Orden global de eventos (desempate del Kardex dentro de un mismo día)
-- ---------------------------------------------------------------------
create sequence if not exists public.event_seq;

-- ---------------------------------------------------------------------
-- 1. Identidad y grupos
-- ---------------------------------------------------------------------

-- Perfil del jugador (se crea solo al registrarse, ver handle_new_user).
create table if not exists public.profiles (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  nick              text,
  premium           boolean not null default true,     -- afecta el impuesto de SUS ventas
  especializaciones jsonb   not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  server     text not null default 'americas' check (server in ('americas', 'europe', 'asia')),
  settings   jsonb not null default '{}'::jsonb,       -- % costo+%, comisión cocinero, impuestos, ciudad por defecto…
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      text not null default 'member' check (role in ('admin', 'member')),
  nick      text,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_invites (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  code       text not null unique,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  expires_at timestamptz,
  max_uses   integer,
  uses       integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Catálogo del juego (global, compartido, lo escribe solo el import)
-- ---------------------------------------------------------------------

create table if not exists public.items (
  item_id    text primary key,            -- ej. T7_MEAL_OMELETTE@1
  name_es    text not null,
  tier       smallint,
  enchant    smallint not null default 0,
  category   text,
  nutrition  numeric,
  item_value numeric,
  raw        jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id         uuid primary key default gen_random_uuid(),
  output_item text not null references public.items (item_id) on delete cascade,
  output_qty numeric not null default 1,
  station    text,
  focus_cost numeric,
  updated_at timestamptz not null default now(),
  unique (output_item)
);

create table if not exists public.recipe_ingredients (
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  item_id   text not null references public.items (item_id) on delete restrict,
  qty       numeric not null,
  primary key (recipe_id, item_id)
);

create table if not exists public.city_bonuses (
  city      text not null,
  category  text not null,
  bonus_pct numeric not null default 0,
  primary key (city, category)
);

-- ---------------------------------------------------------------------
-- 3. Procesos (el LOTE) — fuente de verdad de la producción
-- ---------------------------------------------------------------------

create table if not exists public.processes (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type         text not null,                           -- siembra | cria | refinado | cocina …
  fecha        date not null,
  seq          bigint not null default nextval('public.event_seq'),
  city         text,
  focus_used   boolean not null default false,
  focus_amount numeric,
  notes        text,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists processes_group_fecha on public.processes (group_id, fecha);
create index if not exists processes_user_order on public.processes (user_id, fecha, seq);

create table if not exists public.process_inputs (
  id         uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes (id) on delete cascade,
  item_id    text not null references public.items (item_id) on delete restrict,
  qty        numeric not null
);
create index if not exists process_inputs_process on public.process_inputs (process_id);

create table if not exists public.process_outputs (
  id         uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes (id) on delete cascade,
  item_id    text not null references public.items (item_id) on delete restrict,
  qty        numeric not null,
  role       text not null default 'principal' check (role in ('principal', 'subproducto')),
  valuation  numeric
);
create index if not exists process_outputs_process on public.process_outputs (process_id);

create table if not exists public.process_expenses (
  id         uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes (id) on delete cascade,
  kind       text not null,                             -- semillas | estacion | transporte | otros
  silver     numeric not null default 0
);
create index if not exists process_expenses_process on public.process_expenses (process_id);

-- ---------------------------------------------------------------------
-- 4. Intercambios y mercado
-- ---------------------------------------------------------------------

create table if not exists public.member_trades (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references public.groups (id) on delete cascade,
  seller_id        uuid not null references auth.users (id) on delete cascade,
  buyer_id         uuid not null references auth.users (id) on delete cascade,
  item_id          text not null references public.items (item_id) on delete restrict,
  qty              numeric not null,
  price_unit       numeric not null,                    -- sugerido: costo promedio del vendedor
  market_value_net numeric,                             -- valor de mercado neto al momento (margen cedido)
  fecha            date not null,
  seq              bigint not null default nextval('public.event_seq'),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists member_trades_group_fecha on public.member_trades (group_id, fecha);

create table if not exists public.market_txns (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id    text not null references public.items (item_id) on delete restrict,
  qty        numeric not null,
  price_unit numeric not null,
  city       text,
  kind       text not null check (kind in ('buy', 'sell')),
  order_type text check (order_type in ('sell_order', 'instant')),
  taxes      numeric not null default 0,
  fecha      date not null,
  seq        bigint not null default nextval('public.event_seq'),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists market_txns_group_fecha on public.market_txns (group_id, fecha);

create table if not exists public.stock_adjustments (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id    text not null references public.items (item_id) on delete restrict,
  qty_delta  numeric not null,                          -- +/−
  unit_cost  numeric,                                   -- solo para deltas positivos sin stock previo
  kind       text not null,                             -- conteo | perdida | consumo | …
  reason     text not null,                             -- motivo OBLIGATORIO (auditoría)
  fecha      date not null,
  seq        bigint not null default nextval('public.event_seq'),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists stock_adjustments_group_fecha on public.stock_adjustments (group_id, fecha);

-- ---------------------------------------------------------------------
-- 5. Kardex (proyección: la recalcula la Edge Function, no el cliente)
-- ---------------------------------------------------------------------

create table if not exists public.inventory_movements (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  item_id      text not null,
  fecha        date not null,
  seq          bigint not null,
  type         text not null,
  qty          numeric not null,
  unit_cost    numeric not null,
  total_cost   numeric not null,
  bal_qty      numeric not null,
  bal_avg_cost numeric not null,
  bal_value    numeric not null,
  source_table text not null,
  source_id    uuid not null,
  created_at   timestamptz not null default now()
);
create index if not exists inventory_movements_key
  on public.inventory_movements (group_id, user_id, item_id, fecha, seq);

create table if not exists public.inventory_balances (
  group_id   uuid not null references public.groups (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  item_id    text not null,
  qty        numeric not null default 0,
  avg_cost   numeric not null default 0,
  value      numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id, item_id)
);

-- ---------------------------------------------------------------------
-- 6. Precios de mercado y auditoría
-- ---------------------------------------------------------------------

create table if not exists public.price_snapshots (
  id             uuid primary key default gen_random_uuid(),
  item_id        text not null references public.items (item_id) on delete cascade,
  city           text not null,
  server         text not null default 'americas',
  sell_order_min numeric,
  buy_order_max  numeric,
  avg24          numeric,
  source         text not null default 'manual' check (source in ('manual', 'api')),
  captured_at    timestamptz not null default now(),
  created_by     uuid default auth.uid() references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists price_snapshots_key
  on public.price_snapshots (item_id, city, server, captured_at desc);

create table if not exists public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid references public.groups (id) on delete cascade,
  actor_id   uuid default auth.uid() references auth.users (id) on delete set null,
  entity     text not null,
  entity_id  uuid,
  action     text not null check (action in ('create', 'update', 'delete')),
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_group on public.audit_log (group_id, created_at desc);

-- ---------------------------------------------------------------------
-- 7. Funciones auxiliares de pertenencia (SECURITY DEFINER evita recursión RLS)
-- ---------------------------------------------------------------------

create or replace function public.is_group_member(gid uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_group_admin(gid uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.user_id = (select auth.uid()) and m.role = 'admin'
  );
$$;

create or replace function public.shares_group(other uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = (select auth.uid()) and b.user_id = other
  );
$$;

-- ---------------------------------------------------------------------
-- 8. RPC: crear grupo (te hace admin) y canjear invitación (te hace miembro)
-- ---------------------------------------------------------------------

create or replace function public.create_group(p_name text, p_server text default 'americas')
returns public.groups language plpgsql security definer set search_path = '' as $$
declare g public.groups;
begin
  insert into public.groups (name, server, created_by)
  values (p_name, coalesce(p_server, 'americas'), (select auth.uid()))
  returning * into g;

  insert into public.group_members (group_id, user_id, role)
  values (g.id, (select auth.uid()), 'admin');

  return g;
end;
$$;

create or replace function public.redeem_invite(p_code text)
returns public.group_members language plpgsql security definer set search_path = '' as $$
declare inv public.group_invites; m public.group_members;
begin
  select * into inv from public.group_invites where code = p_code;
  if inv.id is null then raise exception 'Invitación no encontrada'; end if;
  if inv.expires_at is not null and inv.expires_at < now() then raise exception 'Invitación vencida'; end if;
  if inv.max_uses is not null and inv.uses >= inv.max_uses then raise exception 'Invitación agotada'; end if;

  insert into public.group_members (group_id, user_id, role)
  values (inv.group_id, (select auth.uid()), 'member')
  on conflict (group_id, user_id) do nothing;

  update public.group_invites set uses = uses + 1 where id = inv.id;

  select * into m from public.group_members
  where group_id = inv.group_id and user_id = (select auth.uid());
  return m;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. updated_at automático y alta de usuario
-- ---------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'groups', 'items', 'recipes', 'processes',
    'member_trades', 'market_txns', 'inventory_balances'
  ] loop
    execute format('drop trigger if exists touch_updated_at on public.%I', t);
    execute format(
      'create trigger touch_updated_at before update on public.%I
         for each row execute function public.touch_updated_at()', t);
  end loop;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, nick)
  values (new.id, split_part(coalesce(new.email, ''), '@', 1))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 10. RLS
-- ---------------------------------------------------------------------

alter table public.profiles           enable row level security;
alter table public.groups             enable row level security;
alter table public.group_members      enable row level security;
alter table public.group_invites      enable row level security;
alter table public.items              enable row level security;
alter table public.recipes            enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.city_bonuses       enable row level security;
alter table public.processes          enable row level security;
alter table public.process_inputs     enable row level security;
alter table public.process_outputs    enable row level security;
alter table public.process_expenses   enable row level security;
alter table public.member_trades      enable row level security;
alter table public.market_txns        enable row level security;
alter table public.stock_adjustments  enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_balances enable row level security;
alter table public.price_snapshots    enable row level security;
alter table public.audit_log          enable row level security;

-- Perfiles: tú y tus compañeros de grupo (transparencia).
create policy profiles_select on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.shares_group(user_id));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy profiles_delete on public.profiles for delete to authenticated
  using (user_id = (select auth.uid()));

-- Grupos: visibles a sus miembros; los crea cualquiera (create_group), los edita el admin.
create policy groups_select on public.groups for select to authenticated
  using (public.is_group_member(id) or created_by = (select auth.uid()));
create policy groups_insert on public.groups for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy groups_update on public.groups for update to authenticated
  using (public.is_group_admin(id)) with check (public.is_group_admin(id));
create policy groups_delete on public.groups for delete to authenticated
  using (public.is_group_admin(id));

-- Miembros: visibles dentro del grupo; alta/baja por el admin (o te sales tú).
create policy members_select on public.group_members for select to authenticated
  using (public.is_group_member(group_id));
create policy members_insert on public.group_members for insert to authenticated
  with check (public.is_group_admin(group_id));
create policy members_update on public.group_members for update to authenticated
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy members_delete on public.group_members for delete to authenticated
  using (public.is_group_admin(group_id) or user_id = (select auth.uid()));

-- Invitaciones: las gestiona el admin; canjear va por redeem_invite (SECURITY DEFINER).
create policy invites_select on public.group_invites for select to authenticated
  using (public.is_group_member(group_id));
create policy invites_insert on public.group_invites for insert to authenticated
  with check (public.is_group_admin(group_id));
create policy invites_update on public.group_invites for update to authenticated
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy invites_delete on public.group_invites for delete to authenticated
  using (public.is_group_admin(group_id));

-- Catálogo: cualquiera autenticado lo lee; lo escribe solo el import (service_role).
create policy items_select            on public.items              for select to authenticated using (true);
create policy recipes_select          on public.recipes            for select to authenticated using (true);
create policy recipe_ing_select       on public.recipe_ingredients for select to authenticated using (true);
create policy city_bonuses_select     on public.city_bonuses       for select to authenticated using (true);

-- Procesos: los ve el grupo; los edita su dueño o el admin.
create policy processes_select on public.processes for select to authenticated
  using (public.is_group_member(group_id));
create policy processes_insert on public.processes for insert to authenticated
  with check (public.is_group_member(group_id) and user_id = (select auth.uid()));
create policy processes_update on public.processes for update to authenticated
  using (user_id = (select auth.uid()) or public.is_group_admin(group_id))
  with check (user_id = (select auth.uid()) or public.is_group_admin(group_id));
create policy processes_delete on public.processes for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_group_admin(group_id));

-- Hijos del proceso: heredan el permiso del proceso padre.
create policy pinputs_select on public.process_inputs for select to authenticated
  using (exists (select 1 from public.processes p where p.id = process_id and public.is_group_member(p.group_id)));
create policy pinputs_write on public.process_inputs for all to authenticated
  using (exists (select 1 from public.processes p where p.id = process_id and (p.user_id = (select auth.uid()) or public.is_group_admin(p.group_id))))
  with check (exists (select 1 from public.processes p where p.id = process_id and (p.user_id = (select auth.uid()) or public.is_group_admin(p.group_id))));

create policy poutputs_select on public.process_outputs for select to authenticated
  using (exists (select 1 from public.processes p where p.id = process_id and public.is_group_member(p.group_id)));
create policy poutputs_write on public.process_outputs for all to authenticated
  using (exists (select 1 from public.processes p where p.id = process_id and (p.user_id = (select auth.uid()) or public.is_group_admin(p.group_id))))
  with check (exists (select 1 from public.processes p where p.id = process_id and (p.user_id = (select auth.uid()) or public.is_group_admin(p.group_id))));

create policy pexpenses_select on public.process_expenses for select to authenticated
  using (exists (select 1 from public.processes p where p.id = process_id and public.is_group_member(p.group_id)));
create policy pexpenses_write on public.process_expenses for all to authenticated
  using (exists (select 1 from public.processes p where p.id = process_id and (p.user_id = (select auth.uid()) or public.is_group_admin(p.group_id))))
  with check (exists (select 1 from public.processes p where p.id = process_id and (p.user_id = (select auth.uid()) or public.is_group_admin(p.group_id))));

-- Compras entre miembros: las ve el grupo; las edita el comprador, el vendedor o el admin.
create policy trades_select on public.member_trades for select to authenticated
  using (public.is_group_member(group_id));
create policy trades_insert on public.member_trades for insert to authenticated
  with check (public.is_group_member(group_id)
    and (seller_id = (select auth.uid()) or buyer_id = (select auth.uid()) or public.is_group_admin(group_id)));
create policy trades_update on public.member_trades for update to authenticated
  using (seller_id = (select auth.uid()) or buyer_id = (select auth.uid()) or public.is_group_admin(group_id))
  with check (seller_id = (select auth.uid()) or buyer_id = (select auth.uid()) or public.is_group_admin(group_id));
create policy trades_delete on public.member_trades for delete to authenticated
  using (seller_id = (select auth.uid()) or buyer_id = (select auth.uid()) or public.is_group_admin(group_id));

-- Mercado y ajustes: los ve el grupo; los edita su dueño o el admin.
create policy market_select on public.market_txns for select to authenticated
  using (public.is_group_member(group_id));
create policy market_insert on public.market_txns for insert to authenticated
  with check (public.is_group_member(group_id) and user_id = (select auth.uid()));
create policy market_update on public.market_txns for update to authenticated
  using (user_id = (select auth.uid()) or public.is_group_admin(group_id))
  with check (user_id = (select auth.uid()) or public.is_group_admin(group_id));
create policy market_delete on public.market_txns for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_group_admin(group_id));

create policy adj_select on public.stock_adjustments for select to authenticated
  using (public.is_group_member(group_id));
create policy adj_insert on public.stock_adjustments for insert to authenticated
  with check (public.is_group_member(group_id) and user_id = (select auth.uid()));
create policy adj_update on public.stock_adjustments for update to authenticated
  using (user_id = (select auth.uid()) or public.is_group_admin(group_id))
  with check (user_id = (select auth.uid()) or public.is_group_admin(group_id));
create policy adj_delete on public.stock_adjustments for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_group_admin(group_id));

-- Kardex (proyección): solo lectura para el grupo; lo escribe la Edge Function (service_role).
create policy invmov_select on public.inventory_movements for select to authenticated
  using (public.is_group_member(group_id));
create policy invbal_select on public.inventory_balances for select to authenticated
  using (public.is_group_member(group_id));

-- Precios: cualquiera autenticado los lee; los snapshots manuales los crea quien sea.
create policy prices_select on public.price_snapshots for select to authenticated using (true);
create policy prices_insert on public.price_snapshots for insert to authenticated
  with check (created_by = (select auth.uid()));

-- Auditoría: solo lectura para el grupo; la escribe la Edge Function (service_role).
create policy audit_select on public.audit_log for select to authenticated
  using (group_id is null or public.is_group_member(group_id));

-- ---------------------------------------------------------------------
-- 11. Privilegios: sin sesión (anon) no se ve nada
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;

grant select on
  public.items, public.recipes, public.recipe_ingredients, public.city_bonuses,
  public.inventory_movements, public.inventory_balances, public.audit_log
  to authenticated;

grant select, insert on public.price_snapshots to authenticated;

grant select, insert, update, delete on
  public.profiles, public.groups, public.group_members, public.group_invites,
  public.processes, public.process_inputs, public.process_outputs, public.process_expenses,
  public.member_trades, public.market_txns, public.stock_adjustments
  to authenticated;

grant usage on sequence public.event_seq to authenticated;
grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;

-- ---------------------------------------------------------------------
-- 12. Tiempo real (cambios en un dispositivo aparecen en los demás)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'group_members', 'processes', 'process_inputs', 'process_outputs', 'process_expenses',
    'member_trades', 'market_txns', 'stock_adjustments',
    'inventory_movements', 'inventory_balances', 'price_snapshots'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
