/** Detalle de un lote de producción: sus pasos con estado persistido. */
import { error } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import { getChain } from '$lib/chains';

export async function load({ params, parent }) {
  const { session, group } = await parent();
  const me = session?.user.id ?? null;

  const { data: run } = await supabase.from('production_runs').select('*').eq('id', params.id).single();
  if (!run) throw error(404, 'Lote no encontrado');

  const [stepsRes, itemsRes, balRes] = await Promise.all([
    supabase.from('run_steps').select('*').eq('run_id', params.id).order('idx', { ascending: true }),
    supabase.from('items').select('item_id, name_es'),
    supabase.from('inventory_balances').select('item_id, qty').eq('group_id', run.group_id).eq('user_id', run.user_id),
  ]);

  const names: Record<string, string> = {};
  for (const it of itemsRes.data ?? []) names[it.item_id] = it.name_es;

  const balances: Record<string, number> = {};
  for (const b of balRes.data ?? []) balances[b.item_id] = Number(b.qty);

  const chain = getChain(run.resource);

  return {
    run,
    steps: stepsRes.data ?? [],
    chain,
    names,
    balances,
    group,
    meId: me,
    isOwner: run.user_id === me,
  };
}
