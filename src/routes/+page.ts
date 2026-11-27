/**
 * Inicio = Dashboard. Entrega datos POR DÍA (para filtrar por período) y el
 * estado actual del inventario, más la meta y las pérdidas.
 *   invested = compras (mercado + a miembros) + gastos (estación/semillas)
 *   ventas   = ingresos por vender, netos de impuesto
 *   cogs     = costo de lo vendido (Kardex)   → ganancia = ventas − cogs
 *   perdida  = valor de los items dados de baja por ajuste de tipo "pérdida"
 */
import { base } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';

interface DayRow {
  fecha: string;
  invested: number;
  ventas: number;
  cogs: number;
  perdida: number;
}

export async function load({ parent }) {
  const { session, group } = await parent();
  if (!session) throw redirect(303, `${base}/login`);
  const me = session.user.id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('nick, meta_amount, meta_period')
    .eq('user_id', me)
    .single();

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
  let items: { item_id: string; name_es: string }[] = [];

  const invByDay = new Map<string, number>();
  const ventasByDay = new Map<string, number>();
  const cogsByDay = new Map<string, number>();
  const perdidaByDay = new Map<string, number>();
  const add = (map: Map<string, number>, k: string, v: number) => map.set(k, (map.get(k) || 0) + v);

  if (group) {
    const gid = group.id;
    const [balRes, mktRes, trdRes, procRes, movRes, itemsRes, adjRes] = await Promise.all([
      supabase.from('inventory_balances').select('item_id, value').eq('group_id', gid).eq('user_id', me),
      supabase.from('market_txns').select('kind, qty, price_unit, taxes, fecha, status').eq('group_id', gid).eq('user_id', me),
      supabase
        .from('member_trades')
        .select('seller_id, buyer_id, qty, price_unit, fecha')
        .eq('group_id', gid)
        .or(`seller_id.eq.${me},buyer_id.eq.${me}`),
      supabase.from('processes').select('fecha, process_expenses(silver)').eq('group_id', gid).eq('user_id', me),
      supabase
        .from('inventory_movements')
        .select('item_id, fecha, type, qty, unit_cost, total_cost, bal_qty, bal_avg_cost, source_id')
        .eq('group_id', gid)
        .eq('user_id', me)
        .order('seq', { ascending: false })
        .limit(5000),
      supabase.from('items').select('item_id, name_es'),
      supabase.from('stock_adjustments').select('id, kind').eq('group_id', gid).eq('user_id', me),
    ]);

    items = itemsRes.data ?? [];
    for (const it of items) names[it.item_id] = it.name_es;

    for (const b of balRes.data ?? []) {
      const v = Number(b.value) || 0;
      invValue += v;
      if (v > 0) inventory.push({ item_id: b.item_id, value: v });
    }

    for (const m of mktRes.data ?? []) {
      const amt = (Number(m.qty) || 0) * (Number(m.price_unit) || 0);
      const tax = Number(m.taxes) || 0;
      if (m.kind === 'buy') {
        add(invByDay, m.fecha, amt);
      } else if (m.status === 'cancelado') {
        // Orden cancelada: el ítem volvió, pero el impuesto pagado es pérdida.
        add(perdidaByDay, m.fecha, tax);
      } else if (m.status !== 'en_venta') {
        // Vendido (o filas antiguas sin estado): ingreso neto de impuesto.
        add(ventasByDay, m.fecha, amt - tax);
      }
      // 'en_venta' (listada, aún no vendida): no cuenta todavía.
    }

    for (const t of trdRes.data ?? []) {
      const amt = (Number(t.qty) || 0) * (Number(t.price_unit) || 0);
      if (t.buyer_id === me) add(invByDay, t.fecha, amt);
      if (t.seller_id === me) add(ventasByDay, t.fecha, amt);
    }

    for (const p of procRes.data ?? []) {
      for (const e of p.process_expenses ?? []) add(invByDay, p.fecha, Number(e.silver) || 0);
    }

    // Tipo de cada ajuste (para saber cuáles son "pérdida").
    const adjKind = new Map<string, string>();
    for (const a of adjRes.data ?? []) adjKind.set(a.id, a.kind);

    const allMov = movRes.data ?? [];
    for (const mv of allMov) {
      if (mv.type === 'venta_mercado' || mv.type === 'venta_miembro') {
        add(cogsByDay, mv.fecha, Math.abs(Number(mv.total_cost) || 0));
      } else if (mv.type === 'ajuste' && Number(mv.qty) < 0 && adjKind.get(mv.source_id) === 'perdida') {
        add(perdidaByDay, mv.fecha, Math.abs(Number(mv.total_cost) || 0));
      }
    }

    movements = allMov.slice(0, 12).map((m) => ({
      item_id: m.item_id,
      fecha: m.fecha,
      type: m.type,
      qty: Number(m.qty),
      unit_cost: Number(m.unit_cost),
      bal_qty: Number(m.bal_qty),
      bal_avg_cost: Number(m.bal_avg_cost),
    }));
  }

  inventory.sort((a, b) => b.value - a.value);

  // Serie diaria combinada.
  const dias = new Set<string>([
    ...invByDay.keys(),
    ...ventasByDay.keys(),
    ...cogsByDay.keys(),
    ...perdidaByDay.keys(),
  ]);
  const dailyData: DayRow[] = [...dias].sort().map((fecha) => ({
    fecha,
    invested: invByDay.get(fecha) || 0,
    ventas: ventasByDay.get(fecha) || 0,
    cogs: cogsByDay.get(fecha) || 0,
    perdida: perdidaByDay.get(fecha) || 0,
  }));

  return {
    group,
    meId: me,
    nick: profile?.nick ?? null,
    metaAmount: profile?.meta_amount != null ? Number(profile.meta_amount) : null,
    metaPeriod: (profile?.meta_period as 'day' | 'week' | 'month') ?? 'month',
    invValue,
    inventory,
    movements,
    names,
    items,
    dailyData,
  };
}
