/** Mi producción: inventario valorizado (Kardex), movimientos y lotes recientes. */
import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';

export async function load({ parent }) {
  const { session, group } = await parent();
  if (!session) throw redirect(303, '/login');
  if (!group) return { group: null, balances: [], movements: [], processes: [], names: {} as Record<string, string> };

  const me = session.user.id;

  const [balancesRes, movementsRes, processesRes, itemsRes] = await Promise.all([
    supabase
      .from('inventory_balances')
      .select('item_id, qty, avg_cost, value')
      .eq('group_id', group.id)
      .eq('user_id', me),
    supabase
      .from('inventory_movements')
      .select('item_id, fecha, seq, type, qty, unit_cost, bal_qty, bal_avg_cost')
      .eq('group_id', group.id)
      .eq('user_id', me)
      .order('seq', { ascending: false })
      .limit(50),
    supabase
      .from('processes')
      .select('id, type, fecha, city')
      .eq('group_id', group.id)
      .eq('user_id', me)
      .order('seq', { ascending: false })
      .limit(20),
    supabase.from('items').select('item_id, name_es'),
  ]);

  const names: Record<string, string> = {};
  for (const it of itemsRes.data ?? []) names[it.item_id] = it.name_es;

  return {
    group,
    balances: balancesRes.data ?? [],
    movements: movementsRes.data ?? [],
    processes: processesRes.data ?? [],
    names,
  };
}
