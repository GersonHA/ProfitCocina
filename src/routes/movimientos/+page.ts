/**
 * Movimientos: lista los EVENTOS de dominio del usuario (compras, ventas,
 * procesos, ajustes) para poder ELIMINAR uno mal registrado. Como el Kardex es
 * una proyección event-sourced, borrar el evento + recalcular deja todo limpio.
 */
import { base } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';

export type EventTable = 'market_txns' | 'processes' | 'stock_adjustments';

export interface EventRow {
  id: string;
  table: EventTable;
  fecha: string;
  seq: number;
  tipo: string;
  itemId: string;
  desc: string;
  qty: number;
  valor: number;
}

export async function load({ parent }) {
  const { session, group } = await parent();
  if (!session) throw redirect(303, `${base}/login`);
  const me = session.user.id;
  if (!group) return { eventos: [] as EventRow[] };

  const [mkt, procs, adjs, itemsRes] = await Promise.all([
    supabase
      .from('market_txns')
      .select('id, item_id, qty, price_unit, kind, status, fecha, seq')
      .eq('group_id', group.id)
      .eq('user_id', me),
    supabase
      .from('processes')
      .select('id, type, fecha, seq, process_outputs(item_id, qty, role), process_expenses(silver)')
      .eq('group_id', group.id)
      .eq('user_id', me),
    supabase
      .from('stock_adjustments')
      .select('id, item_id, qty_delta, kind, fecha, seq')
      .eq('group_id', group.id)
      .eq('user_id', me),
    supabase.from('items').select('item_id, name_es'),
  ]);

  const names: Record<string, string> = {};
  for (const it of itemsRes.data ?? []) names[it.item_id] = it.name_es;
  const nm = (id: string) => names[id] ?? id;

  const eventos: EventRow[] = [];

  for (const m of mkt.data ?? []) {
    const venta = m.kind !== 'buy';
    const tipo = !venta
      ? 'Compra'
      : m.status === 'cancelado'
        ? 'Venta cancelada'
        : m.status === 'en_venta'
          ? 'Venta en curso'
          : 'Venta';
    eventos.push({
      id: m.id,
      table: 'market_txns',
      fecha: m.fecha,
      seq: Number(m.seq),
      tipo,
      itemId: m.item_id,
      desc: nm(m.item_id),
      qty: Number(m.qty),
      valor: Number(m.qty) * Number(m.price_unit),
    });
  }

  for (const p of procs.data ?? []) {
    const outs = (p.process_outputs ?? []).filter((o: { role: string }) => o.role !== 'subproducto');
    const main = outs[0] as { item_id: string; qty: number } | undefined;
    const exp = (p.process_expenses ?? []).reduce((s: number, e: { silver: number }) => s + (Number(e.silver) || 0), 0);
    eventos.push({
      id: p.id,
      table: 'processes',
      fecha: p.fecha,
      seq: Number(p.seq),
      tipo: `Producción`,
      itemId: main?.item_id ?? '',
      desc: main ? nm(main.item_id) : '—',
      qty: main ? Number(main.qty) : 0,
      valor: exp,
    });
  }

  for (const a of adjs.data ?? []) {
    eventos.push({
      id: a.id,
      table: 'stock_adjustments',
      fecha: a.fecha,
      seq: Number(a.seq),
      tipo: a.kind === 'perdida' ? 'Pérdida' : 'Ajuste',
      itemId: a.item_id,
      desc: nm(a.item_id),
      qty: Number(a.qty_delta),
      valor: 0,
    });
  }

  eventos.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.seq - a.seq));
  return { eventos: eventos.slice(0, 100) };
}
