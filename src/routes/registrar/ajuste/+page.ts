/** Ajuste de stock: para el modo "conteo" necesitamos tu saldo actual por item. */
import { supabase } from '$lib/supabase';

export async function load({ parent }) {
  const { session, group } = await parent();
  const me = session?.user.id ?? null;
  if (!group || !me) return { balances: {} as Record<string, number> };

  const { data } = await supabase
    .from('inventory_balances')
    .select('item_id, qty')
    .eq('group_id', group.id)
    .eq('user_id', me);

  const balances: Record<string, number> = {};
  for (const b of data ?? []) balances[b.item_id] = Number(b.qty);
  return { balances };
}
