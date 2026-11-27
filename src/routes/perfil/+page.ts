/** Mi perfil: datos del jugador (opcionales) + la meta de ganancia. */
import { base } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import { normalizeProduces } from '$lib/resources';

export async function load({ parent }) {
  const { session } = await parent();
  if (!session) throw redirect(303, `${base}/login`);
  const me = session.user.id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('nick, premium, especializaciones, meta_amount, meta_period')
    .eq('user_id', me)
    .single();

  const esp = (profile?.especializaciones ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');

  return {
    meId: me,
    email: session.user.email ?? '',
    nick: profile?.nick ?? '',
    premium: profile?.premium ?? true,
    produces: normalizeProduces(esp),
    juego: str(esp.juego),
    gremio: str(esp.gremio),
    discord: str(esp.discord),
    notas: str(esp.notas),
    islas: typeof esp.islas === 'number' ? esp.islas : null,
    islasNotas: str(esp.islasNotas),
    metaAmount: profile?.meta_amount != null ? Number(profile.meta_amount) : null,
    metaPeriod: (profile?.meta_period as 'day' | 'week' | 'month') ?? 'month',
  };
}
