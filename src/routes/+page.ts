/** Inicio = hub "¿Qué quieres registrar?". Trae solo el nick para el saludo. */
import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';

export async function load({ parent }) {
  const { session, group } = await parent();
  if (!session) throw redirect(303, '/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('nick')
    .eq('user_id', session.user.id)
    .single();

  return { group, nick: profile?.nick ?? null };
}
