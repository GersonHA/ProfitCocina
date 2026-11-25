/**
 * App cliente (SPA): sin SSR ni prerender. La sesión se lee en el navegador y
 * se pasa al layout para decidir si se muestra la barra superior.
 */
import { supabase } from '$lib/supabase';

export const ssr = false;
export const prerender = false;

export async function load() {
  const { data } = await supabase.auth.getSession();
  return { session: data.session };
}
