/** Mi cadena: registro guiado paso a paso según el recurso que produce el usuario. */
import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import { getChain } from '$lib/chains';

export async function load({ parent }) {
  const { session, group } = await parent();
  if (!session) throw redirect(303, '/login');
  const me = session.user.id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('nick, especializaciones')
    .eq('user_id', me)
    .single();
  const produce = (profile?.especializaciones as { produce?: string } | null)?.produce ?? null;
  const chain = getChain(produce);

  const balances: Record<string, { qty: number; avg: number }> = {};
  const names: Record<string, string> = {};

  if (group) {
    const { data: bal } = await supabase
      .from('inventory_balances')
      .select('item_id, qty, avg_cost')
      .eq('group_id', group.id)
      .eq('user_id', me);
    for (const b of bal ?? []) balances[b.item_id] = { qty: Number(b.qty), avg: Number(b.avg_cost) };

    const { data: items } = await supabase.from('items').select('item_id, name_es');
    for (const it of items ?? []) names[it.item_id] = it.name_es;
  }

  return { group, produce, chain, balances, names, nick: profile?.nick ?? null };
}
