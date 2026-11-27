/** Mi perfil: datos del jugador (opcionales) + la meta de ganancia. */
import { base } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';

export async function load({ parent }) {
  const { session } = await parent();
  if (!session) throw redirect(303, `${base}/login`);
  const me = session.user.id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('nick, premium, especializaciones, meta_amount, meta_period')
    .eq('user_id', me)
    .single();

  const esp = (profile?.especializaciones ?? {}) as Record<string, string | undefined>;

  return {
    meId: me,
    email: session.user.email ?? '',
    nick: profile?.nick ?? '',
    premium: profile?.premium ?? true,
    produce: esp.produce ?? '',
    juego: esp.juego ?? '',
    gremio: esp.gremio ?? '',
    discord: esp.discord ?? '',
    notas: esp.notas ?? '',
    metaAmount: profile?.meta_amount != null ? Number(profile.meta_amount) : null,
    metaPeriod: (profile?.meta_period as 'day' | 'week' | 'month') ?? 'month',
  };
}
