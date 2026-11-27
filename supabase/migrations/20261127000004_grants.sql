-- Permisos de rol para la API (PostgREST).
--
-- En local, Supabase concede automáticamente privilegios a anon/authenticated
-- sobre las tablas creadas por el rol `postgres` (vía ALTER DEFAULT PRIVILEGES).
-- Pero `supabase db push --remote` crea las tablas con un rol de migración
-- distinto, por lo que esos privilegios por defecto NO se aplican y la API
-- responde "permission denied for table ...".
--
-- Aquí los concedemos explícitamente. IMPORTANTE: esto es solo la "puerta";
-- la protección real de los datos la dan las políticas RLS ya definidas en las
-- migraciones anteriores. Por eso:
--   * anon        -> solo SELECT (puede leer catálogo público; no escribe).
--   * authenticated -> todo (gated por RLS: cada quien ve/escribe lo suyo).
--   * service_role  -> todo (bypassa RLS; solo backend/edge functions).

grant usage on schema public to anon, authenticated, service_role;

-- Tablas existentes
grant select on all tables in schema public to anon;
grant all    on all tables in schema public to authenticated, service_role;

-- Secuencias (para columnas serial/identity en inserts)
grant usage, select on all sequences in schema public to anon;
grant all           on all sequences in schema public to authenticated, service_role;

-- Funciones/rutinas (rpc, helpers SECURITY DEFINER)
grant execute on all routines in schema public to anon, authenticated, service_role;

-- Tablas/objetos que se creen a futuro bajo este rol de migración
alter default privileges in schema public grant select        on tables    to anon;
alter default privileges in schema public grant all           on tables    to authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon;
alter default privileges in schema public grant all           on sequences to authenticated, service_role;
alter default privileges in schema public grant execute       on routines  to anon, authenticated, service_role;
