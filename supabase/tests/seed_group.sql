-- Datos de prueba en el Supabase LOCAL: nicks, recurso que produce cada quien y
-- un grupo "Cocina de Amigos" con los tres (Gerson admin). Idempotente: se puede
-- correr varias veces. Requiere que los usuarios existan (scripts/seed-local.mjs).

-- Nicks y recurso que produce (resuelto por email).
update public.profiles p set nick = 'Gerson',  especializaciones = '{"produce":"pan"}'::jsonb
  from auth.users u where u.id = p.user_id and u.email = 'gerson@cocina.test';
update public.profiles p set nick = 'Amigo A', especializaciones = '{"produce":"ternera"}'::jsonb
  from auth.users u where u.id = p.user_id and u.email = 'amigoa@cocina.test';
update public.profiles p set nick = 'Amigo B', especializaciones = '{"produce":"calabaza"}'::jsonb
  from auth.users u where u.id = p.user_id and u.email = 'amigob@cocina.test';

-- Grupo con los tres miembros + una invitación de ejemplo.
do $$
declare gid uuid; uG uuid; uA uuid; uB uuid;
begin
  select id into uG from auth.users where email = 'gerson@cocina.test';
  select id into uA from auth.users where email = 'amigoa@cocina.test';
  select id into uB from auth.users where email = 'amigob@cocina.test';

  select id into gid from public.groups where name = 'Cocina de Amigos' limit 1;
  if gid is null then
    insert into public.groups (name, server, created_by)
    values ('Cocina de Amigos', 'americas', uG)
    returning id into gid;
  end if;

  insert into public.group_members (group_id, user_id, role) values
    (gid, uG, 'admin'),
    (gid, uA, 'member'),
    (gid, uB, 'member')
  on conflict (group_id, user_id) do nothing;

  insert into public.group_invites (group_id, code, created_by)
  values (gid, 'COCINA', uG)
  on conflict (code) do nothing;
end $$;

-- Resumen.
select u.email, p.nick, p.premium, p.especializaciones->>'produce' as produce
  from public.profiles p join auth.users u on u.id = p.user_id
  order by u.email;

select g.name, g.server, count(m.*) as miembros
  from public.groups g join public.group_members m on m.group_id = g.id
  group by g.id, g.name, g.server;
