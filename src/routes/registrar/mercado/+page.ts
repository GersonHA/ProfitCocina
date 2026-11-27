/** Vender: inventario para vender + Premium (impuesto) + historial de ventas con estado. */
import { supabase } from '$lib/supabase';

export interface SellRow {
  id: string;
  item_id: string;
  name_es: string;
  qty: number;
  price_unit: number;
  taxes: number;
  city: string | null;
  order_type: string | null;
  status: string;
  fecha: string;
}

export async function load({ parent }) {
  const { session, group, items } = await parent();
  let premium = true;
  const names: Record<string, string> = {};
  for (const it of items ?? []) names[it.item_id] = it.name_es;

  let inventory: { item_id: string; name_es: string; qty: number }[] = [];
  let sells: SellRow[] = [];
  if (session) {
    const { data: prof } = await supabase.from('profiles').select('premium').eq('user_id', session.user.id).single();
    premium = prof?.premium ?? true;
    if (group) {
      const { data: bal } = await supabase
        .from('inventory_balances')
        .select('item_id, qty')
        .eq('group_id', group.id)
        .eq('user_id', session.user.id)
        .gt('qty', 0);
      inventory = (bal ?? [])
        .map((b) => ({ item_id: b.item_id, name_es: names[b.item_id] ?? b.item_id, qty: Number(b.qty) }))
        .sort((a, b) => b.qty - a.qty);

      const { data: txns } = await supabase
        .from('market_txns')
        .select('id, item_id, qty, price_unit, taxes, city, order_type, status, fecha')
        .eq('group_id', group.id)
        .eq('user_id', session.user.id)
        .eq('kind', 'sell')
        .order('fecha', { ascending: false })
        .order('seq', { ascending: false })
        .limit(60);
      sells = (txns ?? []).map((t) => ({
        id: t.id,
        item_id: t.item_id,
        name_es: names[t.item_id] ?? t.item_id,
        qty: Number(t.qty),
        price_unit: Number(t.price_unit),
        taxes: Number(t.taxes) || 0,
        city: t.city,
        order_type: t.order_type,
        status: t.status ?? 'vendido',
        fecha: t.fecha,
      }));
    }
  }
  return { premium, inventory, sells };
}
