/** Precios de mercado: catálogo + último precio conocido por item. */
import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';

export async function load({ parent }) {
  const { session, group } = await parent();
  if (!session) throw redirect(303, '/login');

  const { data: items } = await supabase
    .from('items')
    .select('item_id, name_es, category, tier')
    .order('category')
    .order('tier');

  const { data: prices } = await supabase
    .from('price_snapshots')
    .select('item_id, sell_order_min, buy_order_max, captured_at')
    .order('captured_at', { ascending: false });

  const latest: Record<string, { sell: number | null; buy: number | null }> = {};
  for (const p of prices ?? []) {
    if (!(p.item_id in latest)) latest[p.item_id] = { sell: p.sell_order_min, buy: p.buy_order_max };
  }

  return { group, items: items ?? [], latest };
}
