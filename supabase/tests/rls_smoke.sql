-- Smoke test de RLS (se corre contra el Supabase local, nunca producción).
-- Valida: alta de perfil por trigger, create_group, aislamiento entre usuarios
-- y redeem_invite. No forma parte del esquema; es una prueba manual.

\set GERSON '11111111-1111-1111-1111-111111111111'
\set OTRO   '22222222-2222-2222-2222-222222222222'

-- Dos usuarios de prueba (el trigger handle_new_user les crea el perfil).
insert into auth.users (id, email) values
  (:'GERSON', 'gerson@test.com'),
  (:'OTRO',   'otro@test.com')
on conflict (id) do nothing;

select 'perfiles_creados' as check, count(*) as n from public.profiles;  -- esperado: 2

-- GERSON crea su grupo (como admin) + un proceso + una invitación. Se corre como
-- postgres pero con el claim de Gerson, así auth.uid() = Gerson en las RPC.
set request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
create temporary table _g as select id from public.create_group('Panaderos', 'americas');
insert into public.processes (group_id, user_id, type, fecha)
  select id, :'GERSON', 'siembra', current_date from _g;
insert into public.group_invites (group_id, code)
  select id, 'JOIN123' from _g;

-- Bajo el rol authenticated (RLS activa): GERSON ve su grupo y su proceso.
set role authenticated;
set request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select 'gerson_ve_grupos'  as check, count(*) as n from public.groups;      -- esperado: 1
select 'gerson_ve_procesos' as check, count(*) as n from public.processes;  -- esperado: 1
reset role;

-- OTRO todavía no es miembro: no debe ver NADA.
set role authenticated;
set request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select 'otro_antes_grupos'   as check, count(*) as n from public.groups;     -- esperado: 0
select 'otro_antes_procesos' as check, count(*) as n from public.processes;  -- esperado: 0
reset role;

-- OTRO canjea la invitación (SECURITY DEFINER) y pasa a ser miembro.
set request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select 'canje' as check, (public.redeem_invite('JOIN123')).role as n;        -- esperado: member

-- Ahora SÍ ve el grupo y los procesos del grupo (transparencia).
set role authenticated;
set request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select 'otro_despues_grupos'   as check, count(*) as n from public.groups;      -- esperado: 1
select 'otro_despues_procesos' as check, count(*) as n from public.processes;   -- esperado: 1
reset role;
