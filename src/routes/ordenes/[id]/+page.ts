/** Detalle de una orden de producción (compras → cocina → completado). */
import { error } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';

export async function load({ params, parent }) {
  const { session, group } = await parent();
  const me = session?.user.id ?? null;

  const { data: order } = await supabase.from('production_orders').select('*').eq('id', params.id).single();
  if (!order) throw error(404, 'Orden no encontrada');

  const [itemsRes, catRes, snapRes] = await Promise.all([
    supabase.from('order_items').select('*').eq('order_id', params.id),
    supabase.from('items').select('item_id, name_es'),
    supabase
      .from('price_snapshots')
      .select('sell_order_min, fecha')
      .eq('item_id', order.output_item)
      .order('fecha', { ascending: false })
      .limit(12),
  ]);

  const items = (itemsRes.data ?? []).sort((a, b) => Number(b.qty) - Number(a.qty));
  const sellerIds = [...new Set(items.map((i) => i.seller_id).filter(Boolean))] as string[];
  const { data: profs } = await supabase
    .from('profiles')
    .select('user_id, nick')
    .in('user_id', sellerIds.length ? sellerIds : ['00000000-0000-0000-0000-000000000000']);

  const names: Record<string, string> = {};
  for (const it of catRes.data ?? []) names[it.item_id] = it.name_es;
  const nicks: Record<string, string> = {};
  for (const p of profs ?? []) nicks[p.user_id] = p.nick ?? '—';

  let mealPrice: number | null = null;
  const snaps = snapRes.data ?? [];
  if (snaps.length) {
    const lf = snaps[0].fecha;
    const d = snaps.filter((s) => s.fecha === lf && s.sell_order_min != null);
    if (d.length) mealPrice = d.reduce((s, x) => s + Number(x.sell_order_min), 0) / d.length;
  }

  return {
    order,
    items,
    names,
    nicks,
    meId: me,
    groupId: group?.id ?? null,
    isOwner: order.user_id === me,
    mealPrice,
  };
}
