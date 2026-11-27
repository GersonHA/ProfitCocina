/** Precios de mercado: catálogo + historial de precios (por item, ciudad y día). */
import { base } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';

export async function load({ parent }) {
  const { session, group } = await parent();
  if (!session) throw redirect(303, `${base}/login`);

  const { data: items } = await supabase
    .from('items')
    .select('item_id, name_es, category, tier')
    .order('category')
    .order('tier');

  const { data: snaps } = await supabase
    .from('price_snapshots')
    .select('item_id, city, fecha, sell_order_min, buy_order_max, volume')
    .order('fecha', { ascending: true })
    .limit(3000);

  return { group, items: items ?? [], snaps: snaps ?? [] };
}
