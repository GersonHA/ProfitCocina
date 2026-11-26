-- =====================================================================
-- Lotes de producción (farming): una corrida de la cadena de un recurso que
-- AVANZA EN EL TIEMPO y PERSISTE su estado (hoy siembras, mañana cosechas; la
-- PC se apaga y el lote sigue ahí). Cada paso registrado crea su proceso/compra
-- (Kardex) y marca el paso como hecho; el lote recuerda en qué paso va.
--   production_runs: el lote (recurso, estado, paso actual).
--   run_steps: cada paso de la cadena con su estado (pendiente/hecho) y datos.
-- =====================================================================

create table if not exists public.production_runs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  resource text not null,
  state text not null default 'en_curso' check (state in ('en_curso', 'completado', 'cancelado')),
  step_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.production_runs(id) on delete cascade,
  idx integer not null,
  step_id text not null,
  label text not null,
  kind text not null,
  done boolean not null default false,
  qty numeric,
  silver numeric,
  process_id uuid,
  trade_id uuid,
  done_at timestamptz
);

create index if not exists production_runs_user on public.production_runs(user_id, created_at desc);
create index if not exists run_steps_run on public.run_steps(run_id, idx);

alter table public.production_runs enable row level security;
alter table public.run_steps enable row level security;

-- El grupo ve (trazabilidad); el dueño (o admin) edita.
drop policy if exists pr_select on public.production_runs;
create policy pr_select on public.production_runs for select using (public.is_group_member(group_id));
drop policy if exists pr_insert on public.production_runs;
create policy pr_insert on public.production_runs for insert with check (public.is_group_member(group_id) and user_id = (select auth.uid()));
drop policy if exists pr_update on public.production_runs;
create policy pr_update on public.production_runs for update using (user_id = (select auth.uid()) or public.is_group_admin(group_id));
drop policy if exists pr_delete on public.production_runs;
create policy pr_delete on public.production_runs for delete using (user_id = (select auth.uid()) or public.is_group_admin(group_id));

drop policy if exists rs_select on public.run_steps;
create policy rs_select on public.run_steps for select
  using (exists (select 1 from public.production_runs r where r.id = run_id and public.is_group_member(r.group_id)));
drop policy if exists rs_write on public.run_steps;
create policy rs_write on public.run_steps for all
  using (exists (select 1 from public.production_runs r where r.id = run_id and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.production_runs r where r.id = run_id and r.user_id = (select auth.uid())));
