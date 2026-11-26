/** Vender: lo que tienes en inventario (para vender de lo producido) + si tienes Premium (impuesto). */
import { supabase } from '$lib/supabase';

export async function load({ parent }) {
  const { session, group, items } = await parent();
  let premium = true;
  const names: Record<string, string> = {};
  for (const it of items ?? []) names[it.item_id] = it.name_es;

  let inventory: { item_id: string; name_es: string; qty: number }[] = [];
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
    }
  }
  return { premium, inventory };
}
