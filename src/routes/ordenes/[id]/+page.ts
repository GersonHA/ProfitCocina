/** Detalle de una orden de producción (compras por lotes → cocina → completado). */
import { error } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import { PRODUCE } from '$lib/items';

export async function load({ params, parent }) {
  const { session, group } = await parent();
  const me = session?.user.id ?? null;

  const { data: order } = await supabase.from('production_orders').select('*').eq('id', params.id).single();
  if (!order) throw error(404, 'Orden no encontrada');
  const gid = order.group_id as string;

  const { data: items } = await supabase.from('order_items').select('*').eq('order_id', params.id);
  const itemList = (items ?? []).sort((a, b) => Number(b.qty) - Number(a.qty));
  const orderItemIds = itemList.map((i) => i.id);

  const [purRes, catRes, gmRes, balRes, snapRes] = await Promise.all([
    supabase
      .from('order_purchases')
      .select('*')
      .in('order_item_id', orderItemIds.length ? orderItemIds : ['00000000-0000-0000-0000-000000000000']),
    supabase.from('items').select('item_id, name_es'),
    supabase.from('group_members').select('user_id').eq('group_id', gid),
    supabase.from('inventory_balances').select('user_id, item_id, avg_cost').eq('group_id', gid),
    supabase.from('price_snapshots').select('item_id, fecha, sell_order_min').order('fecha', { ascending: false }).limit(4000),
  ]);

  const memberIds = (gmRes.data ?? []).map((m) => m.user_id);
  const { data: profs } = await supabase
    .from('profiles')
    .select('user_id, nick, especializaciones')
    .in('user_id', memberIds.length ? memberIds : ['00000000-0000-0000-0000-000000000000']);

  const names: Record<string, string> = {};
  for (const it of catRes.data ?? []) names[it.item_id] = it.name_es;

  const costByUserItem = new Map<string, number>();
  for (const b of balRes.data ?? []) costByUserItem.set(`${b.user_id}:${b.item_id}`, Number(b.avg_cost));

  const members = (profs ?? []).map((p) => {
    const esp = (p.especializaciones ?? {}) as Record<string, string>;
    const produceItem = PRODUCE[esp.produce ?? '']?.id ?? '';
    return {
      id: p.user_id,
      nick: p.nick ?? '—',
      produceItem,
      cost: produceItem ? (costByUserItem.get(`${p.user_id}:${produceItem}`) ?? null) : null,
    };
  });
  const nicks: Record<string, string> = {};
  for (const m of members) nicks[m.id] = m.nick;

  // Precio de mercado por item (día más reciente).
  const latest = new Map<string, string>();
  const acc = new Map<string, { sum: number; n: number }>();
  for (const s of snapRes.data ?? []) {
    if (s.sell_order_min == null) continue;
    const lf = latest.get(s.item_id);
    if (lf == null || s.fecha > lf) {
      latest.set(s.item_id, s.fecha);
      acc.set(s.item_id, { sum: 0, n: 0 });
    }
    if (s.fecha === latest.get(s.item_id)) {
      const a = acc.get(s.item_id)!;
      a.sum += Number(s.sell_order_min);
      a.n += 1;
    }
  }
  const marketPrice: Record<string, number> = {};
  for (const [item, a] of acc) if (a.n > 0) marketPrice[item] = a.sum / a.n;

  // Lotes agrupados por order_item.
  const purchasesByItem: Record<string, typeof purRes.data> = {};
  for (const p of purRes.data ?? []) (purchasesByItem[p.order_item_id] ??= []).push(p);

  return {
    order,
    items: itemList,
    purchasesByItem,
    names,
    nicks,
    members,
    marketPrice,
    meId: me,
    groupId: gid,
    isOwner: order.user_id === me,
    mealPrice: marketPrice[order.output_item] ?? null,
  };
}
