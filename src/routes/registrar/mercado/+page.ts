/** Mercado: además del grupo/catálogo (del layout), necesitamos si tienes Premium (impuesto). */
import { supabase } from '$lib/supabase';

export async function load({ parent }) {
  const { session } = await parent();
  let premium = true;
  if (session) {
    const { data } = await supabase.from('profiles').select('premium').eq('user_id', session.user.id).single();
    premium = data?.premium ?? true;
  }
  return { premium };
}
