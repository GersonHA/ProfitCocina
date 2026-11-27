/**
 * Mercado interno: el "precio" de cada quien ES su costo de producción (todos se
 * venden a costo). Varía día a día según sus lotes. Esto muestra el HISTORIAL
 * de ese costo por item y por miembro, sacado del Kardex (inventory_movements).
 * Sin API ni precios de otras ciudades.
 */
import { base } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';

export interface CostPoint {
  item_id: string;
  user_id: string;
  fecha: string;
  cost: number;
  qty: number;
}

export async function load({ parent }) {
  const { session, group } = await parent();
  if (!session) throw redirect(303, `${base}/login`);
  if (!group) {
    return {
      items: [] as { item_id: string; name: string }[],
      points: [] as CostPoint[],
      nicks: {} as Record<string, string>,
      names: {} as Record<string, string>,
    };
  }

  const [movRes, itemsRes, gmRes] = await Promise.all([
    supabase
      .from('inventory_movements')
      .select('item_id, user_id, fecha, bal_avg_cost, bal_qty, seq')
      .eq('group_id', group.id)
      .order('seq', { ascending: true })
      .limit(10000),
    supabase.from('items').select('item_id, name_es'),
    supabase.from('group_members').select('user_id').eq('group_id', group.id),
  ]);

  const names: Record<string, string> = {};
  for (const it of itemsRes.data ?? []) names[it.item_id] = it.name_es;

  const ids = (gmRes.data ?? []).map((m) => m.user_id);
  const { data: profs } = await supabase
    .from('profiles')
    .select('user_id, nick')
    .in('user_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  const nicks: Record<string, string> = {};
  for (const p of profs ?? []) nicks[p.user_id] = p.nick ?? '—';

  // Último costo > 0 por (item, usuario, día): el costo al que puede vender ese día.
  const last = new Map<string, CostPoint>();
  for (const m of movRes.data ?? []) {
    const cost = Number(m.bal_avg_cost) || 0;
    if (cost <= 0) continue; // saldo en 0 no cambia el "precio" conocido
    last.set(`${m.item_id}|${m.user_id}|${m.fecha}`, {
      item_id: m.item_id as string,
      user_id: m.user_id as string,
      fecha: m.fecha as string,
      cost,
      qty: Number(m.bal_qty) || 0,
    });
  }
  const points = [...last.values()];

  const itemIds = [...new Set(points.map((p) => p.item_id))].sort((a, b) => (names[a] ?? a).localeCompare(names[b] ?? b));
  const items = itemIds.map((id) => ({ item_id: id, name: names[id] ?? id }));

  return { items, points, nicks, names };
}
