/** Comprar a un miembro: necesitamos la lista de compañeros del grupo. */
import { supabase } from '$lib/supabase';

export async function load({ parent }) {
  const { session, group } = await parent();
  const me = session?.user.id ?? null;
  if (!group) return { members: [], myId: me };

  const { data: gm } = await supabase
    .from('group_members')
    .select('user_id, role')
    .eq('group_id', group.id);

  const ids = (gm ?? []).map((m) => m.user_id);
  const { data: profs } = await supabase.from('profiles').select('user_id, nick').in('user_id', ids);
  const byId = new Map((profs ?? []).map((p) => [p.user_id, p.nick]));

  const members = (gm ?? [])
    .filter((m) => m.user_id !== me)
    .map((m) => ({ id: m.user_id, nick: byId.get(m.user_id) ?? '—' }));

  return { members, myId: me };
}
