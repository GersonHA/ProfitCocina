/** Producción: lotes de la cadena (persistidos por estado) + diagrama. */
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
  let runs: Array<{
    id: string;
    resource: string;
    state: string;
    step_index: number;
    created_at: string;
    steps: { idx: number; step_id: string; label: string; kind: string; done: boolean }[];
  }> = [];

  if (group) {
    const [balRes, itemsRes, runsRes] = await Promise.all([
      supabase.from('inventory_balances').select('item_id, qty, avg_cost').eq('group_id', group.id).eq('user_id', me),
      supabase.from('items').select('item_id, name_es'),
      supabase
        .from('production_runs')
        .select('id, resource, state, step_index, created_at, run_steps(idx, step_id, label, kind, done)')
        .eq('user_id', me)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    for (const b of balRes.data ?? []) balances[b.item_id] = { qty: Number(b.qty), avg: Number(b.avg_cost) };
    for (const it of itemsRes.data ?? []) names[it.item_id] = it.name_es;
    runs = (runsRes.data ?? []).map((r) => ({
      id: r.id,
      resource: r.resource,
      state: r.state,
      step_index: r.step_index,
      created_at: r.created_at,
      steps: ((r.run_steps ?? []) as typeof runs[number]['steps']).sort((a, b) => a.idx - b.idx),
    }));
  }

  return { group, produce, chain, balances, names, runs, nick: profile?.nick ?? null, meId: me };
}
