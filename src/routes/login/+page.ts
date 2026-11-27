/** Si ya hay sesión, no mostramos el login: directo a la app. */
import { base } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';

export async function load() {
  const { data } = await supabase.auth.getSession();
  if (data.session) throw redirect(303, `${base}/`);
  return {};
}
