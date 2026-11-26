/**
 * Inicio = Dashboard. Calcula los KPIs del usuario en su grupo:
 *  - Invertido  = silver que gastaste (compras de mercado + a miembros + gastos de estación/semillas)
 *  - Ventas     = ingresos por vender (mercado + a miembros)
 *  - Ganancia   = ventas − costo de lo vendido (COGS, del Kardex)
 *  - Inventario = valor actual del Kardex
 * Más la composición del inventario y los últimos movimientos.
 */
import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';

export async function load({ parent }) {
  const { session, group } = await parent();
  if (!session) throw redirect(303, '/login');
  const me = session.user.id;

  const { data: profile } = await supabase.from('profiles').select('nick').eq('user_id', me).single();

  let invested = 0;
  let ventas = 0;
  let cogs = 0;
  let invValue = 0;
  let inventory: { item_id: string; value: number }[] = [];
  let movements: Array<{
    item_id: string;
    fecha: string;
    type: string;
    qty: number;
    unit_cost: number;
    bal_qty: number;
    bal_avg_cost: number;
  }> = [];
  const names: Record<string, string> = {};

  if (group) {
    const gid = group.id;
    const [balRes, mktRes, trdRes, procRes, sellMovRes, movRes, itemsRes] = await Promise.all([
      supabase.from('inventory_balances').select('item_id, value').eq('group_id', gid).eq('user_id', me),
      supabase.from('market_txns').select('kind, qty, price_unit').eq('group_id', gid).eq('user_id', me),
      supabase
        .from('member_trades')
        .select('seller_id, buyer_id, qty, price_unit')
        .eq('group_id', gid)
        .or(`seller_id.eq.${me},buyer_id.eq.${me}`),
      supabase.from('processes').select('process_expenses(silver)').eq('group_id', gid).eq('user_id', me),
      supabase
        .from('inventory_movements')
        .select('total_cost')
        .eq('group_id', gid)
        .eq('user_id', me)
        .in('type', ['venta_mercado', 'venta_miembro']),
      supabase
        .from('inventory_movements')
        .select('item_id, fecha, type, qty, unit_cost, bal_qty, bal_avg_cost')
        .eq('group_id', gid)
        .eq('user_id', me)
        .order('seq', { ascending: false })
        .limit(12),
      supabase.from('items').select('item_id, name_es'),
    ]);

    for (const it of itemsRes.data ?? []) names[it.item_id] = it.name_es;

    for (const b of balRes.data ?? []) {
      const v = Number(b.value) || 0;
      invValue += v;
      if (v > 0) inventory.push({ item_id: b.item_id, value: v });
    }

    for (const m of mktRes.data ?? []) {
      const amt = (Number(m.qty) || 0) * (Number(m.price_unit) || 0);
      if (m.kind === 'buy') invested += amt;
      else ventas += amt;
    }

    for (const t of trdRes.data ?? []) {
      const amt = (Number(t.qty) || 0) * (Number(t.price_unit) || 0);
      if (t.buyer_id === me) invested += amt;
      if (t.seller_id === me) ventas += amt;
    }

    for (const p of procRes.data ?? []) {
      for (const e of p.process_expenses ?? []) invested += Number(e.silver) || 0;
    }

    for (const mv of sellMovRes.data ?? []) cogs += Math.abs(Number(mv.total_cost) || 0);

    movements = movRes.data ?? [];
  }

  inventory.sort((a, b) => b.value - a.value);

  return {
    group,
    nick: profile?.nick ?? null,
    invested,
    ventas,
    ganancia: ventas - cogs,
    invValue,
    inventory,
    movements,
    names,
  };
}
