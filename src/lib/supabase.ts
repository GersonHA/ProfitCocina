/**
 * Cliente de Supabase para el navegador.
 * La URL y la clave pública (anon) vienen de las variables PUBLIC_* (.env).
 * Lo que protege los datos es el login + las reglas RLS, no la clave.
 */
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
