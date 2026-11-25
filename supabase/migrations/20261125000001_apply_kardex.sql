-- =====================================================================
-- apply_kardex: escribe la proyección del Kardex (movimientos + saldos) de un
-- usuario en un grupo, de forma ATÓMICA (una función = una transacción).
--
-- La llama la Edge Function `recompute` con la service_role, después de correr
-- el motor de costos (src/lib/core) con los eventos del usuario. Reemplaza por
-- completo la proyección de ese (usuario, grupo): borra lo viejo e inserta lo
-- nuevo. Al ser un reemplazo total, es idempotente.
--
-- Solo service_role puede ejecutarla: el cliente JAMÁS escribe la proyección,
-- así los números del Kardex siempre salen del motor en el servidor.
-- =====================================================================

create or replace function public.apply_kardex(
  p_user      uuid,
  p_group     uuid,
  p_movements jsonb,
  p_balances  jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.inventory_movements where user_id = p_user and group_id = p_group;
  delete from public.inventory_balances where user_id = p_user and group_id = p_group;

  insert into public.inventory_movements
    (group_id, user_id, item_id, fecha, seq, type, qty, unit_cost, total_cost,
     bal_qty, bal_avg_cost, bal_value, source_table, source_id)
  select
    p_group, p_user,
    m->>'item_id',
    (m->>'fecha')::date,
    (m->>'seq')::bigint,
    m->>'type',
    (m->>'qty')::numeric,
    (m->>'unit_cost')::numeric,
    (m->>'total_cost')::numeric,
    (m->>'bal_qty')::numeric,
    (m->>'bal_avg_cost')::numeric,
    (m->>'bal_value')::numeric,
    m->>'source_table',
    (m->>'source_id')::uuid
  from jsonb_array_elements(coalesce(p_movements, '[]'::jsonb)) as m;

  insert into public.inventory_balances
    (group_id, user_id, item_id, qty, avg_cost, value)
  select
    p_group, p_user,
    b->>'item_id',
    (b->>'qty')::numeric,
    (b->>'avg_cost')::numeric,
    (b->>'value')::numeric
  from jsonb_array_elements(coalesce(p_balances, '[]'::jsonb)) as b;
end;
$$;

revoke all on function public.apply_kardex(uuid, uuid, jsonb, jsonb) from public;
revoke all on function public.apply_kardex(uuid, uuid, jsonb, jsonb) from anon;
revoke all on function public.apply_kardex(uuid, uuid, jsonb, jsonb) from authenticated;
grant execute on function public.apply_kardex(uuid, uuid, jsonb, jsonb) to service_role;
