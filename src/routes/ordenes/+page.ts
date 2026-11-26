/** Mis órdenes de producción (personales). */
import { supabase } from '$lib/supabase';

export async function load({ parent }) {
  const { session, group } = await parent();
  const me = session?.user.id ?? null;
  if (!group || !me) return { orders: [], names: {} as Record<string, string> };

  const [ordersRes, itemsRes] = await Promise.all([
    supabase
      .from('production_orders')
      .select('id, output_item, tandas, state, created_at, order_items(bought)')
      .eq('group_id', group.id)
      .eq('user_id', me)
      .order('created_at', { ascending: false }),
    supabase.from('items').select('item_id, name_es'),
  ]);

  const names: Record<string, string> = {};
  for (const it of itemsRes.data ?? []) names[it.item_id] = it.name_es;

  const orders = (ordersRes.data ?? []).map((o) => {
    const its = (o.order_items ?? []) as { bought: boolean }[];
    return {
      id: o.id,
      output_item: o.output_item as string,
      tandas: o.tandas as number,
      state: o.state as string,
      created_at: o.created_at as string,
      comprados: its.filter((x) => x.bought).length,
      total: its.length,
    };
  });

  return { orders, names };
}
